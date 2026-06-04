#!/usr/bin/env node
import chalk from 'chalk';
import { getConfig } from './config.js';
import { WebsitePipeline } from './orchestrator/pipeline.js';
import { slugify } from './output/project-writer.js';
import { saveToGoogleSheet } from './output/google-sheets.js';
import { pushToGitHub } from './github-push.js';
import { deployToVercel } from './vercel-deploy.js';
import { BaseAgent } from './agents/base.js';
import { execSync, spawn } from 'child_process';
import path from 'path';
import http from 'http';
import fs from 'fs';

const config = getConfig();
const url = process.argv[2] || config.defaultGoogleMapsUrl;

if (!url) {
  console.log(chalk.red('\n  Error: No URL. Set GOOGLE_MAPS_URL in .env or pass as argument.\n'));
  console.log('  Usage: npm run pipeline');
  console.log('  Usage: npm run pipeline -- "https://maps.google.com/..."\n');
  process.exit(1);
}

console.log(chalk.blue.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk.blue.bold('  Agent Web — Fast Pipeline'));
console.log(chalk.blue.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
console.log(`  URL:   ${url.slice(0, 80)}...`);
console.log(`  Model: ${config.bedrockModelId}`);
console.log(`  Output: ${config.outputDir}\n`);

const startTime = Date.now();

try {
  const pipeline = new WebsitePipeline(config);
  const state = await pipeline.run(url);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (state.stage === 'complete' || (state.generatedFiles && state.generatedFiles.files.length > 0)) {
    const projectName = slugify(state.businessData.name);
    const projectDir = path.resolve(config.outputDir, projectName);

    console.log(chalk.green.bold('\n  ✓ Website Generated!'));
    console.log(`  Mode:     ${state.websiteMode === 'redesign' ? '🔄 REDESIGN (existing site improved)' : '🆕 NEW BUILD'}`);
    console.log(`  Business: ${state.businessData.name}`);
    console.log(`  Industry: ${state.businessData.industry}`);
    console.log(`  Files:    ${state.generatedFiles.files.length}`);
    const elapsedMin = (parseFloat(elapsed) / 60).toFixed(1);
    console.log(`  Time:     ${elapsedMin} min`);
    console.log(`  Path:     ${projectDir}\n`);

    state.generationTime = elapsedMin;
    state.outputPath = projectDir;
    state.imagesDownloaded = 10;

    // Step 1: Fix all pages (static checks)
    console.log(chalk.yellow('  Fixing pages...'));
    fixAllPages(projectDir, state);

    // Step 2: Install deps + test all pages with real server
    console.log(chalk.yellow('  Installing dependencies...'));
    try {
      execSync('npm install --legacy-peer-deps', { cwd: projectDir, stdio: 'pipe', timeout: 60000 });
    } catch {}

    console.log(chalk.yellow('  Testing all pages...'));
    const testPort = 4567;
    let pageErrors = await testAllPages(projectDir, testPort, state);

    // Step 3: If issues found, fix and test again
    if (pageErrors.length > 0) {
      console.log(chalk.yellow(`  ⚠ ${pageErrors.length} issues found. Fixing...`));
      for (const err of pageErrors) {
        console.log(chalk.yellow(`    → ${err.route} — ${err.issue}`));
        fixPageIssue(err, projectDir, state);
      }

      // Fix all again (catches cascading issues)
      fixAllPages(projectDir, state);

      // Re-test
      console.log(chalk.yellow('  Re-testing all pages...'));
      pageErrors = await testAllPages(projectDir, testPort, state);

      if (pageErrors.length > 0) {
        console.log(chalk.yellow(`  ⚠ ${pageErrors.length} issues remain (non-critical)`));
      } else {
        console.log(chalk.green('  ✓ All pages working'));
      }
    } else {
      console.log(chalk.green('  ✓ All pages working'));
    }

    // Step 4: Visual consistency check (colors, contrast, layout)
    console.log(chalk.yellow('  Checking visual consistency...'));
    const visualFixes = checkVisualConsistency(projectDir, state);
    if (visualFixes > 0) {
      console.log(chalk.yellow(`    Fixed ${visualFixes} visual issues`));
    } else {
      console.log(chalk.green('  ✓ Visual check passed'));
    }

    // Step 5: Mobile responsiveness check
    console.log(chalk.yellow('  Checking mobile responsiveness...'));
    const mobileFixes = await checkMobileView(projectDir, state, config);
    if (mobileFixes > 0) {
      console.log(chalk.yellow(`    Fixed ${mobileFixes} mobile issues`));
    } else {
      console.log(chalk.green('  ✓ Mobile check passed'));
    }

    // Step 6: AI Visual Review — screenshot, review, fix, re-check until score ≥ 7
    console.log(chalk.yellow('  AI visual review...'));
    let aiAttempts = 0;
    const MAX_AI_ATTEMPTS = 2;
    while (aiAttempts < MAX_AI_ATTEMPTS) {
      const { fixes, score } = await aiVisualReview(projectDir, state, config);
      if (score >= 7 || fixes === 0) {
        console.log(chalk.green(`  ✓ AI review passed (score: ${score}/10)`));
        break;
      }
      console.log(chalk.yellow(`    Score ${score}/10 — applied ${fixes} fixes, re-checking...`));
      aiAttempts++;
    }

    // Step 7: Push to GitHub only after all checks pass
    console.log(chalk.yellow('\n  Pushing to GitHub...'));
    const repoUrl = await pushToGitHub(projectDir, state.businessData.name);
    if (repoUrl) {
      console.log(chalk.green(`  ✓ GitHub: ${repoUrl}`));
    }

    // Step 5: Deploy to Vercel
    console.log(chalk.yellow('  Deploying to Vercel...'));
    const deployUrl = await deployToVercel(projectDir, state.businessData.name);
    if (deployUrl) {
      console.log(chalk.green(`  ✓ Live: ${deployUrl}`));
    }

    // Step 6: Save to Google Sheet (with live URL and GitHub URL)
    state.liveUrl = deployUrl || '';
    state.githubUrl = repoUrl || '';
    await saveToGoogleSheet(state);

    console.log(chalk.blue.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green.bold('  ✓ Pipeline Complete!'));
    console.log(chalk.blue.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    if (deployUrl) console.log(`  ${chalk.green('Live URL:')} ${deployUrl}`);
    if (repoUrl) console.log(`  ${chalk.green('GitHub:')}   ${repoUrl}`);
    console.log('');
  } else {
    console.log(chalk.red.bold(`\n  ✗ Failed (${elapsed}s)`));
    console.log(`  Stage: ${state.stage}`);
    for (const err of state.errors) {
      console.log(chalk.red(`  - ${err}`));
    }
    process.exit(1);
  }
} catch (err) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.red.bold(`\n  ✗ Pipeline Error (${elapsed}s): ${err.message}\n`));
  process.exit(1);
}

async function aiVisualReview(projectDir, state, config) {
  let fixes = 0;
  let score = 6;
  const testPort = 4569;
  let serverProcess;

  try {
    const { chromium } = await import('playwright');
    const agent = new BaseAgent(config);

    // Start temp server
    serverProcess = spawn('npx', ['next', 'dev', '-p', String(testPort)], {
      cwd: projectDir,
      stdio: 'pipe',
    });

    await waitForServer(testPort, 30000);

    const browser = await chromium.launch({ headless: true });

    // Take desktop screenshot
    const desktopPage = await browser.newPage();
    await desktopPage.setViewportSize({ width: 1440, height: 900 });
    await desktopPage.goto(`http://localhost:${testPort}`, { waitUntil: 'networkidle', timeout: 30000 });
    await desktopPage.waitForTimeout(2000);
    const desktopScreenshot = await desktopPage.screenshot({ fullPage: false, type: 'jpeg', quality: 60 });

    // Take mobile screenshot
    const mobilePage = await browser.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 812 });
    await mobilePage.goto(`http://localhost:${testPort}`, { waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.waitForTimeout(2000);
    const mobileScreenshot = await mobilePage.screenshot({ fullPage: false, type: 'jpeg', quality: 60 });

    await browser.close();

    // Send to Claude for review
    const desktopBase64 = desktopScreenshot.toString('base64');
    const mobileBase64 = mobileScreenshot.toString('base64');

    const reviewPrompt = `You are a Senior UI/UX Reviewer. Analyze these screenshots of a generated website for "${state.businessData?.name || 'business'}".

Check for these SPECIFIC issues and return a JSON response:

1. HEADER: Is it visible? Can you read the nav links? Is contrast good? (text visible against background)
2. HERO: Does it look professional? Is text readable? Are CTAs visible?
3. COLORS: Is the color scheme consistent? Any text hard to read due to poor contrast?
4. LAYOUT: Any obvious overlap, cut-off text, or misalignment?
5. MOBILE: Does the mobile view look usable? Menu accessible?

Return ONLY a JSON object:
{
  "score": 1-10,
  "issues": [
    {"component": "header|hero|section|footer", "problem": "specific issue", "fix": "css fix suggestion"}
  ],
  "overall": "one sentence summary"
}

If everything looks good (score 8+), return {"score": 9, "issues": [], "overall": "looks professional"}`;

    const response = await agent.callLLM(reviewPrompt, [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: desktopBase64 } },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: mobileBase64 } },
          { type: 'text', text: 'Review these desktop (first) and mobile (second) screenshots. Identify visual issues.' },
        ],
      },
    ]);

    // Parse review
    let review;
    try {
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      review = JSON.parse(cleaned.trim());
    } catch {
      review = { score: 6, issues: [], overall: 'Could not parse review — assuming needs fixes' };
    }

    score = review.score || 6;
    console.log(chalk.yellow(`    AI Score: ${score}/10 — ${review.overall}`));

    // Apply fixes for critical issues (score < 8)
    if (review.issues && review.issues.length > 0 && score < 8) {
      const allJsx = findAllJsx(path.join(projectDir, 'src'));

      // If score is very low, apply aggressive header/footer fix regardless of specific issues
      if (score <= 5) {
        const headerFile = allJsx.find(f => f.includes('Header.jsx'));
        if (headerFile) {
          let hContent = fs.readFileSync(headerFile, 'utf-8');
          // Force dark header with white text for contrast
          hContent = hContent.replace(/bg-\[#[a-fA-F0-9]{6}\]/g, (match) => {
            const hex = match.match(/#([0-9a-fA-F]{6})/)[1];
            const brightness = (parseInt(hex.slice(0,2),16) + parseInt(hex.slice(2,4),16) + parseInt(hex.slice(4,6),16)) / 3;
            return brightness > 128 ? 'bg-[#1a1a1a]' : match;
          });
          hContent = hContent.replace(/text-gray-[4-9]00/g, 'text-white');
          hContent = hContent.replace(/text-slate-[4-9]00/g, 'text-white');
          fs.writeFileSync(headerFile, hContent, 'utf-8');
          fixes++;
        }
      }

      for (const issue of review.issues) {
        const component = issue.component || '';
        let targetFile;

        if (component === 'header') {
          targetFile = allJsx.find(f => f.includes('Header.jsx'));
        } else if (component === 'footer') {
          targetFile = allJsx.find(f => f.includes('Footer.jsx'));
        } else if (component === 'hero') {
          targetFile = allJsx.find(f => f.endsWith('src/app/page.jsx'));
        } else {
          targetFile = allJsx.find(f => f.includes('Header.jsx'));
        }

        if (targetFile) {
          let content = fs.readFileSync(targetFile, 'utf-8');
          const original = content;

          // Fix: contrast/visibility issues
          if (issue.problem?.includes('contrast') || issue.problem?.includes('visible') || issue.problem?.includes('invisible') || issue.problem?.includes('read')) {
            if (targetFile.includes('Header')) {
              // Any light bg → dark
              content = content.replace(/bg-\[#[fFeEdDcC][0-9a-fA-F]{5}\]/g, 'bg-[#1a1a1a]');
              content = content.replace(/bg-white\b/g, 'bg-[#1a1a1a]');
              content = content.replace(/bg-transparent\b/g, 'bg-[#1a1a1a]');
              content = content.replace(/bg-gray-50\b/g, 'bg-[#1a1a1a]');
              content = content.replace(/bg-gray-100\b/g, 'bg-[#1a1a1a]');
              // Dark text → white
              content = content.replace(/text-gray-[6-9]00/g, 'text-white');
              content = content.replace(/text-slate-[6-9]00/g, 'text-white');
              content = content.replace(/text-gray-800/g, 'text-white');
              content = content.replace(/text-gray-900/g, 'text-white');
              content = content.replace(/text-black\b/g, 'text-white');
            }
            if (targetFile.includes('Footer')) {
              content = content.replace(/bg-\[#[fFeEdDcC][0-9a-fA-F]{5}\]/g, 'bg-[#1a1a1a]');
              content = content.replace(/bg-white\b/g, 'bg-[#111111]');
            }
          }

          // Fix: text too small
          if (issue.problem?.includes('small') || issue.fix?.includes('font size')) {
            content = content.replace(/text-xs\b/g, 'text-sm');
          }

          // Fix: navigation not visible
          if (issue.problem?.includes('navigation') || issue.problem?.includes('nav')) {
            content = content.replace(/text-gray-[4-6]00/g, 'text-white');
            content = content.replace(/text-slate-[4-6]00/g, 'text-white');
          }

          if (content !== original) {
            fs.writeFileSync(targetFile, content, 'utf-8');
            fixes++;
          }
        }
      }
    }
  } catch (err) {
    console.log(chalk.yellow(`    AI review skipped: ${err.message}`));
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { fixes, score };
}

async function checkMobileView(projectDir, state, config) {
  let fixes = 0;
  const testPort = 4568;
  let serverProcess;

  try {
    const { chromium } = await import('playwright');

    // Start temp server
    serverProcess = spawn('npx', ['next', 'dev', '-p', String(testPort)], {
      cwd: projectDir,
      stdio: 'pipe',
    });

    await waitForServer(testPort, 30000);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    const page = await context.newPage();

    // Check home page on mobile
    await page.goto(`http://localhost:${testPort}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check for common mobile issues
    const mobileIssues = await page.evaluate(() => {
      const issues = [];
      const body = document.body;

      // Check horizontal overflow
      if (body.scrollWidth > window.innerWidth + 10) {
        issues.push('horizontal-overflow');
      }

      // Check if text is too small
      const allText = document.querySelectorAll('p, span, a, li');
      for (const el of allText) {
        const size = parseFloat(window.getComputedStyle(el).fontSize);
        if (size < 12 && el.textContent.trim().length > 0) {
          issues.push('text-too-small');
          break;
        }
      }

      // Check if buttons/links are too small to tap
      const tappables = document.querySelectorAll('a, button');
      for (const el of tappables) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 32) && el.textContent.trim().length > 0) {
          issues.push('tap-target-small');
          break;
        }
      }

      // Check if images overflow
      const images = document.querySelectorAll('img');
      for (const img of images) {
        if (img.naturalWidth > 0 && img.clientWidth > window.innerWidth) {
          issues.push('image-overflow');
          break;
        }
      }

      // Check if header is visible and not overlapping content
      const header = document.querySelector('header');
      if (header) {
        const headerRect = header.getBoundingClientRect();
        if (headerRect.height > 100) {
          issues.push('header-too-tall');
        }
      }

      return issues;
    });

    await browser.close();

    // Fix detected issues
    if (mobileIssues.length > 0) {
      const allJsx = findAllJsx(path.join(projectDir, 'src'));

      for (const filePath of allJsx) {
        let content = fs.readFileSync(filePath, 'utf-8');
        let changed = false;

        if (mobileIssues.includes('horizontal-overflow')) {
          // Add overflow-x-hidden to main containers
          if (filePath.includes('layout.jsx') && !content.includes('overflow-x-hidden')) {
            content = content.replace(/<body className="/, '<body className="overflow-x-hidden ');
            if (content.includes('<body className="overflow-x-hidden')) changed = true;
          }
        }

        if (mobileIssues.includes('text-too-small')) {
          // Ensure minimum text size
          if (filePath.includes('globals.css') && !content.includes('text-sm')) {
            content += '\n@layer base { p, span, a, li { @apply text-sm sm:text-base; } }\n';
            changed = true;
          }
        }

        if (mobileIssues.includes('header-too-tall') && filePath.includes('Header')) {
          // Reduce header height on mobile
          content = content.replace(/h-20/g, 'h-14 lg:h-20');
          content = content.replace(/h-16 lg:h-20/g, 'h-14 lg:h-20');
          content = content.replace(/text-2xl lg:text-3xl/g, 'text-xl lg:text-2xl');
          if (content !== fs.readFileSync(filePath, 'utf-8')) changed = true;
        }

        if (changed) {
          fs.writeFileSync(filePath, content, 'utf-8');
          fixes++;
        }
      }

      // Add global overflow fix if not already there
      if (mobileIssues.includes('horizontal-overflow') || mobileIssues.includes('image-overflow')) {
        const globalsCss = path.join(projectDir, 'src', 'app', 'globals.css');
        if (fs.existsSync(globalsCss)) {
          let css = fs.readFileSync(globalsCss, 'utf-8');
          if (!css.includes('overflow-x: hidden')) {
            css += '\n\nhtml, body { overflow-x: hidden; }\nimg { max-width: 100%; height: auto; }\n';
            fs.writeFileSync(globalsCss, css, 'utf-8');
            fixes++;
          }
        }
      }
    }
  } catch (err) {
    console.log(chalk.yellow(`    Mobile check skipped: ${err.message}`));
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return fixes;
}

function checkVisualConsistency(projectDir, state) {
  const srcDir = path.join(projectDir, 'src');
  const allJsx = findAllJsx(srcDir);
  let fixes = 0;

  // Collect theme colors from home page (source of truth)
  const homePage = allJsx.find(f => f.endsWith('src/app/page.jsx'));
  let themeColors = { dark: '#1a1a1a', primary: '#D4AF37', accent: '#2D5A4A' };

  if (homePage) {
    const homeContent = fs.readFileSync(homePage, 'utf-8');
    // Extract most-used dark bg color
    const darkBgs = homeContent.match(/bg-\[#([0-9a-fA-F]{6})\]/g) || [];
    const darkColors = darkBgs.filter(c => {
      const hex = c.match(/#([0-9a-fA-F]{6})/)[1];
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return (r + g + b) / 3 < 80; // dark color
    });
    if (darkColors.length > 0) {
      const colorCounts = {};
      darkColors.forEach(c => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
      const mostUsedDark = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (mostUsedDark) {
        themeColors.dark = mostUsedDark.match(/#[0-9a-fA-F]{6}/)[0];
      }
    }
  }

  for (const filePath of allJsx) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // Check 1: White/light text on light background (contrast issue)
    // Pattern: bg-[#light] with text-white nearby
    const lightBgWithWhiteText = [
      { bg: /bg-\[#F4F1EC\]/g, fix: `bg-[${themeColors.dark}]` },
      { bg: /bg-\[#f4f1ec\]/g, fix: `bg-[${themeColors.dark}]` },
      { bg: /bg-\[#FAFAFA\]/g, fix: `bg-[${themeColors.dark}]` },
      { bg: /bg-\[#fafafa\]/g, fix: `bg-[${themeColors.dark}]` },
      { bg: /bg-\[#F5F5F5\]/g, fix: `bg-[${themeColors.dark}]` },
      { bg: /bg-\[#f5f5f5\]/g, fix: `bg-[${themeColors.dark}]` },
    ];

    // Only fix in Header/Footer (components that use text-white)
    if (filePath.includes('Header') || filePath.includes('Footer')) {
      if (content.includes('text-white')) {
        for (const rule of lightBgWithWhiteText) {
          if (rule.bg.test(content)) {
            content = content.replace(rule.bg, rule.fix);
            changed = true;
          }
        }
      }
    }

    // Check 2: Active nav using dark text on dark bg
    // e.g. bg-[#2D5A4A] text-black — should be text-white
    if (filePath.includes('Header')) {
      content = content.replace(/bg-\[#2D5A4A\]\s+text-black/g, 'bg-[#D4AF37] text-black');
      if (content !== fs.readFileSync(filePath, 'utf-8')) changed = true;
    }

    // Check 3: Ensure header has dark background if it uses text-white
    if (filePath.includes('Header') && content.includes('text-white')) {
      const headerBgMatch = content.match(/className="fixed[^"]*bg-([^\s"]+)/);
      if (headerBgMatch) {
        const bgClass = headerBgMatch[1];
        // If bg is light (white, gray-50, transparent), fix it
        if (bgClass === 'white' || bgClass === 'transparent' || bgClass === 'gray-50') {
          content = content.replace(
            /className="fixed([^"]*?)bg-(white|transparent|gray-50)/,
            `className="fixed$1bg-[${themeColors.dark}]`
          );
          changed = true;
        }
      }
    }

    // Check 4: Footer — if uses text-white/text-gray-400, bg must be dark
    if (filePath.includes('Footer') && (content.includes('text-white') || content.includes('text-gray-400') || content.includes('text-gray-300'))) {
      // Check if footer bg is light (bad contrast with white text)
      const footerBgMatch = content.match(/footer className="[^"]*bg-\[#([0-9a-fA-F]{6})\]/);
      let needsFix = false;

      if (footerBgMatch) {
        const hex = footerBgMatch[1];
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const brightness = (r + g + b) / 3;
        if (brightness > 128) needsFix = true; // light bg + white text = bad
      } else if (!content.includes('bg-slate-9') && !content.includes('bg-gray-9') && !content.includes('bg-black') && !content.includes('bg-neutral-9')) {
        needsFix = true;
      }

      if (needsFix) {
        // Replace footer bg with dark
        content = content.replace(
          /(<footer className="[^"]*?)bg-\[#[0-9a-fA-F]{6}\]/,
          `$1bg-[${themeColors.dark}]`
        );
        // If no bg-[# was found, add it
        if (!content.includes(`bg-[${themeColors.dark}]`)) {
          content = content.replace(/<footer className="/, `<footer className="bg-[${themeColors.dark}] `);
        }
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
      fixes++;
    }
  }

  return fixes;
}

function fixAllPages(projectDir, state) {
  const srcDir = path.join(projectDir, 'src');
  const allJsx = findAllJsx(srcDir);

  let fixCount = 0;
  for (const filePath of allJsx) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // Fix: Remove Header/Footer imports from pages
    if (filePath.includes('/app/') && filePath.includes('page.jsx')) {
      const before = content;
      content = content.replace(/import\s+Header\s+from\s+['"][^'"]+['"];?\n?/g, '');
      content = content.replace(/import\s+Footer\s+from\s+['"][^'"]+['"];?\n?/g, '');
      content = content.replace(/<Header\s*\/?\s*>/g, '');
      content = content.replace(/<Footer\s*\/?\s*>/g, '');
      content = content.replace(/<\/Header>/g, '');
      content = content.replace(/<\/Footer>/g, '');
      if (content !== before) changed = true;
    }

    // Fix: Wrong relative imports
    if (content.match(/from\s+['"]\.\.\/components\//)) {
      content = content.replace(/from\s+['"]\.\.\/components\//g, "from '@/components/");
      content = content.replace(/from\s+['"]\.\.\/\.\.\/components\//g, "from '@/components/");
      changed = true;
    }

    // Fix: Invalid react-icons
    const iconFixes = { HiOutlineTools: 'HiOutlineWrench', HiOutlineMail: 'HiOutlineEnvelope', HiOutlineDesktop: 'HiOutlineComputerDesktop', HiOutlineOffice: 'HiOutlineBuildingOffice', HiOutlineLocationMarker: 'HiOutlineMapPin' };
    for (const [bad, good] of Object.entries(iconFixes)) {
      if (content.includes(bad)) { content = content.replaceAll(bad, good); changed = true; }
    }

    // Fix: Remove onError from Image components (breaks Server Components)
    if (content.includes('onError') && content.includes('<Image')) {
      content = content.replace(/\s*onError=\{[^}]*\{[^}]*\}[^}]*\}/g, '');
      content = content.replace(/\s*onError=\{[^}]*\}/g, '');
      changed = true;
    }

    // Fix: Add 'use client' if interactive
    if ((content.includes('onClick') || content.includes('onChange') || content.includes('useState') || content.includes('useEffect')) && !content.includes("'use client'") && !content.includes('"use client"')) {
      content = "'use client';\n\n" + content;
      changed = true;
    }

    // Fix: Remove SVG data URIs
    if (content.includes('data:image/svg+xml')) {
      content = content.replace(/bg-\[url\('data:image\/svg\+xml[^']*'\)\]/g, 'bg-gradient-to-br from-amber-500/10 to-transparent');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
      fixCount++;
    }
  }

  // Check planned pages exist
  if (state.websitePlan && state.websitePlan.pages) {
    for (const page of state.websitePlan.pages) {
      const slug = (page.slug || page.title || '').toLowerCase().replace(/^\/+/, '').replace(/\s+/g, '-').trim();
      if (!slug || slug === 'home') continue;
      const pageDir = path.join(projectDir, 'src', 'app', slug);
      const pagePath = path.join(pageDir, 'page.jsx');
      if (!fs.existsSync(pagePath)) {
        fs.mkdirSync(pageDir, { recursive: true });
        const businessName = state.businessData?.name || 'Business';
        const phone = state.businessData?.phone || '';
        const address = state.businessData?.address || '';
        let content;
        if (slug === 'contact') content = generateContactPage(businessName, phone, address);
        else if (slug === 'about') content = generateAboutPage(businessName, address);
        else content = generateGenericPage(slug, businessName);
        fs.writeFileSync(pagePath, content, 'utf-8');
        fixCount++;
      }
    }
  }

  if (fixCount > 0) console.log(chalk.yellow(`    Fixed ${fixCount} files`));
}

function findAllJsx(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...findAllJsx(full));
      else if (entry.name.endsWith('.jsx')) results.push(full);
    }
  } catch {}
  return results;
}

async function testAllPages(projectDir, port, state) {
  const errors = [];

  // Get all page routes from file system
  const appDir = path.join(projectDir, 'src', 'app');
  const routes = ['/'];
  findRoutes(appDir, '', routes);

  // Also check planned pages from websitePlan
  if (state.websitePlan && state.websitePlan.pages) {
    for (const page of state.websitePlan.pages) {
      const slug = page.slug || page.title?.toLowerCase().replace(/\s+/g, '-');
      if (slug && slug !== 'home' && !routes.includes(`/${slug}`)) {
        routes.push(`/${slug}`);
      }
    }
  }

  // Check navigation links too
  if (state.websitePlan && state.websitePlan.navigation) {
    for (const nav of state.websitePlan.navigation) {
      const href = nav.href || '';
      if (href.startsWith('/') && !routes.includes(href)) {
        routes.push(href);
      }
    }
  }

  // Start temp server
  let serverProcess;
  try {
    serverProcess = spawn('npx', ['next', 'dev', '-p', String(port)], {
      cwd: projectDir,
      stdio: 'pipe',
    });

    await waitForServer(port, 15000);

    // Test each route
    for (const route of routes) {
      const status = await checkRoute(port, route);
      if (status === 404) {
        errors.push({ route, issue: 'page not found (404)', status });
      } else if (status === 500) {
        errors.push({ route, issue: 'server error (500)', status });
      }
    }
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return errors;
}

function findRoutes(dir, prefix, routes) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
        const route = `${prefix}/${entry.name}`;
        const hasPage = fs.existsSync(path.join(dir, entry.name, 'page.jsx')) ||
                       fs.existsSync(path.join(dir, entry.name, 'page.js'));
        if (hasPage) routes.push(route);
        findRoutes(path.join(dir, entry.name), route, routes);
      }
    }
  } catch {}
}

function waitForServer(port, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}`, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Server start timeout'));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

function checkRoute(port, route) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}${route}`, (res) => {
      res.destroy();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(500));
    req.setTimeout(10000, () => { req.destroy(); resolve(500); });
    req.end();
  });
}

function fixPageIssue(err, projectDir, state) {
  const route = err.route;
  const slug = route.replace(/^\//, '') || 'home';

  if (err.status === 404) {
    // Page file doesn't exist — create it
    const pageDir = path.join(projectDir, 'src', 'app', slug);
    const pagePath = path.join(pageDir, 'page.jsx');

    if (!fs.existsSync(pagePath)) {
      fs.mkdirSync(pageDir, { recursive: true });

      const businessName = state.businessData?.name || 'Business';
      const phone = state.businessData?.phone || '';
      const address = state.businessData?.address || '';

      let content;
      if (slug === 'contact') {
        content = generateContactPage(businessName, phone, address);
      } else if (slug === 'about') {
        content = generateAboutPage(businessName, address);
      } else {
        content = generateGenericPage(slug, businessName);
      }

      fs.writeFileSync(pagePath, content, 'utf-8');
    }
  } else if (err.status === 500) {
    // Fix ALL jsx files (page + components) — 500 can come from any file
    const filesToFix = [
      path.join(projectDir, 'src', 'app', slug, 'page.jsx'),
      path.join(projectDir, 'src', 'app', 'page.jsx'),
      path.join(projectDir, 'src', 'components', 'Header.jsx'),
      path.join(projectDir, 'src', 'components', 'Footer.jsx'),
      path.join(projectDir, 'src', 'app', 'layout.jsx'),
    ];

    for (const filePath of filesToFix) {
      if (!fs.existsSync(filePath)) continue;
      let content = fs.readFileSync(filePath, 'utf-8');
      let changed = false;

      // Fix: Remove Header/Footer imports from pages
      if (filePath.includes('/app/') && filePath.includes('page.jsx')) {
        const before = content;
        content = content.replace(/import\s+Header\s+from\s+['"][^'"]+['"];?\n?/g, '');
        content = content.replace(/import\s+Footer\s+from\s+['"][^'"]+['"];?\n?/g, '');
        content = content.replace(/<Header\s*\/?\s*>/g, '');
        content = content.replace(/<Footer\s*\/?\s*>/g, '');
        content = content.replace(/<\/Header>/g, '');
        content = content.replace(/<\/Footer>/g, '');
        if (content !== before) changed = true;
      }

      // Fix: Wrong relative imports
      if (content.match(/from\s+['"]\.\.\/components\//)) {
        content = content.replace(/from\s+['"]\.\.\/components\//g, "from '@/components/");
        content = content.replace(/from\s+['"]\.\.\/\.\.\/components\//g, "from '@/components/");
        changed = true;
      }

      // Fix: Invalid react-icons
      const iconFixes = { HiOutlineTools: 'HiOutlineWrench', HiOutlineMail: 'HiOutlineEnvelope', HiOutlineDesktop: 'HiOutlineComputerDesktop', HiOutlineOffice: 'HiOutlineBuildingOffice', HiOutlineLocationMarker: 'HiOutlineMapPin' };
      for (const [bad, good] of Object.entries(iconFixes)) {
        if (content.includes(bad)) { content = content.replaceAll(bad, good); changed = true; }
      }

      // Fix: Remove onError from Image (breaks Server Components)
      if (content.includes('onError') && content.includes('<Image')) {
        content = content.replace(/\s*onError=\{[^}]*\{[^}]*\}[^}]*\}/g, '');
        content = content.replace(/\s*onError=\{[^}]*\}/g, '');
        changed = true;
      }

      // Fix: Add 'use client' if using interactive features (useState, useEffect, onClick, onChange)
      if ((content.includes('useState') || content.includes('useEffect') || content.includes('onClick') || content.includes('onChange')) && !content.includes("'use client'") && !content.includes('"use client"')) {
        content = "'use client';\n\n" + content;
        changed = true;
      }

      // Fix: Remove SVG data URIs
      if (content.includes('data:image/svg+xml')) {
        content = content.replace(/bg-\[url\('data:image\/svg\+xml[^']*'\)\]/g, 'bg-gradient-to-br from-amber-500/10 to-transparent');
        changed = true;
      }

      if (changed) fs.writeFileSync(filePath, content, 'utf-8');
    }
  }
}

function generateContactPage(businessName, phone, address) {
  return `'use client';

import { useState } from 'react';
import { HiOutlineMapPin, HiOutlinePhone, HiOutlineClock, HiOutlineEnvelope } from 'react-icons/hi2';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-gray-300">Get in touch for inquiries and orders.</p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-2xl font-bold mb-6">Send a Message</h2>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <p className="text-green-800 font-semibold">Message sent! We will contact you soon.</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
                <input type="text" required placeholder="Your Name" className="w-full px-4 py-3 border rounded-lg" />
                <input type="tel" required placeholder="Phone Number" className="w-full px-4 py-3 border rounded-lg" />
                <textarea rows={4} required placeholder="Your Message" className="w-full px-4 py-3 border rounded-lg" />
                <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800">Send Message</button>
              </form>
            )}
          </div>
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-5 bg-gray-50 rounded-xl">
              <HiOutlineMapPin className="w-6 h-6 text-gray-700 mt-0.5" />
              <div><h3 className="font-semibold">Address</h3><p className="text-gray-600">${address}</p></div>
            </div>
            <div className="flex items-start gap-4 p-5 bg-gray-50 rounded-xl">
              <HiOutlinePhone className="w-6 h-6 text-gray-700 mt-0.5" />
              <div><h3 className="font-semibold">Phone</h3><a href="tel:${phone}" className="text-gray-600">${phone}</a></div>
            </div>
            <div className="flex items-start gap-4 p-5 bg-gray-50 rounded-xl">
              <HiOutlineClock className="w-6 h-6 text-gray-700 mt-0.5" />
              <div><h3 className="font-semibold">Hours</h3><p className="text-gray-600">Mon-Sat: 9AM - 7:30PM</p></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}`;
}

function generateAboutPage(businessName, address) {
  return `export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About ${businessName}</h1>
          <p className="text-xl text-gray-300">Your trusted partner for quality products and services.</p>
        </div>
      </section>
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">Our Story</h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">${businessName} has been proudly serving customers with dedication to quality and service excellence. Located at ${address}, we are committed to providing the best products at competitive prices.</p>
            <p className="text-gray-600 text-lg leading-relaxed">Our experienced team is ready to assist you with all your requirements. Visit us today or contact us to learn more about how we can help.</p>
          </div>
        </div>
      </section>
    </div>
  );
}`;
}

function generateGenericPage(slug, businessName) {
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `export default function ${title.replace(/\s/g, '')}Page() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">${title}</h1>
          <p className="text-xl text-gray-300">${businessName} — ${title}</p>
        </div>
      </section>
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600 text-lg">Content for ${title} page. Contact us for more information.</p>
        </div>
      </section>
    </div>
  );
}`;
}

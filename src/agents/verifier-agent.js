import { BaseAgent } from './base.js';
import { createVerificationIssue, createVerificationResult } from '../models/generated-code.js';
import { PipelineStage } from '../models/pipeline-state.js';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const REVIEW_SYSTEM_PROMPT = `You are a senior code reviewer specializing in Next.js and JavaScript. Review the generated code for issues.

Check for:
1. Missing imports or undefined references
2. Invalid JSX syntax
3. Missing required files (layout.jsx, page.jsx)
4. Broken component references (importing components that don't exist)
5. Invalid Tailwind classes
6. Missing or incorrect Next.js conventions (metadata export, default exports)
7. Runtime errors (accessing undefined properties, missing props)
8. Any TypeScript syntax that should not be there (this is a JS-only project)

Return a JSON object:
{
    "is_valid": true/false,
    "issues": [
        {
            "file_path": "src/app/page.jsx",
            "line": 15,
            "message": "description of issue",
            "severity": "error" or "warning",
            "suggestion": "how to fix it"
        }
    ]
}

Only report real issues that would cause build failures or runtime errors.
Return ONLY valid JSON.`;

export class VerifierAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.name = 'VerifierAgent';
  }

  async run(state) {
    if (!state.generatedFiles || state.generatedFiles.files.length === 0) {
      state.errors.push('No generated files to verify');
      state.stage = PipelineStage.FAILED;
      return state;
    }

    state.stage = PipelineStage.VERIFICATION;
    this.log(`Verifying ${state.generatedFiles.files.length} files...`);

    try {
      const structureIssues = this.checkStructure(state);
      this.log(`Structure check: ${structureIssues.length} issues`);

      // Quick syntax check — no npm install/build (saves 2-3 min)
      const syntaxIssues = this.checkSyntax(state);
      this.log(`Syntax check: ${syntaxIssues.length} issues`);

      const allIssues = [...structureIssues, ...syntaxIssues];
      const errorCount = allIssues.filter(i => i.severity === 'error').length;

      state.verificationResult = createVerificationResult(
        errorCount === 0,
        allIssues,
        ''
      );

      this.log(`Verification: ${errorCount} errors, ${allIssues.length - errorCount} warnings`);
      return state;
    } catch (error) {
      state.errors.push(`Verification failed: ${error.message}`);
      state.stage = PipelineStage.FAILED;
      this.log(`Error: ${error.message}`);
      return state;
    }
  }

  checkStructure(state) {
    const issues = [];
    const paths = new Set(state.generatedFiles.files.map(f => f.path));

    const required = ['package.json', 'next.config.js', 'tailwind.config.js'];
    for (const req of required) {
      if (!paths.has(req)) {
        issues.push(createVerificationIssue(req, 0, `Missing required file: ${req}`, 'error'));
      }
    }

    const hasLayout = [...paths].some(p => p.includes('layout.jsx') || p.includes('layout.js'));
    if (!hasLayout) {
      issues.push(createVerificationIssue('src/app/layout.jsx', 0, 'Missing root layout.jsx', 'error'));
    }

    const hasPage = [...paths].some(p => (p.endsWith('page.jsx') || p.endsWith('page.js')) && p.includes('app'));
    if (!hasPage) {
      issues.push(createVerificationIssue('src/app/page.jsx', 0, 'Missing home page.jsx', 'error'));
    }

    for (const f of state.generatedFiles.files) {
      if (!f.content.trim()) {
        issues.push(createVerificationIssue(f.path, 0, 'File has empty content', 'error'));
      }
    }

    // Check layout has <html> and <body>
    const layoutFile = state.generatedFiles.files.find(f => f.path.includes('layout.jsx'));
    if (layoutFile) {
      if (!layoutFile.content.includes('<html')) {
        issues.push(createVerificationIssue(layoutFile.path, 0, 'Layout missing <html> tag', 'error'));
      }
      if (!layoutFile.content.includes('<body')) {
        issues.push(createVerificationIssue(layoutFile.path, 0, 'Layout missing <body> tag', 'error'));
      }
      if (!layoutFile.content.includes('lang="en"') && !layoutFile.content.includes("lang='en'")) {
        issues.push(createVerificationIssue(layoutFile.path, 0, 'Layout missing lang="en"', 'error'));
      }
    }

    // Check planned pages exist
    if (state.websitePlan && state.websitePlan.pages) {
      for (const page of state.websitePlan.pages) {
        const slug = page.slug || page.title?.toLowerCase().replace(/\s+/g, '-');
        if (!slug || slug === 'home') continue;
        const pagePath = `src/app/${slug}/page.jsx`;
        if (!paths.has(pagePath)) {
          issues.push(createVerificationIssue(pagePath, 0, `Planned page "${slug}" was not generated`, 'error'));
        }
      }
    }

    return issues;
  }

  checkSyntax(state) {
    const issues = [];
    const allPaths = new Set(state.generatedFiles.files.map(f => f.path));

    // Known invalid react-icons/hi2 exports
    const invalidHi2Icons = ['HiOutlineTools', 'HiOutlineMail', 'HiOutlineDesktop', 'HiOutlineOffice', 'HiOutlineLocationMarker', 'HiOutlineMailOpen'];

    for (const file of state.generatedFiles.files) {
      if (!file.path.endsWith('.jsx') && !file.path.endsWith('.js')) continue;
      if (file.path === 'next.config.js' || file.path === 'tailwind.config.js' || file.path === 'postcss.config.js') continue;

      const content = file.content;

      // Check for SVG data URIs that break JSX
      if (content.includes('data:image/svg+xml')) {
        issues.push(createVerificationIssue(file.path, 0, 'Contains inline SVG data URI — breaks JSX parsing', 'error'));
      }

      // Check for missing 'use client' when using interactive features
      if ((content.includes('onClick') || content.includes('onChange') || content.includes('useState') || content.includes('useEffect')) && !content.includes("'use client'") && !content.includes('"use client"')) {
        issues.push(createVerificationIssue(file.path, 0, 'Uses interactive features (onClick/useState) but missing "use client" directive', 'error'));
      }

      // Check for fallback/placeholder content
      if (content.includes('Coming Soon') && content.length < 200) {
        issues.push(createVerificationIssue(file.path, 0, 'File has fallback placeholder content — generation failed', 'error'));
      }

      // Check for default export in page/layout files
      if (file.path.includes('/app/') && (file.path.includes('page.') || file.path.includes('layout.'))) {
        if (!content.includes('export default')) {
          issues.push(createVerificationIssue(file.path, 0, 'Missing export default', 'error'));
        }
      }

      // Check for truncated content (incomplete braces)
      const opens = (content.match(/\{/g) || []).length;
      const closes = (content.match(/\}/g) || []).length;
      if (Math.abs(opens - closes) > 2) {
        issues.push(createVerificationIssue(file.path, 0, 'Unbalanced braces — file may be truncated', 'error'));
      }

      // Check for wrong relative imports (should use @/components/)
      if (file.path.includes('/app/') && content.match(/from\s+['"]\.\.\/components\//)) {
        issues.push(createVerificationIssue(file.path, 0, 'Using relative import ../components/ — must use @/components/', 'error'));
      }

      // Check pages don't import Header/Footer (layout handles it)
      if (file.path.includes('/app/') && file.path.includes('page.')) {
        if (content.includes("import Header") || content.includes("import Footer")) {
          issues.push(createVerificationIssue(file.path, 0, 'Page imports Header/Footer — remove (layout.jsx already renders them)', 'error'));
        }
      }

      // Check for invalid react-icons/hi2 imports
      for (const icon of invalidHi2Icons) {
        if (content.includes(icon)) {
          issues.push(createVerificationIssue(file.path, 0, `Invalid icon "${icon}" — does not exist in react-icons/hi2`, 'error'));
        }
      }

      // Check imports reference existing files
      const importMatches = content.matchAll(/from\s+['"](@\/|\.\.?\/)([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[2];
        if (importPath.startsWith('components/') || importPath.startsWith('./components/')) {
          const componentFile = `src/components/${importPath.replace('./components/', '').replace('../components/', '')}`;
          const withExt = componentFile.endsWith('.jsx') ? componentFile : `${componentFile}.jsx`;
          const withoutExt = componentFile.replace('.jsx', '');
          if (!allPaths.has(withExt) && !allPaths.has(`${withoutExt}.jsx`) && !allPaths.has(`${withoutExt}.js`)) {
            issues.push(createVerificationIssue(file.path, 0, `Imports missing component: ${importPath}`, 'error'));
          }
        }
      }
    }

    return issues;
  }

  async llmReview(state) {
    const fileSummary = state.generatedFiles.files
      .slice(0, 15)
      .map(f => `--- ${f.path} ---\n${f.content.slice(0, 1000)}`)
      .join('\n\n')
      .slice(0, 14000);

    try {
      const result = await this.callLLMJson(REVIEW_SYSTEM_PROMPT, [
        { role: 'user', content: `Review this generated Next.js project:\n\n${fileSummary}` },
      ]);

      if (!result.issues || !Array.isArray(result.issues)) return [];

      return result.issues.map(i => createVerificationIssue(
        i.file_path || '',
        i.line || 0,
        i.message || '',
        'warning',
        i.suggestion || ''
      ));
    } catch {
      return [createVerificationIssue('', 0, 'LLM review failed to parse', 'warning')];
    }
  }

  async buildCheck(state) {
    const tempDir = path.join(tmpdir(), `agent-web-verify-${Date.now()}`);
    let buildOutput = '';
    const buildIssues = [];

    try {
      await fs.mkdir(tempDir, { recursive: true });

      for (const file of state.generatedFiles.files) {
        const filePath = path.join(tempDir, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
      }

      try {
        execSync('npm install --legacy-peer-deps', {
          cwd: tempDir,
          timeout: 60000,
          stdio: 'pipe',
        });
      } catch (err) {
        const output = err.stderr?.toString() || err.stdout?.toString() || '';
        buildIssues.push(createVerificationIssue(
          'package.json', 0,
          `npm install failed: ${output.slice(0, 200)}`,
          'warning'
        ));
        return { buildIssues, buildOutput: output };
      }

      try {
        const buildResult = execSync('npx next build 2>&1', {
          cwd: tempDir,
          timeout: 120000,
          stdio: 'pipe',
        });
        buildOutput = buildResult.toString();

        if (buildOutput.includes("Can't resolve")) {
          const missingModules = [...buildOutput.matchAll(/Can't resolve '([^']+)'/g)].map(m => m[1]);
          if (missingModules.length > 0) {
            try {
              execSync(`npm install ${missingModules.join(' ')} --legacy-peer-deps`, {
                cwd: tempDir,
                timeout: 60000,
                stdio: 'pipe',
              });
              execSync('npx next build', { cwd: tempDir, timeout: 120000, stdio: 'pipe' });
              buildOutput = 'Build successful (after installing missing deps)';
            } catch {}
          }
        } else {
          buildOutput = 'Build successful';
        }
      } catch (err) {
        buildOutput = err.stderr?.toString() || err.stdout?.toString() || '';

        const missingModules = [...buildOutput.matchAll(/Can't resolve '([^']+)'/g)].map(m => m[1]);
        if (missingModules.length > 0) {
          try {
            execSync(`npm install ${missingModules.join(' ')} --legacy-peer-deps`, {
              cwd: tempDir,
              timeout: 60000,
              stdio: 'pipe',
            });
            execSync('npx next build', { cwd: tempDir, timeout: 120000, stdio: 'pipe' });
            buildOutput = 'Build successful (after installing missing deps)';
            return { buildIssues, buildOutput };
          } catch (retryErr) {
            buildOutput = retryErr.stderr?.toString() || retryErr.stdout?.toString() || buildOutput;
          }
        }

        const errorLines = buildOutput.split('\n').filter(l => l.includes('Error:') || l.includes('error'));
        for (const line of errorLines.slice(0, 10)) {
          const fileMatch = line.match(/(?:\.\/)?([^\s:]+\.(jsx?|js)):?(\d+)?/);
          buildIssues.push(createVerificationIssue(
            fileMatch ? fileMatch[1] : '',
            fileMatch?.[3] ? parseInt(fileMatch[3]) : 0,
            line.trim().slice(0, 200),
            'error'
          ));
        }
      }
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    }

    return { buildIssues, buildOutput };
  }
}

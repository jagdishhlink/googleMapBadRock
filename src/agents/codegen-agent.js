import { BaseAgent } from './base.js';
import { createGeneratedFile, createProjectFiles } from '../models/generated-code.js';
import { PipelineStage, WebsiteMode } from '../models/pipeline-state.js';
import { generateStaticFiles } from '../templates/static-files.js';
import { matchDesignSystem, getDesignContext } from '../templates/design-matcher.js';

const BULK_SYSTEM_PROMPT = `You are an expert Next.js 14 developer. Generate a COMPLETE multi-page website in one response.

OUTPUT FORMAT: Return a JSON object where each key is a file path and the value is the complete file content as a string.

Example format:
{
  "src/app/layout.jsx": "import ... export default function RootLayout...",
  "src/app/page.jsx": "export default function Home() { return (...) }",
  "src/components/Header.jsx": "..."
}

RULES:
- JavaScript ONLY — no TypeScript, no .ts/.tsx
- Use .jsx for React components
- Tailwind CSS for ALL styling — no CSS modules, no styled-components
- COMPLETE production code — no placeholders, no "// add more", no "..."
- Export default for all page components and layout
- Each page must be self-contained with all sections inline
- Use react-icons for icons (import from react-icons/hi2 or react-icons/fi)
- Use Next.js Image component for images with src="/images/business-N.jpg" (N=1 to 10), add unoptimized prop
- EVERY Image MUST be wrapped in a parent div with a gradient background as fallback (e.g. className="relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900"). If the image fails to load, the gradient shows through. Do NOT use onError handlers.
- Make it modern, responsive, mobile-first
- Include proper metadata export in layout.jsx
- NO external API calls, NO dynamic data fetching — all content is hardcoded from business data
- ENGLISH ONLY — all text, labels, buttons, metadata must be in English. No i18n, no locale switching, no language toggle, no multi-language support
- html lang="en" in layout.jsx

Return ONLY the JSON object. No markdown fences, no explanation.`;

const FILE_GEN_SYSTEM_PROMPT = `You are a Senior UI Developer at a premium digital agency. You build custom $10,000+ websites. Generate the COMPLETE content for a single file.

DESIGN QUALITY RULES:
- This must look CUSTOM-BUILT, not template-based
- Use creative Tailwind compositions — asymmetric layouts, overlapping elements, gradient meshes, creative spacing
- Vary section layouts — NEVER repeat the same grid pattern twice on a page
- Use large typography for impact (text-5xl, text-6xl, text-7xl for heroes)
- Apply micro-interactions where appropriate (hover transforms, transitions, group-hover effects)
- Use creative color applications — gradients, overlays, semi-transparent backgrounds
- White space is a design tool — use generous padding (py-24, py-32) between sections
- Mix full-bleed sections with contained sections
- Use backdrop-blur, shadows with color (shadow-primary/20), rounded-2xl/3xl for modern feel

TECHNICAL RULES:
- JavaScript ONLY — no TypeScript, no .ts/.tsx
- .jsx for React components
- Tailwind CSS for all styling — use arbitrary values like bg-[#hex] for design system colors
- COMPLETE production code — no placeholders, no "..."
- Export default for page/layout components
- Self-contained pages with ALL sections inline (no sub-component imports except Header/Footer in layout)
- Use react-icons (from react-icons/hi2 or react-icons/fi) — VALID icons only: HiOutlinePhone, HiOutlineMapPin, HiOutlineClock, HiOutlineEnvelope, HiOutlineStar, HiOutlineCheckCircle, HiOutlineArrowRight, HiOutlineChevronRight, HiOutlineBolt, HiOutlineWrench, HiOutlineShieldCheck, HiOutlineUserGroup, HiOutlineBuildingStorefront, HiOutlineTruck, HiOutlineSparkles, HiOutlineHeart
- Next.js Image component with src="/images/business-N.jpg" (N = 1 to 10), always add unoptimized prop
- EVERY Image MUST be inside a parent div with bg-gradient-to-br as fallback (e.g. className="relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900"). If image fails, gradient shows. Do NOT use onError handlers — they break Server Components.
- ENGLISH ONLY — all text in English, html lang="en"
- No i18n, no language toggle
- IMPORTS: Always use @/components/ path. NEVER use relative ../components/
- IMPORTANT: Header and Footer are in layout.jsx. Do NOT import or render them in page files.
- Add 'use client' at top if using useState, useEffect, or onClick handlers
- NEVER use inline SVG data URIs in className (bg-[url('data:image/svg+xml,...')]). Use Tailwind gradients instead.
- NEVER add floating chat widgets, live chat boxes, or fixed-position notification popups. Only a single WhatsApp float button (bottom-right) is allowed in layout.
- Layout MUST add pt-16 lg:pt-20 to the main element to offset the fixed header.
- Keep Footer clean and simple — company info, quick links, contact, copyright. No complex animations.

Return ONLY the file content. No markdown fences, no explanation.`;

const LANDING_PAGE_PROMPT = `You are a world-class Product Designer, UI/UX Architect, Creative Developer, and CRO Expert.

Generate an extremely modern, visually stunning, high-conversion HOME PAGE. This must feel like a custom $10,000+ agency-designed landing page — NOT a template.

CORE GOAL:
- Looks premium (Apple / Stripe / Framer level quality)
- Builds trust instantly in 3 seconds
- Converts visitors into calls/messages/bookings
- Feels dynamic, interactive, and alive
- Every pixel intentional — perfect 8px grid spacing

UI / VISUAL DIRECTION:

1. ULTRA MODERN HERO (full viewport height):
   - Bold typography: text-6xl md:text-7xl lg:text-8xl font-bold, tight leading-[0.9], negative letter-spacing
   - Animated gradient background using CSS: bg-gradient-to-br with animate-pulse or custom keyframes
   - Floating UI badges/cards with backdrop-blur-xl bg-white/10 border border-white/20 (glassmorphism)
   - Trust indicators: rating stars, review count, years badge — positioned as floating elements
   - Primary CTA (solid, large, rounded-2xl) + Secondary CTA (outline/ghost)
   - Depth illusion: overlapping layers, z-index stacking, shadow-2xl elements

2. SOCIAL PROOF ENGINE:
   - Google rating widget style (large number + stars + "Verified Reviews")
   - Animated stat counters: clients, years, projects (use large text-4xl font-bold)
   - Trust badges row with subtle border and icons
   - NOT a plain grid — use creative horizontal scroll or staggered layout

3. SERVICES (Highly Interactive):
   - Cards with group-hover:scale-105 group-hover:shadow-2xl transition-all duration-500
   - Gradient border on hover (via wrapper div technique)
   - "Most Popular" badge on key service
   - Icon with bg-gradient rounded-2xl container
   - Benefit-focused copy (not feature lists)

4. WHY CHOOSE US (Split Layout):
   - Asymmetric grid: large image left + benefits right (or reversed)
   - Animated counters for stats
   - Icon-based benefits with subtle color backgrounds
   - Overlapping elements for depth

5. GALLERY / VISUAL SHOWCASE:
   - Masonry-style or staggered grid (grid-rows-[span] technique)
   - Hover: scale-110 + brightness overlay + rounded-3xl
   - Use /images/business-1.jpg through business-6.jpg
   - Smooth lazy loading with blur placeholder

6. TESTIMONIALS (NOT basic cards):
   - Large quote marks, rating stars, highlighted keywords
   - Alternating card sizes (featured review larger)
   - Subtle gradient backgrounds per card
   - Real review text from data provided

7. PROCESS / HOW IT WORKS:
   - Numbered timeline with connecting gradient line
   - Steps as cards with large step numbers (text-6xl text-primary/10)
   - Icons per step, brief descriptions

8. FAQ (Interactive Accordion):
   - useState for expand/collapse
   - Smooth height transition (overflow-hidden + max-h with transition)
   - Chevron rotation on open
   - 5-6 SEO-optimized questions with real answers

9. FINAL CTA (Conversion-Focused):
   - Bold gradient background section
   - Large text-4xl headline with urgency
   - Multiple buttons: Call Now, WhatsApp, Get Quote
   - Floating decorative shapes for visual interest

10. CONTACT SECTION:
    - Clean grid: Phone (click-to-call), Address, Hours
    - Google Maps iframe embed
    - Business hours card with current open/closed status

MOTION DESIGN (CSS only, no libraries):
- Scroll-triggered reveals: use CSS animation + intersection observer pattern via 'animate' classes
- Hover effects: scale, translateY(-4px), shadow elevation, brightness
- Floating elements: animate-bounce (subtle), animate-pulse for badges
- Smooth transitions: transition-all duration-500 ease-out on EVERYTHING interactive
- Stagger children: delay-[100ms] delay-[200ms] delay-[300ms] on grid items

GLASSMORPHISM RECIPE:
- bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl

DEPTH RECIPE:
- Layer 1 (back): large gradient blob, blur-3xl, opacity-30
- Layer 2 (mid): content cards with shadow-xl
- Layer 3 (front): floating badges, overlapping elements

TECHNICAL RULES (STRICT):
- 'use client' at top
- JavaScript ONLY (.jsx)
- Tailwind CSS ONLY — use arbitrary values bg-[#hex] for theme colors
- react-icons/hi2 ONLY — VALID: HiOutlinePhone, HiOutlineMapPin, HiOutlineClock, HiOutlineEnvelope, HiOutlineStar, HiOutlineCheckCircle, HiOutlineArrowRight, HiOutlineChevronRight, HiOutlineBolt, HiOutlineWrench, HiOutlineShieldCheck, HiOutlineUserGroup, HiOutlineBuildingStorefront, HiOutlineTruck, HiOutlineSparkles, HiOutlineHeart, HiOutlineChevronDown
- Next.js Image: src="/images/business-N.jpg" (N = 1 to 10), ALWAYS add unoptimized prop
- EVERY Image MUST be inside a parent div with bg-gradient-to-br fallback (e.g. className="relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900"). NO onError handlers — they break Server Components.
- NO Header/Footer imports (layout renders them)
- NO floating widgets/popups
- NO inline SVG data URIs in className
- NO framer-motion import — use CSS transitions/animations ONLY
- NO react-three-fiber — use CSS 3D transforms (perspective, rotateX, rotateY) for depth
- NO shadcn import — build all components with Tailwind
- ALL code in ONE file — no external component imports
- Use MARKETING CONTENT from context (real headlines, real testimonials, real CTAs)

Return ONLY the complete file content. No markdown fences, no explanation.`;

const RETRY_SYSTEM_PROMPT = `You are an expert Next.js 14 developer. Fix errors in generated files.

Return a JSON object where each key is the file path and value is the CORRECTED complete file content.
JavaScript ONLY. No TypeScript. No markdown fences.

Return ONLY valid JSON.`;

export class CodeGenAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.name = 'CodeGenAgent';
  }

  async run(state) {
    if (!state.businessData || !state.websitePlan) {
      state.errors.push('Missing business data or website plan');
      state.stage = PipelineStage.FAILED;
      return state;
    }

    state.stage = PipelineStage.CODE_GENERATION;

    try {
      if (state.verificationResult && state.verificationResult.issues.length > 0) {
        return await this.retryGeneration(state);
      }
      return await this.initialGeneration(state);
    } catch (error) {
      state.errors.push(`Code generation failed: ${error.message}`);
      state.stage = PipelineStage.FAILED;
      this.log(`Error: ${error.message}`);
      return state;
    }
  }

  async initialGeneration(state) {
    this.log('Starting code generation (bulk mode)...');

    const staticFiles = generateStaticFiles(state.businessData);
    const files = staticFiles.map(f => createGeneratedFile(f.path, f.content, detectLanguage(f.path)));

    // Step 2: Generate layout + pages + components in 2 parallel bulk calls
    const context = this.buildContext(state);
    const plan = state.websitePlan;

    const pagesList = (plan.pages || [])
      .map(p => (p.slug || p.title || '').toLowerCase().replace(/^\/+/, '').replace(/\s+/g, '-').trim())
      .filter(p => p && p !== 'home' && p !== '/')
      .slice(0, 6);
    const pagesStr = ['home', ...pagesList].join(', ');

    // Split into 2 parallel calls: (layout+pages) and (components)
    // Build file list: layout + pages + Header + Footer
    // Theme brief — consistent colors across ALL files
    const theme = state.websitePlan?.theme || {};
    const themeBrief = `
CONSISTENT THEME (use these EXACT colors across ALL files):
- Primary color: ${theme.primary_color || '#d4af37'} (buttons, highlights, accents)
- Secondary/Dark: ${theme.secondary_color || '#1a1a1a'} (backgrounds, headers, footer)
- Accent: ${theme.accent_color || '#b8941f'} (hover states, secondary elements)
- Light background: bg-white or bg-gray-50
- Dark sections: bg-[${theme.secondary_color || '#1a1a1a'}]
- CTA buttons: bg-[${theme.primary_color || '#d4af37'}] text-black or text-white
- Section heroes: gradient using from-[${theme.secondary_color || '#1a1a1a'}] to-gray-800
- ALL pages must use these SAME colors — not random Tailwind defaults like blue-600 or indigo-500`;

    const fileJobs = [
      { path: 'src/app/layout.jsx', desc: `Root layout:
- <html lang="en">, <body> with Inter font from next/font/google
- Import Header and Footer from @/components/
- main element MUST have className="flex-grow pt-16 lg:pt-20" (offset for fixed header)
- body bg: bg-white or bg-[#fafafa]
- Full SEO metadata (title, description, openGraph)
- Only ONE WhatsApp float button (fixed bottom-right, small circle icon). NO other floating widgets.
- NO inline scripts, NO performance observers
${themeBrief}` },
      { path: 'src/app/page.jsx', desc: `Landing page — generate ALL sections from the landing page brief.\n${themeBrief}`, useLandingPrompt: true },
      ...pagesList.map(p => ({
        path: `src/app/${p}/page.jsx`,
        desc: `${p} page — unique premium content, creative sections. Self-contained, NO Header/Footer import.\n${themeBrief}`,
      })),
      { path: 'src/components/Header.jsx', desc: `Fixed header (fixed top-0, z-50):
- Background: bg-[${theme.secondary_color || '#1a1a1a'}] (dark)
- Logo text in white, accent color for subtitle
- MAX 6 nav links in center: ${pagesStr}
- Active link uses primary color bg-[${theme.primary_color || '#d4af37'}] text-black
- Phone number + ONE CTA button (primary color) on right
- Mobile: hamburger menu with slide-down panel
- Must use 'use client' with useState for mobile menu
- Keep SIMPLE — no dropdowns, no sub-menus, no top info bar
${themeBrief}` },
      { path: 'src/components/Footer.jsx', desc: `Premium footer design with bg-[${theme.secondary_color || '#1a1a1a'}]:

STRUCTURE:
- Top section: Large brand name (text-3xl font-bold) + tagline + primary color accent line below
- Main grid (4 columns on desktop, stack on mobile):
  Col 1: Business description (2-3 lines), trust badges row (e.g. "Established 2008", "4.3★ Rated")
  Col 2: Quick Links — navigation links with hover:text-[${theme.primary_color || '#d4af37'}] transition
  Col 3: Services/Categories — top services/products listed
  Col 4: Contact — phone (clickable), address, business hours with clock icon
- CTA banner above copyright: gradient bg from-[${theme.primary_color || '#d4af37'}] to-[${theme.accent_color || '#b8941f'}] with "Get in Touch" + phone button
- Copyright bar: border-t border-white/10, flex between copyright text and "Back to top" link

STYLING:
- Text: text-gray-400 for body, text-white for headings
- Links: text-gray-400 hover:text-[${theme.primary_color || '#d4af37'}] transition-colors
- Section title: text-white font-semibold text-lg mb-4 with small primary color bar underneath (w-8 h-0.5)
- Generous padding: py-16 lg:py-20
- Subtle top border: border-t border-white/5

${themeBrief}` },
    ];

    // Groq has rate limits — use smaller batches and add delay
    const isGroq = this.config.llmProvider === 'groq' || this.config.llmProvider === 'groq-with-fallback';
    const BATCH_SIZE = isGroq ? 2 : 3;
    const BATCH_DELAY = isGroq ? 5000 : 0; // 5s delay between batches for Groq

    const agent = this;
    this.log(`Generating ${fileJobs.length} files (${BATCH_SIZE} parallel${isGroq ? ', Groq rate-limited' : ''})...`);

    for (let i = 0; i < fileJobs.length; i += BATCH_SIZE) {
      if (i > 0 && BATCH_DELAY > 0) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
      const batch = fileJobs.slice(i, i + BATCH_SIZE);
      agent.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map(f => f.path.split('/').pop()).join(', ')}`);

      const results = await Promise.all(
        batch.map(job => {
          const systemPrompt = job.useLandingPrompt ? LANDING_PAGE_PROMPT : FILE_GEN_SYSTEM_PROMPT;
          const msg = `${context}\n\nGenerate the COMPLETE content for: ${job.path}\nDescription: ${job.desc}\n\nAll project files: ${fileJobs.map(f => f.path).join(', ')}`;
          return agent.callLLM(systemPrompt, [{ role: 'user', content: msg }])
            .then(raw => {
              const content = stripFences(raw);
              agent.log(`    ✓ ${job.path} (${content.length} chars)`);
              return createGeneratedFile(job.path, content, detectLanguage(job.path));
            })
            .catch(err => {
              agent.log(`    ✗ ${job.path} FAILED: ${err.message}`);
              return null;
            });
        })
      );

      // Retry failed files one at a time (with delay for Groq)
      for (let j = 0; j < results.length; j++) {
        if (!results[j]) {
          if (BATCH_DELAY > 0) await new Promise(r => setTimeout(r, BATCH_DELAY));
          const job = batch[j];
          agent.log(`    Retrying: ${job.path}`);
          try {
            const msg = `${context}\n\nGenerate the COMPLETE content for: ${job.path}\nDescription: ${job.desc}`;
            const raw = await agent.callLLM(FILE_GEN_SYSTEM_PROMPT, [{ role: 'user', content: msg }]);
            results[j] = createGeneratedFile(job.path, stripFences(raw), detectLanguage(job.path));
            agent.log(`    ✓ ${job.path} (retry success)`);
          } catch (err) {
            agent.log(`    ✗ ${job.path} retry failed: ${err.message}`);
            results[j] = createGeneratedFile(job.path, getFallbackContent(job.path), 'javascript');
          }
        }
      }

      files.push(...results);
    }

    const { dependencies, devDependencies } = this.extractDeps(files);
    state.generatedFiles = createProjectFiles(files, dependencies, devDependencies);
    this.log(`Generated ${files.length} files total`);
    return state;
  }

  async generateBulk(context, fileInstructions) {
    const userMessage = `${context}\n\n${fileInstructions}`;

    const raw = await this.callLLM(BULK_SYSTEM_PROMPT, [
      { role: 'user', content: userMessage },
    ]);

    const parsed = this.parseBulkResponse(raw);
    if (!parsed) return [];

    return Object.entries(parsed).map(([filePath, content]) =>
      createGeneratedFile(filePath, content, detectLanguage(filePath))
    );
  }

  parseBulkResponse(raw) {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

    try {
      return JSON.parse(cleaned.trim());
    } catch {
      // Try to find JSON object in response
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {}
      }
      return null;
    }
  }

  async retryGeneration(state) {
    this.log('Retrying failed files...');

    const issues = state.verificationResult.issues.filter(i => i.severity === 'error');
    if (issues.length === 0) return state;

    // Step 1: Auto-fix issues that don't need API calls
    let autoFixed = 0;
    for (const file of state.generatedFiles.files) {
      const fileIssues = issues.filter(i => i.filePath === file.path);
      if (fileIssues.length === 0) continue;

      let content = file.content;
      let fixed = false;

      // Fix: Remove Header/Footer imports from pages
      if (fileIssues.some(i => i.message.includes('imports Header/Footer'))) {
        content = content.replace(/import\s+Header\s+from\s+['"][^'"]+['"];?\n?/g, '');
        content = content.replace(/import\s+Footer\s+from\s+['"][^'"]+['"];?\n?/g, '');
        content = content.replace(/<Header\s*\/?\s*>/g, '').replace(/<\/Header>/g, '');
        content = content.replace(/<Footer\s*\/?\s*>/g, '').replace(/<\/Footer>/g, '');
        fixed = true;
      }

      // Fix: Replace relative imports with @/components/
      if (fileIssues.some(i => i.message.includes('../components/'))) {
        content = content.replace(/from\s+['"]\.\.\/components\//g, "from '@/components/");
        content = content.replace(/from\s+['"]\.\.\/\.\.\/components\//g, "from '@/components/");
        fixed = true;
      }

      // Fix: Remove SVG data URIs that break JSX
      if (content.includes("data:image/svg+xml")) {
        content = content.replace(/bg-\[url\('data:image\/svg\+xml[^']*'\)\]/g, 'bg-gradient-to-br from-amber-500/10 to-transparent');
        fixed = true;
      }

      // Fix: Replace invalid react-icons
      const iconReplacements = {
        'HiOutlineTools': 'HiOutlineWrench',
        'HiOutlineMail': 'HiOutlineEnvelope',
        'HiOutlineDesktop': 'HiOutlineComputerDesktop',
        'HiOutlineOffice': 'HiOutlineBuildingOffice',
        'HiOutlineLocationMarker': 'HiOutlineMapPin',
        'HiOutlineMailOpen': 'HiOutlineEnvelopeOpen',
      };
      for (const [bad, good] of Object.entries(iconReplacements)) {
        if (content.includes(bad)) {
          content = content.replaceAll(bad, good);
          fixed = true;
        }
      }

      // Fix: Add 'use client' if using interactive features
      if ((content.includes('onClick') || content.includes('onChange') || content.includes('useState') || content.includes('useEffect')) && !content.includes("'use client'") && !content.includes('"use client"')) {
        content = "'use client';\n\n" + content;
        fixed = true;
      }

      if (fixed) {
        file.content = content;
        autoFixed++;
      }
    }
    this.log(`Auto-fixed ${autoFixed} files`);

    // Step 2: Regenerate files that need API call (fallback content, missing pages, broken layout)
    const needsRegeneration = issues.filter(i =>
      i.message.includes('fallback placeholder') ||
      i.message.includes('was not generated') ||
      i.message.includes('missing <html>') ||
      i.message.includes('missing <body>')
    );

    if (needsRegeneration.length > 0) {
      const context = this.buildContext(state);
      const agent = this;
      const filesToRegen = [...new Set(needsRegeneration.map(i => i.filePath).filter(Boolean))];

      this.log(`Regenerating ${filesToRegen.length} files via API...`);

      for (const filePath of filesToRegen) {
        const desc = filePath.includes('layout')
          ? 'Root layout with <html lang="en">, <body>, Header/Footer from @/components, Inter font, metadata'
          : `Full page content for ${filePath.split('/').slice(-2, -1)[0] || 'home'} — self-contained, no Header/Footer import`;

        try {
          const msg = `${context}\n\nGenerate the COMPLETE content for: ${filePath}\nDescription: ${desc}`;
          const raw = await agent.callLLM(FILE_GEN_SYSTEM_PROMPT, [{ role: 'user', content: msg }]);
          const content = stripFences(raw);

          const idx = state.generatedFiles.files.findIndex(f => f.path === filePath);
          if (idx >= 0) {
            state.generatedFiles.files[idx].content = content;
          } else {
            state.generatedFiles.files.push(createGeneratedFile(filePath, content, detectLanguage(filePath)));
          }
          agent.log(`  ✓ Regenerated: ${filePath}`);
        } catch (err) {
          agent.log(`  ✗ Failed: ${filePath} — ${err.message}`);
        }
      }
    }

    this.log('Retry complete');
    return state;
  }

  buildContext(state) {
    const bd = state.businessData;
    const plan = state.websitePlan;

    const imageList = Array.from({ length: 10 }, (_, i) => `/images/business-${i + 1}.jpg`);

    // Build image context — tell LLM which are real business photos
    let imageContext = '';
    if (state.websiteMode === 'redesign' && state.existingWebsite?.allImages?.length > 0) {
      const realImageCount = Math.min(state.existingWebsite.allImages.length, 10);
      const imgDescriptions = state.existingWebsite.allImages.slice(0, 10).map((img, i) =>
        `  /images/business-${i + 1}.jpg — REAL business photo: "${img.alt || img.page || 'business image'}"`
      ).join('\n');
      imageContext = `IMAGE SOURCES (first ${realImageCount} are REAL business photos — use them in relevant sections):
${imgDescriptions}
${realImageCount < 10 ? `  /images/business-${realImageCount + 1}.jpg to business-10.jpg — industry stock photos` : ''}
ALL images have onError fallback — if they fail to load, a gradient placeholder will show automatically.`;
    } else {
      imageContext = `Images (use these paths): ${imageList.join(', ')}
ALL images have onError fallback — if they fail to load, a gradient placeholder will show automatically.`;
    }

    const reviewsSection = (bd.reviews && bd.reviews.length > 0)
      ? bd.reviews.map(r => `- "${r.text}" — ${r.author} (${r.rating}/5)`).join('\n')
      : 'No reviews available';

    // Get design system for visual reference
    const designSystem = matchDesignSystem(bd.industry, bd.name);
    const designContext = getDesignContext(designSystem);

    // Website DNA from planner
    const dnaSection = state.websiteDna
      ? `WEBSITE DNA (follow this creative direction):
Brand Personality: ${state.websiteDna.brand_personality}
Design Archetype: ${state.websiteDna.design_archetype}
Visual Signature: ${state.websiteDna.visual_signature}
Layout Style: ${state.websiteDna.layout_personality}
Interaction Style: ${state.websiteDna.interaction_style}
Trust Strategy: ${state.websiteDna.trust_strategy}
Conversion Strategy: ${state.websiteDna.conversion_strategy}
Uniqueness: ${state.websiteDna.uniqueness_factor}`
      : '';

    // Redesign context from crawled website
    let redesignSection = '';
    if (state.websiteMode === WebsiteMode.REDESIGN && state.existingWebsite) {
      const ew = state.existingWebsite;

      const existingPagesSummary = ew.pages.map(p =>
        `- ${p.label || p.title}: ${p.h1 || ''} (${p.sectionCount} sections, ${p.imageCount || 0} images)`
      ).join('\n');

      const existingContentBrief = (ew.allContent || []).map(page => {
        const headings = page.headings.slice(0, 4).join(' | ');
        return `[${page.page}]: ${headings}`;
      }).join('\n');

      const existingMenuStructure = ew.allMenuItems
        .filter(m => m.location === 'header' || m.location === 'nav')
        .map(m => m.text)
        .slice(0, 10)
        .join(', ');

      const reusableImages = ew.allImages.slice(0, 15).map((img, i) =>
        `${i + 1}. "${img.alt || 'image'}" from ${img.page} (${img.width}x${img.height})`
      ).join('\n');

      redesignSection = `═══ REDESIGN MODE — EXISTING WEBSITE ANALYSIS ═══

IMPORTANT: You are REDESIGNING an existing website. Create a DRAMATICALLY SUPERIOR version.

EXISTING WEBSITE: ${ew.url}
HOMEPAGE TITLE: "${ew.homepage?.title || ''}"
HERO TEXT: "${ew.homepage?.heroText || ''}"

EXISTING NAVIGATION (improve structure):
${existingMenuStructure || 'No menu found'}

EXISTING PAGES:
${existingPagesSummary || 'Single page only'}

EXISTING CONTENT (reference — make BETTER versions):
${existingContentBrief || 'No content found'}

REUSABLE IMAGES FROM EXISTING SITE:
${reusableImages || 'No images found'}

WEAKNESSES TO FIX (your design MUST solve these):
${(ew.weaknesses || []).map(w => `✗ ${w}`).join('\n')}

EXISTING COLORS: ${ew.colorTheme.slice(0, 6).join(', ')}
EXISTING FONTS: ${ew.typography?.fonts?.join(', ') || 'Unknown'}

REDESIGN RULES:
- Create MORE sections than existing site (they have ${ew.contentSections.length} — you should have ${Math.max(ew.contentSections.length + 3, 8)}+)
- Better navigation structure than: ${existingMenuStructure}
- Fix ALL weaknesses listed above
- Reuse relevant content ideas but with premium design execution
- Every section must OUTPERFORM the corresponding existing section
- Use existing images where relevant (mapped to /images/business-N.jpg paths)
═══════════════════════════════════════════════
`;
    }

    return `${designContext}

${dnaSection}

${redesignSection}
---

Business: ${bd.name}
Industry: ${bd.industry}
Categories: ${bd.categories.join(', ')}
Address: ${bd.address}
Phone: ${bd.phone}
Hours: ${JSON.stringify(bd.hours)}
Rating: ${bd.rating}/5 (${bd.reviewCount} reviews)
Description: ${bd.description}
Price Level: ${bd.priceLevel}

Customer Reviews (use as real testimonials):
${reviewsSection}

${imageContext}

${this.buildMarketingContext(state)}

Tone: ${plan.tone}
Target Audience: ${plan.targetAudience}
Features: ${JSON.stringify(plan.features)}
Navigation: ${JSON.stringify(plan.navigation)}
Pages planned: ${JSON.stringify(plan.pages?.map(p => p.slug))}`;
  }

  buildMarketingContext(state) {
    const mc = state.marketingContent;
    if (!mc) return '';

    return `MARKETING CONTENT (use this EXACT copy in the website — do not invent new text):

HERO:
- Headline: "${mc.hero_headline || ''}"
- Subheadline: "${mc.hero_subheadline || ''}"

SELLING POINTS (use in hero trust indicators or "Why Choose Us"):
${(mc.selling_points || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}

ABOUT/STORY:
"${mc.about_story || ''}"

SERVICES INTRO:
"${mc.services_intro || ''}"

TRUST SIGNALS (display as badges/counters):
${(mc.trust_signals || []).map(t => `• ${t}`).join('\n')}

TESTIMONIALS (use these REAL quotes — do NOT make up fake reviews):
${(mc.testimonials || []).map(t => `• "${t.quote}" — ${t.author} (${t.rating}★) [highlight: ${t.highlight}]`).join('\n')}

FAQ (use in accordion section):
${(mc.faq || []).map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}

SEO:
- Title: "${mc.meta_title || ''}"
- Description: "${mc.meta_description || ''}"

CTA BUTTONS:
- Primary: "${mc.cta_primary || 'Get Started'}"
- Secondary: "${mc.cta_secondary || 'Learn More'}"

KEYWORDS FROM REVIEWS (use naturally in headings and body text):
${(mc.keywords_from_reviews || []).join(', ')}`;
  }

  extractDeps(files) {
    const pkgFile = files.find(f => f.path === 'package.json');
    if (!pkgFile) return { dependencies: {}, devDependencies: {} };
    try {
      const pkg = JSON.parse(pkgFile.content);
      return {
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
      };
    } catch {
      return { dependencies: {}, devDependencies: {} };
    }
  }
}

function stripFences(content) {
  let cleaned = content.trim();

  // Groq often adds preamble text before code fences — extract code between fences
  const fenceMatch = cleaned.match(/```(?:jsx|javascript|js|json|css)?\n([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
    return cleaned;
  }

  // Simple fence removal (start/end)
  if (cleaned.startsWith('```jsx')) cleaned = cleaned.slice(6);
  else if (cleaned.startsWith('```javascript')) cleaned = cleaned.slice(13);
  else if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```css')) cleaned = cleaned.slice(6);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

  // Remove trailing explanation text after the last closing brace/tag
  const lastExport = cleaned.lastIndexOf('export default');
  if (lastExport > -1) {
    // Find end of the export statement (semicolon or end of function)
    const afterExport = cleaned.indexOf('\n\n', lastExport + 50);
    if (afterExport > -1 && afterExport < cleaned.length - 10) {
      const remaining = cleaned.slice(afterExport).trim();
      // If remaining is just explanation text (starts with "This", "The", "I've", etc)
      if (/^(This|The|I've|I have|Note|Here|Above|Each|It )/.test(remaining)) {
        cleaned = cleaned.slice(0, afterExport).trim();
      }
    }
  }

  // Remove preamble text before first import/use client
  const codeStart = cleaned.search(/^('use client'|"use client"|import |export )/m);
  if (codeStart > 0) {
    cleaned = cleaned.slice(codeStart);
  }

  return cleaned.trim();
}

function getFallbackContent(filePath) {
  if (filePath.includes('layout.jsx')) {
    return `import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: process.env.BUSINESS_NAME || 'Business Website',
  description: 'Welcome to our business',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className + ' antialiased'}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}`;
  }
  if (filePath.includes('Header.jsx')) {
    return `'use client';
import Link from 'next/link';
export default function Header() {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">{process.env.BUSINESS_NAME || 'Business'}</Link>
        <div className="flex gap-6">
          <Link href="/" className="hover:text-primary">Home</Link>
          <Link href="/about" className="hover:text-primary">About</Link>
        </div>
      </nav>
    </header>
  );
}`;
  }
  if (filePath.includes('Footer.jsx')) {
    return `export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p>&copy; ${new Date().getFullYear()} {process.env.BUSINESS_NAME}. All rights reserved.</p>
      </div>
    </footer>
  );
}`;
  }
  return `'use client';
export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-semibold">Coming Soon</h1>
    </div>
  );
}`;
}

function detectLanguage(filePath) {
  if (filePath.endsWith('.jsx')) return 'javascript';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'javascript';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.css')) return 'css';
  return 'text';
}

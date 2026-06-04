import { BaseAgent } from './base.js';
import { createWebsitePlan } from '../models/website-plan.js';
import { PipelineStage, WebsiteMode } from '../models/pipeline-state.js';
import { getPreset } from '../templates/industry-presets.js';

const SYSTEM_PROMPT = `You are an Elite Digital Agency Strategist combining UX Strategy, Brand Consulting, CRO Expert, SEO Expert, and Senior UI Design.

Your job: Create a website_dna and architecture for a UNIQUE, premium, custom-agency-quality website ($10,000+ value).

CRITICAL RULES:
- NEVER generate generic layouts, generic SaaS structures, generic hero sections, generic card grids
- Every section must have UNIQUE layout composition and visual hierarchy
- The website must look DIFFERENT from 90% of websites in the same industry
- ENGLISH ONLY — all content in English. No i18n, no multi-language

FIRST, create a website_dna object:
{
  "website_dna": {
    "brand_personality": "describe the brand voice and character",
    "design_archetype": "the visual design philosophy (e.g., bold-industrial, soft-organic, tech-minimal)",
    "visual_signature": "what makes this design instantly recognizable",
    "layout_personality": "how sections flow and interact (e.g., asymmetric-editorial, full-bleed-immersive)",
    "interaction_style": "how the site responds to users (e.g., smooth-reveal, snap-sections)",
    "trust_strategy": "how the site builds credibility (reviews, certifications, years, numbers)",
    "conversion_strategy": "primary CTA flow and secondary engagement hooks",
    "customer_journey": "awareness → interest → desire → action path",
    "uniqueness_factor": "the ONE thing that makes this site stand out"
  }
}

THEN create the full plan:
{
  "website_dna": {...},
  "pages": [{"slug", "title", "description", "sections": ["unique section names"], "is_dynamic": false}],
  "navigation": [{"label", "href", "children": []}],
  "theme": {"primary_color": "#hex", "secondary_color": "#hex", "accent_color": "#hex", "font_heading": "font name", "font_body": "font name", "style": "archetype name"},
  "features": [{"name", "description", "page"}],
  "content_plan": {"page_slug": "content strategy outline"},
  "target_audience": "specific audience description",
  "tone": "brand voice tone",
  "image_suggestions": [
    {"search_term": "specific unsplash search query", "purpose": "where this image is used (hero, about, products etc)"}
  ]
}

IMAGE SUGGESTIONS RULES:
- Provide exactly 10 image descriptions
- Each must be SPECIFIC and visual (not generic like "business" or "office")
- Match the actual business industry and products/services
- Examples for electrical store: "ceiling fan showroom with multiple fans on display", "modern LED pendant lights in warm tone", "electrical switch board wall display", "lighting showroom interior"
- Examples for restaurant: "indian food thali plate from above", "warm restaurant interior with diners", "chef cooking in professional kitchen"
- These descriptions will be used to find the best matching stock photos

UNIQUE SECTION IDEAS (use these, not generic ones):
- Split-screen hero with diagonal divider
- Floating product showcase with parallax depth
- Testimonial ticker/marquee (not cards grid)
- Stats counter with animated reveal
- Full-bleed image with overlapping text panel
- Bento grid layout for features
- Horizontal scroll gallery
- Sticky sidebar with scrolling content
- Gradient mesh background sections
- Overlapping card stack
- Timeline/journey visualization
- Comparison table with toggle
- Interactive before/after slider
- Masonry photo grid
- Accordion FAQ with illustrations

Return ONLY valid JSON.`;

export class PlannerAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.name = 'PlannerAgent';
  }

  async run(state) {
    if (!state.businessData) {
      state.errors.push('No business data available for planning');
      state.stage = PipelineStage.FAILED;
      return state;
    }

    state.stage = PipelineStage.PLANNING;
    this.log(`Planning website for "${state.businessData.name}" (${state.businessData.industry})`);

    try {
      const preset = getPreset(state.businessData.industry);
      const bd = state.businessData;

      const isRedesign = state.websiteMode === WebsiteMode.REDESIGN && state.existingWebsite;

      let modeContext;
      if (isRedesign) {
        const ew = state.existingWebsite;

        // Full page details with content
        const existingPages = ew.pages.map(p => {
          const sectionHeadings = (p.sections || []).map(s => s.heading).filter(Boolean).join(', ');
          return `- ${p.label || p.title} (${p.sectionCount} sections, ${p.imageCount || 0} images)\n    Headings: ${p.h1 || ''} | ${sectionHeadings}\n    Content preview: ${(p.bodyText || '').slice(0, 200)}`;
        }).join('\n') || 'No internal pages discovered';

        // Full menu structure
        const headerNav = ew.allMenuItems.filter(m => m.location === 'header' || m.location === 'nav');
        const footerNav = ew.allMenuItems.filter(m => m.location === 'footer');
        const menuStructure = `Header Menu: ${headerNav.map(m => `${m.text} (${m.href})`).join(', ') || 'None'}\n  Footer Links: ${footerNav.map(m => m.text).join(', ') || 'None'}`;

        // All content sections with details
        const existingSections = ew.contentSections.map(s => {
          const extras = [];
          if (s.imageCount > 0) extras.push(`${s.imageCount} images`);
          if (s.hasForm) extras.push('has form');
          if (s.hasCTA) extras.push('has CTA');
          return `- ${s.heading || 'Untitled'}: ${(s.content || s.preview).slice(0, 120)} [${extras.join(', ')}]`;
        }).join('\n') || 'No sections found';

        // All content from all pages
        const fullContentMap = (ew.allContent || []).map(page => {
          const headings = page.headings.slice(0, 6).join(' | ');
          return `[${page.page}]: ${headings}\n    Preview: ${page.textPreview.slice(0, 200)}`;
        }).join('\n') || 'No content';

        // Images available for reuse
        const imagesSummary = ew.allImages.slice(0, 20).map(img =>
          `- "${img.alt || 'unnamed'}" from ${img.page} (${img.width}x${img.height})`
        ).join('\n') || 'No images';

        const weaknessList = ew.weaknesses.map(w => `- ${w}`).join('\n') || 'None detected';

        modeContext = `MODE: REDESIGN — Existing website crawled and fully analyzed. Create a DRAMATICALLY SUPERIOR version.

═══ EXISTING WEBSITE FULL ANALYSIS ═══

URL: ${ew.url}
Title: "${ew.homepage?.title || 'N/A'}"
Meta Description: "${ew.homepage?.metaDescription || 'MISSING'}"
Hero Text: "${ew.homepage?.heroText || 'N/A'}"
Total Pages: ${ew.pages.length + 1} (homepage + ${ew.pages.length} internal)
Total Images: ${ew.allImages.length}
Total Menu Items: ${ew.allMenuItems.length}

FULL MENU STRUCTURE:
  ${menuStructure}

EXISTING PAGES (with content):
${existingPages}

HOMEPAGE SECTIONS (${ew.contentSections.length} total):
${existingSections}

ALL CONTENT ACROSS PAGES:
${fullContentMap}

REUSABLE IMAGES:
${imagesSummary}

DETECTED WEAKNESSES (your plan MUST fix ALL of these):
${weaknessList}

EXISTING DESIGN:
  Colors: ${ew.colorTheme.slice(0, 8).join(', ') || 'Not detected'}
  Fonts: ${ew.typography?.fonts?.join(', ') || 'Not detected'}
  CTAs found: ${ew.conversionElements.map(c => c.text).filter(Boolean).slice(0, 8).join(', ') || 'None'}

SEO STATUS:
  H1 count: ${ew.seoData?.h1Count || 0} | H2 count: ${ew.seoData?.h2Count || 0}
  Structured data: ${ew.seoData?.hasStructuredData ? 'Yes' : 'No'}

═══ REDESIGN RULES ═══
- Plan MORE pages than existing site (they have ${ew.pages.length + 1} — plan at least ${Math.max(ew.pages.length + 2, 5)})
- Create MORE sections per page than existing (they avg ${Math.round(ew.contentSections.length / Math.max(ew.pages.length + 1, 1))} — aim for 8-12 on homepage)
- Reuse relevant content IDEAS but rewrite in premium marketing language
- Fix ALL detected weaknesses through better architecture
- Improve navigation: add missing pages, better hierarchy
- Better conversion flow: clear CTAs, trust signals, social proof
- Modern design system that dramatically outperforms current look
- Reference existing images for visual continuity (mapped to /images/business-N.jpg)
- Keep business identity authentic — upgrade the PRESENTATION not the brand`;
      } else {
        modeContext = 'MODE: NEW BUILD — No official website exists. Create a completely unique website from scratch.';
      }

      const userMessage = `${modeContext}

Business Name: ${bd.name}
Industry: ${bd.industry}
Categories: ${bd.categories.join(', ')}
Address: ${bd.address}
Phone: ${bd.phone}
Existing Website: ${bd.website || 'None'}
Hours: ${JSON.stringify(bd.hours)}
Rating: ${bd.rating}/5 (${bd.reviewCount} reviews)
Description: ${bd.description}
Price Level: ${bd.priceLevel}
Reviews Summary: ${bd.reviews?.slice(0, 3).map(r => r.text).join(' | ') || 'No reviews'}

Industry context: ${preset.style} style, typical pages: ${preset.pages.join(', ')}

Create a UNIQUE website strategy with website_dna. This must NOT look like a template.
The design should feel custom-built by a premium agency.`;

      const parsed = await this.callLLMJson(SYSTEM_PROMPT, [
        { role: 'user', content: userMessage },
      ]);

      // Store website_dna in state for codegen to use
      if (parsed.website_dna) {
        state.websiteDna = parsed.website_dna;
        this.log(`DNA: ${parsed.website_dna.design_archetype} | ${parsed.website_dna.uniqueness_factor}`);
      }

      // Store image suggestions for downloader
      if (parsed.image_suggestions) {
        state.imageSuggestions = parsed.image_suggestions;
        this.log(`Images: ${parsed.image_suggestions.length} suggestions`);
      }

      state.websitePlan = createWebsitePlan(parsed);
      this.log(`Plan: ${state.websitePlan.pages.length} pages, ${state.websitePlan.features.length} features`);
      return state;
    } catch (error) {
      state.errors.push(`Planning failed: ${error.message}`);
      state.stage = PipelineStage.FAILED;
      this.log(`Error: ${error.message}`);
      return state;
    }
  }
}

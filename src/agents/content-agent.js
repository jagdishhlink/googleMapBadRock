import { BaseAgent } from './base.js';
import { PipelineStage, WebsiteMode } from '../models/pipeline-state.js';

const SYSTEM_PROMPT = `You are an expert conversion copywriter and marketing strategist. Given business information and customer reviews, generate persuasive, authentic website content.

Your job:
1. Analyze customer reviews to find REAL selling points (what customers actually praise)
2. Extract specific keywords customers use (these are SEO gold)
3. Create compelling marketing copy that sounds authentic, not generic

Return a JSON object with:

{
  "selling_points": ["3-5 key strengths extracted from reviews"],
  "keywords_from_reviews": ["8-10 specific words/phrases customers repeat"],
  "hero_headline": "powerful 5-8 word headline",
  "hero_subheadline": "1-2 sentence value proposition using review language",
  "about_story": "3-4 sentences compelling business story (use real details)",
  "services_intro": "2 sentences introducing services/products",
  "trust_signals": ["4-5 trust elements derived from reviews and business data"],
  "cta_primary": "primary call-to-action text (action-oriented)",
  "cta_secondary": "secondary CTA text",
  "testimonials": [
    {"quote": "actual review text (shortened if needed)", "author": "name", "rating": 5, "highlight": "the key phrase from this review"}
  ],
  "faq": [
    {"question": "customer-focused question", "answer": "helpful 2-3 sentence answer using business knowledge"}
  ],
  "meta_title": "SEO optimized page title (60 chars max)",
  "meta_description": "SEO meta description using customer language (155 chars max)",
  "page_content": {
    "home_sections": ["section-name: 1-2 sentence content direction for each section"],
    "services_descriptions": [{"name": "service name", "description": "benefit-focused description", "price_hint": "if available"}],
    "about_highlights": ["key business differentiators"]
  }
}

RULES:
- Use REAL review quotes — don't fabricate testimonials
- Extract ACTUAL customer language — "friendly staff", "best quality", "fast service" etc.
- Headlines should be specific to THIS business, not generic marketing fluff
- FAQs should answer questions real customers would ask
- All content in English
- Be concise — website copy should be scannable, not essay-length

Return ONLY valid JSON.`;

export class ContentAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.name = 'ContentAgent';
  }

  async run(state) {
    if (!state.businessData) {
      state.errors.push('No business data for content generation');
      return state;
    }

    this.log('Generating marketing content from reviews...');

    try {
      const bd = state.businessData;
      const reviews = (bd.reviews || []).map(r => `"${r.text}" — ${r.author} (${r.rating}★)`).join('\n');

      let existingContentContext = '';
      if (state.websiteMode === WebsiteMode.REDESIGN && state.existingWebsite) {
        const ew = state.existingWebsite;

        const allPageContent = (ew.allContent || []).map(page => {
          const headings = page.headings.slice(0, 5).join(', ');
          const sectionText = (page.sections || []).map(s => `  • ${s.heading || 'Section'}: ${(s.content || '').slice(0, 150)}`).join('\n');
          return `[${page.page}] (${page.url})\n  Headings: ${headings}\n${sectionText}`;
        }).join('\n\n');

        const menuStructure = ew.allMenuItems.map(m => `- ${m.text} → ${m.href} (${m.location})`).join('\n');

        const imageContext = ew.allImages.slice(0, 20).map(img => `- ${img.alt || 'No alt'} (${img.page}) → ${img.src}`).join('\n');

        const weaknessList = (ew.weaknesses || []).map(w => `- ${w}`).join('\n');

        existingContentContext = `
═══ REDESIGN MODE: EXISTING WEBSITE DATA ═══

WEBSITE URL: ${ew.url}
HOMEPAGE TITLE: "${ew.homepage?.title || ''}"
HERO TEXT: "${ew.homepage?.heroText || ''}"
META DESCRIPTION: "${ew.homepage?.metaDescription || 'MISSING'}"

FULL MENU/NAVIGATION STRUCTURE:
${menuStructure || 'No menu found'}

ALL PAGE CONTENT (use as reference — rewrite better):
${allPageContent || 'No content extracted'}

EXISTING IMAGES (reuse relevant ones):
${imageContext || 'No images found'}

DETECTED WEAKNESSES (your content must FIX these):
${weaknessList || 'None'}

EXISTING CONVERSION ELEMENTS: ${ew.conversionElements.map(c => c.text).filter(Boolean).slice(0, 8).join(', ') || 'None found'}

═══ REDESIGN INSTRUCTIONS ═══
- Rewrite ALL existing content in superior marketing language
- Keep the same services/products but describe them with better copywriting
- Create compelling headlines that outperform the originals
- Add missing trust signals, CTAs, and engagement elements
- Fix ALL detected weaknesses through better content strategy
- Use existing image descriptions to suggest relevant visuals
- Maintain business authenticity but dramatically upgrade messaging quality
`;
      }

      const userMessage = `Generate marketing content for this business:

Business: ${bd.name}
Industry: ${bd.industry}
Categories: ${(bd.categories || []).join(', ')}
Location: ${bd.address}
Phone: ${bd.phone}
Rating: ${bd.rating}/5 (${bd.reviewCount} reviews)
Description: ${bd.description}
Price Level: ${bd.priceLevel}
Hours: ${JSON.stringify(bd.hours)}
${existingContentContext}
CUSTOMER REVIEWS (use these as the foundation for all content):
${reviews || 'No reviews available — generate content based on industry best practices and business info.'}

Based on these reviews, identify what customers love about this business and create compelling website content.`;

      const content = await this.callLLMJson(SYSTEM_PROMPT, [
        { role: 'user', content: userMessage },
      ]);

      state.marketingContent = content;
      this.log(`Content: "${content.hero_headline}" | ${content.selling_points?.length || 0} selling points | ${content.testimonials?.length || 0} testimonials`);
      return state;
    } catch (error) {
      this.log(`Warning: Content generation failed (${error.message}) — will use raw data`);
      return state;
    }
  }
}

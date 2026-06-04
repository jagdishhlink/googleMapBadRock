import { BaseAgent } from './base.js';
import { scrapeGoogleMaps } from '../scraping/google-maps.js';
import { isOfficialWebsite, crawlWebsite, analyzeWeaknesses } from '../scraping/website-detector.js';
import { createBusinessInfo, createImageAsset, createReviewSnippet } from '../models/business.js';
import { PipelineStage, WebsiteMode } from '../models/pipeline-state.js';

const SYSTEM_PROMPT = `You are a data extraction specialist. Given raw scraped content from a Google Maps business page, extract structured business information.

Return a JSON object with these fields:
- name: business name
- industry: the primary industry (e.g., "restaurant", "dental_clinic", "law_firm", "salon", "gym", "retail", "hotel")
- categories: list of Google Maps categories
- address: full address
- phone: phone number
- website: website URL if available
- hours: dict of day -> hours string
- rating: numeric rating (1-5)
- review_count: number of reviews
- reviews: list of {author, rating, text} for top reviews
- description: business description/about text
- price_level: price indicator ($, $$, $$$, $$$$)

Return ONLY valid JSON, no other text.`;

export class ScraperAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.name = 'ScraperAgent';
  }

  async run(state) {
    state.stage = PipelineStage.SCRAPING;
    this.log('Starting Google Maps scraping...');

    try {
      const scraped = await scrapeGoogleMaps(state.googleMapsUrl, this.config.headlessBrowser);

      if (!scraped.textContent || scraped.textContent.trim().length < 10) {
        throw new Error('No meaningful content scraped from the page');
      }

      this.log(`Scraped ${scraped.textContent.length} chars, ${scraped.imageUrls.length} images`);
      this.log('Sending to Claude for structured extraction...');

      const parsed = await this.callLLMJson(SYSTEM_PROMPT, [
        { role: 'user', content: `Extract business information from this Google Maps page content:\n\n${scraped.textContent}` },
      ]);

      const images = scraped.imageUrls.slice(0, 10).map(url => createImageAsset(url));
      const reviews = (parsed.reviews || []).slice(0, 5).map(r =>
        createReviewSnippet(r.author || '', r.rating || 0, r.text || '')
      );

      state.businessData = createBusinessInfo({
        name: parsed.name || scraped.businessName || '',
        industry: parsed.industry || '',
        categories: parsed.categories || [],
        address: parsed.address || '',
        phone: parsed.phone || '',
        website: parsed.website || '',
        hours: parsed.hours || {},
        rating: parsed.rating || null,
        reviewCount: parsed.review_count || null,
        reviews,
        images,
        description: parsed.description || '',
        priceLevel: parsed.price_level || '',
      });

      this.log(`Extracted: "${state.businessData.name}" (${state.businessData.industry})`);

      // Website detection step
      state.stage = PipelineStage.WEBSITE_DETECTION;
      const websiteUrl = state.businessData.website;

      if (isOfficialWebsite(websiteUrl)) {
        this.log(`Official website found: ${websiteUrl} — crawling for REDESIGN mode...`);
        try {
          const crawlData = await crawlWebsite(websiteUrl, this.config.headlessBrowser);
          if (crawlData && crawlData.isAccessible) {
            state.websiteMode = WebsiteMode.REDESIGN;
            crawlData.weaknesses = analyzeWeaknesses(crawlData);
            state.existingWebsite = crawlData;
            this.log(`✓ Crawl complete:`);
            this.log(`  Pages: ${crawlData.pages.length + 1} (homepage + ${crawlData.pages.length} internal)`);
            this.log(`  Menu items: ${crawlData.allMenuItems.length}`);
            this.log(`  Images collected: ${crawlData.allImages.length}`);
            this.log(`  Content sections: ${crawlData.contentSections.length}`);
            this.log(`  Weaknesses found: ${crawlData.weaknesses.length}`);
          } else {
            this.log('Website not accessible — proceeding with NEW mode');
            state.websiteMode = WebsiteMode.NEW;
          }
        } catch (err) {
          this.log(`Website crawl failed (${err.message}) — proceeding with NEW mode`);
          state.websiteMode = WebsiteMode.NEW;
        }
      } else {
        this.log('No official website found (social/directory links ignored) — NEW mode');
        state.websiteMode = WebsiteMode.NEW;
      }

      return state;
    } catch (error) {
      state.errors.push(`Scraping failed: ${error.message}`);
      state.stage = PipelineStage.FAILED;
      this.log(`Error: ${error.message}`);
      return state;
    }
  }
}

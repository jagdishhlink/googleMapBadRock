import { chromium } from 'playwright';

const SOCIAL_DOMAINS = [
  'instagram.com', 'facebook.com', 'twitter.com', 'x.com',
  'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
  'snapchat.com', 'threads.net',
];

const DIRECTORY_DOMAINS = [
  'justdial.com', 'sulekha.com', 'indiamart.com', 'tradeindia.com',
  'yellowpages.com', 'yelp.com', 'tripadvisor.com', 'zomato.com',
  'swiggy.com', 'booking.com', 'makemytrip.com', 'goibibo.com',
  'practo.com', 'urbanclap.com', 'urbancompany.com', 'google.com/maps',
  'maps.google.com', 'g.page', 'goo.gl/maps', 'business.google.com',
];

export function isOfficialWebsite(url) {
  if (!url || url.length < 5) return false;

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = parsed.hostname.toLowerCase();

    for (const social of SOCIAL_DOMAINS) {
      if (hostname.includes(social)) return false;
    }

    for (const directory of DIRECTORY_DOMAINS) {
      if (hostname.includes(directory)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function crawlWebsite(url, headless = true) {
  if (!url) return null;

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  const baseOrigin = new URL(normalizedUrl).origin;

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  });

  try {
    const page = await context.newPage();
    const result = {
      url: normalizedUrl,
      isAccessible: false,
      homepage: null,
      pages: [],
      allMenuItems: [],
      allContent: [],
      allImages: [],
      seoData: null,
      navigation: [],
      colorTheme: [],
      typography: [],
      conversionElements: [],
      contentSections: [],
      weaknesses: [],
    };

    // Step 1: Load homepage
    try {
      const response = await page.goto(normalizedUrl, { waitUntil: 'networkidle', timeout: 20000 });
      if (!response || response.status() >= 400) {
        return result;
      }
    } catch {
      try {
        await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch {
        return result;
      }
    }

    result.isAccessible = true;
    await page.waitForTimeout(2000);

    // Step 2: Extract homepage data
    result.homepage = await page.evaluate(() => {
      const getText = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.innerText.trim().slice(0, 500) : '';
      };
      const getMeta = (name) => {
        const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return el ? el.getAttribute('content') || '' : '';
      };
      return {
        title: document.title || '',
        metaDescription: getMeta('description'),
        ogTitle: getMeta('og:title'),
        ogDescription: getMeta('og:description'),
        h1: getText('h1'),
        heroText: getText('[class*="hero"] h1, [class*="hero"] h2, [class*="banner"] h1, section:first-of-type h1'),
        bodyText: document.body.innerText.slice(0, 8000),
      };
    });

    // Step 3: Extract ALL navigation/menu items (deep)
    result.allMenuItems = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      const navEls = document.querySelectorAll(
        'nav a, header a, [class*="nav"] a, [class*="menu"] a, [class*="Nav"] a, [class*="Menu"] a, ' +
        'footer a, [role="navigation"] a, ul.menu a, .navbar a, #menu a, .main-menu a, .primary-menu a'
      );
      for (const el of navEls) {
        const href = el.getAttribute('href') || '';
        const text = el.innerText.trim();
        if (text && text.length < 80 && href && !seen.has(href)) {
          seen.add(href);
          const isExternal = href.startsWith('http') && !href.includes(window.location.hostname);
          items.push({
            text,
            href,
            isExternal,
            location: el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : 'nav',
          });
        }
      }
      return items;
    });

    // Filter to get main navigation (header menu links)
    result.navigation = result.allMenuItems.filter(item =>
      item.location === 'header' || item.location === 'nav'
    ).slice(0, 20);

    // Step 4: Extract ALL images from homepage
    const homepageImages = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      return Array.from(imgs)
        .map(img => {
          const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
          return {
            src,
            alt: img.alt || '',
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
            page: 'homepage',
          };
        })
        .filter(img => img.src && img.src.startsWith('http') && !img.src.includes('.svg') && !img.src.includes('data:'))
        .filter(img => img.width > 50 || img.height > 50 || (!img.width && !img.height));
    });
    result.allImages.push(...homepageImages);

    // Step 5: Extract content sections from homepage
    result.contentSections = await page.evaluate(() => {
      const sections = [];
      const sectionEls = document.querySelectorAll('section, [class*="section"], main > div, article');
      for (const el of sectionEls) {
        const heading = el.querySelector('h1, h2, h3');
        const paragraphs = Array.from(el.querySelectorAll('p')).map(p => p.innerText.trim()).filter(t => t.length > 10);
        const text = el.innerText.trim();
        if (text.length > 20) {
          sections.push({
            heading: heading ? heading.innerText.trim() : '',
            content: paragraphs.join('\n').slice(0, 500),
            preview: text.slice(0, 300),
            imageCount: el.querySelectorAll('img').length,
            hasForm: el.querySelectorAll('form, input, textarea').length > 0,
            hasCTA: el.querySelectorAll('a, button').length > 0,
          });
        }
      }
      return sections.slice(0, 20);
    });

    // Step 6: Extract color theme & typography
    result.colorTheme = await page.evaluate(() => {
      const colors = new Set();
      const elements = document.querySelectorAll('header, nav, footer, [class*="hero"], [class*="banner"], button, a.btn, [class*="btn"], section');
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          colors.add(style.backgroundColor);
        }
        if (style.color) colors.add(style.color);
      }
      return Array.from(colors).slice(0, 20);
    });

    result.typography = await page.evaluate(() => {
      const fonts = new Set();
      const sizes = new Set();
      const elements = document.querySelectorAll('h1, h2, h3, p, a, button, span');
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        fonts.add(style.fontFamily.split(',')[0].trim().replace(/"/g, ''));
        sizes.add(style.fontSize);
      }
      return { fonts: Array.from(fonts).slice(0, 8), sizes: Array.from(sizes).slice(0, 12) };
    });

    // Step 7: Extract conversion elements
    result.conversionElements = await page.evaluate(() => {
      const elements = [];
      const ctas = document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="whatsapp"], button, [class*="cta"], [class*="btn"], [class*="CTA"], [class*="Btn"]');
      for (const el of ctas) {
        elements.push({
          type: el.tagName.toLowerCase(),
          text: el.innerText.trim().slice(0, 60),
          href: el.getAttribute('href') || '',
        });
      }
      return elements.slice(0, 20);
    });

    // Step 8: Extract SEO data
    result.seoData = await page.evaluate(() => {
      const getMeta = (name) => {
        const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return el ? el.getAttribute('content') || '' : '';
      };
      return {
        title: document.title,
        description: getMeta('description'),
        keywords: getMeta('keywords'),
        ogTitle: getMeta('og:title'),
        ogDescription: getMeta('og:description'),
        ogImage: getMeta('og:image'),
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        hasStructuredData: document.querySelectorAll('script[type="application/ld+json"]').length > 0,
        structuredDataTypes: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
          try { return JSON.parse(s.textContent)['@type'] || ''; } catch { return ''; }
        }).filter(Boolean),
        h1Count: document.querySelectorAll('h1').length,
        h2Count: document.querySelectorAll('h2').length,
        h1Texts: Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim()).slice(0, 5),
        h2Texts: Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()).slice(0, 10),
      };
    });

    // Step 9: Crawl ALL internal pages (deep crawl)
    const internalLinks = result.allMenuItems
      .filter(item => {
        if (item.isExternal) return false;
        const href = item.href;
        if (href === '/' || href === '#' || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) return false;
        return href.startsWith('/') || href.startsWith(baseOrigin);
      })
      .map(item => ({
        ...item,
        fullUrl: item.href.startsWith('/') ? new URL(item.href, normalizedUrl).href : item.href,
      }));

    // Deduplicate by full URL
    const seenUrls = new Set([normalizedUrl]);
    const uniqueLinks = internalLinks.filter(link => {
      if (seenUrls.has(link.fullUrl)) return false;
      seenUrls.add(link.fullUrl);
      return true;
    }).slice(0, 15);

    for (const link of uniqueLinks) {
      try {
        await page.goto(link.fullUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(1500);

        const pageData = await page.evaluate(() => {
          const sections = [];
          const sectionEls = document.querySelectorAll('section, [class*="section"], main > div, article');
          for (const el of sectionEls) {
            const heading = el.querySelector('h1, h2, h3');
            const text = el.innerText.trim();
            if (text.length > 20) {
              sections.push({
                heading: heading ? heading.innerText.trim() : '',
                content: text.slice(0, 400),
              });
            }
          }

          const images = Array.from(document.querySelectorAll('img'))
            .map(img => ({
              src: img.src || img.getAttribute('data-src') || '',
              alt: img.alt || '',
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0,
            }))
            .filter(img => img.src && img.src.startsWith('http') && !img.src.includes('.svg') && !img.src.includes('data:'))
            .filter(img => img.width > 50 || img.height > 50 || (!img.width && !img.height));

          return {
            title: document.title,
            h1: document.querySelector('h1')?.innerText?.trim()?.slice(0, 150) || '',
            h2s: Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()).slice(0, 8),
            sectionCount: sectionEls.length,
            bodyText: document.body.innerText.trim().slice(0, 3000),
            sections: sections.slice(0, 10),
            images,
          };
        });

        // Add page images to allImages
        for (const img of pageData.images) {
          img.page = link.text || link.href;
          result.allImages.push(img);
        }

        result.pages.push({
          url: link.fullUrl,
          label: link.text,
          title: pageData.title,
          h1: pageData.h1,
          h2s: pageData.h2s,
          sectionCount: pageData.sectionCount,
          bodyText: pageData.bodyText,
          sections: pageData.sections,
          imageCount: pageData.images.length,
        });

        // Add page content to allContent
        result.allContent.push({
          page: link.text || link.href,
          url: link.fullUrl,
          title: pageData.title,
          headings: [pageData.h1, ...pageData.h2s].filter(Boolean),
          sections: pageData.sections,
          textPreview: pageData.bodyText.slice(0, 1000),
        });
      } catch {}
    }

    // Add homepage content to allContent
    result.allContent.unshift({
      page: 'Homepage',
      url: normalizedUrl,
      title: result.homepage.title,
      headings: result.seoData.h1Texts.concat(result.seoData.h2Texts),
      sections: result.contentSections.map(s => ({ heading: s.heading, content: s.content || s.preview })),
      textPreview: result.homepage.bodyText.slice(0, 1000),
    });

    // Deduplicate images by src
    const seenImgSrcs = new Set();
    result.allImages = result.allImages.filter(img => {
      if (seenImgSrcs.has(img.src)) return false;
      seenImgSrcs.add(img.src);
      return true;
    }).slice(0, 50);

    return result;
  } finally {
    await browser.close();
  }
}

export function analyzeWeaknesses(crawlData) {
  if (!crawlData || !crawlData.isAccessible) return [];

  const weaknesses = [];

  if (!crawlData.seoData?.description) {
    weaknesses.push('Missing meta description — hurts SEO ranking');
  }
  if (!crawlData.seoData?.hasStructuredData) {
    weaknesses.push('No structured data (JSON-LD) — missing rich snippets in search');
  }
  if (crawlData.seoData?.h1Count === 0) {
    weaknesses.push('No H1 tag found — poor heading hierarchy');
  }
  if (crawlData.seoData?.h1Count > 1) {
    weaknesses.push('Multiple H1 tags — dilutes heading hierarchy');
  }

  if (crawlData.contentSections.length < 3) {
    weaknesses.push('Too few content sections — weak page depth and engagement');
  }

  const hasCTA = crawlData.conversionElements.some(el =>
    el.text.toLowerCase().match(/call|book|order|get|schedule|contact|whatsapp/)
  );
  if (!hasCTA) {
    weaknesses.push('No clear call-to-action — low conversion potential');
  }

  if (crawlData.allImages.length < 3) {
    weaknesses.push('Few images — weak visual engagement');
  }

  const hasPhone = crawlData.conversionElements.some(el => el.href.startsWith('tel:'));
  if (!hasPhone) {
    weaknesses.push('No click-to-call phone link — mobile users can\'t call easily');
  }

  if (crawlData.navigation.length < 3) {
    weaknesses.push('Minimal navigation — poor site structure discoverability');
  }

  if (crawlData.pages.length === 0) {
    weaknesses.push('Single-page or broken internal links — limited content depth');
  }

  if (crawlData.colorTheme.length < 3) {
    weaknesses.push('Minimal color usage — weak brand identity');
  }

  const hasForm = crawlData.contentSections.some(s => s.hasForm);
  if (!hasForm) {
    weaknesses.push('No contact form found — missed lead generation opportunity');
  }

  return weaknesses;
}

import { chromium } from 'playwright';

export async function scrapeGoogleMaps(url, headless = true) {
  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  try {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const title = await page.title();

    if (currentUrl.includes('/sorry/') || title.toLowerCase().includes('unusual traffic')) {
      return extractFromUrl(url);
    }

    const consentBtn = await page.$('button[aria-label="Accept all"]');
    if (consentBtn) {
      await consentBtn.click();
      await page.waitForTimeout(2000);
    }

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const main = document.querySelector('[role="main"]');
        if (main) main.scrollTop = main.scrollHeight;
      });
      await page.waitForTimeout(1000);
    }

    const textContent = await page.evaluate(() => {
      const main = document.querySelector('[role="main"]');
      return main ? main.innerText.slice(0, 15000) : document.body.innerText.slice(0, 15000);
    });

    const imageUrls = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src^="http"]');
      return Array.from(imgs)
        .map(img => {
          let src = img.src;
          // Upgrade Google image URLs to HD resolution
          if (src.includes('googleusercontent.com') || src.includes('ggpht.com') || src.includes('lh5.') || src.includes('lh3.')) {
            src = src.replace(/=w\d+(-h\d+)?[^/]*/g, '=w1600-h1200');
            src = src.replace(/=s\d+[^/]*/g, '=s1600');
          }
          return src;
        })
        .filter(src => !src.includes('.svg') && !src.includes('data:') && !src.includes('logo') && !src.includes('icon'))
        .slice(0, 20);
    });

    const businessName = extractBusinessName(url);

    return { textContent, imageUrls, businessName };
  } finally {
    await browser.close();
  }
}

function extractBusinessName(url) {
  const placeMatch = url.match(/\/place\/([^/]+)/);
  if (placeMatch) {
    return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
  }
  const qMatch = url.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    return decodeURIComponent(qMatch[1]).replace(/\+/g, ' ');
  }
  return '';
}

function extractFromUrl(url) {
  const businessName = extractBusinessName(url);
  const nameLower = businessName.toLowerCase();

  let inferredIndustry = 'business';
  if (/salon|hair|barber|spa|beauty/.test(nameLower)) inferredIndustry = 'Hair Salon / Beauty';
  else if (/restaurant|cafe|food|kitchen|pizza|burger|biryani|punjabi|dhaba/.test(nameLower)) inferredIndustry = 'Restaurant / Food';
  else if (/dental|clinic|hospital|medical|doctor|health/.test(nameLower)) inferredIndustry = 'Medical / Healthcare';
  else if (/gym|fitness|yoga|crossfit/.test(nameLower)) inferredIndustry = 'Fitness / Gym';
  else if (/hotel|resort|inn|lodge/.test(nameLower)) inferredIndustry = 'Hotel / Hospitality';
  else if (/law|legal|attorney|advocate/.test(nameLower)) inferredIndustry = 'Law Firm';
  else if (/electric|plumb|mechanic|auto|repair/.test(nameLower)) inferredIndustry = 'Service / Repair';

  const textContent = `Business Name: ${businessName}\nInferred Industry: ${inferredIndustry}\nSource URL: ${url}`;

  return { textContent, imageUrls: [], businessName };
}

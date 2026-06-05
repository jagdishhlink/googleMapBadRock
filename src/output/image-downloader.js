import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';

const TARGET_IMAGES = 10;

const PHOTO_LIBRARY = {
  baby: ['photo-1519689680058-324335c77eba', 'photo-1544776193-352d25ca82cd', 'photo-1515488042361-ee00e0ddd4e3', 'photo-1504151932400-72d4384f04b3'],
  newborn: ['photo-1519689680058-324335c77eba', 'photo-1544776193-352d25ca82cd', 'photo-1515488042361-ee00e0ddd4e3', 'photo-1504151932400-72d4384f04b3'],
  family: ['photo-1511895426328-dc8714191300', 'photo-1475503572774-15a45e5d60b9', 'photo-1596464716127-f2a82984de30', 'photo-1609220136736-443140cffec6'],
  portrait: ['photo-1531746020798-e6953c6e8e04', 'photo-1506794778202-cad84cf45f1d', 'photo-1507003211169-0a1dd7228f2d', 'photo-1544005313-94ddf0286df2'],
  wedding: ['photo-1519741497674-611481863552', 'photo-1606800052052-a08af7148866', 'photo-1511285560929-80b456fea0bc', 'photo-1465495976277-4387d4b0b4c6'],
  camera: ['photo-1516035069371-29a1b244cc32', 'photo-1452587925148-ce544e77e70d', 'photo-1502982720700-bfff97f2ecac', 'photo-1554048612-b6a482bc67e5'],
  studio: ['photo-1471341971476-ae15ff5dd4ea', 'photo-1537633552985-df8429e8048b', 'photo-1519125323398-675f0ddb6308', 'photo-1542038784456-1ea8df5aa2a5'],
  photography: ['photo-1554048612-b6a482bc67e5', 'photo-1542038784456-1ea8df5aa2a5', 'photo-1471341971476-ae15ff5dd4ea', 'photo-1516035069371-29a1b244cc32'],
  salon: ['photo-1560066984-138dadb4c035', 'photo-1522337360788-8b13dee7a37e', 'photo-1521590832167-7bcbfaa6381f', 'photo-1516975080664-ed2fc6a32937'],
  hair: ['photo-1560066984-138dadb4c035', 'photo-1522337360788-8b13dee7a37e', 'photo-1519699047748-de8e457a634e', 'photo-1560750588-73207b1ef5b8'],
  beauty: ['photo-1570172619644-dfd03ed5d881', 'photo-1487412720507-e7ab37603c6f', 'photo-1595476108010-b4d1f102b1b1', 'photo-1516975080664-ed2fc6a32937'],
  spa: ['photo-1516975080664-ed2fc6a32937', 'photo-1544161515-4ab6ce6db874', 'photo-1540555700478-4be289fbec6e', 'photo-1515377905703-c4788e51af15'],
  restaurant: ['photo-1517248135467-4c7edcad34c4', 'photo-1414235077428-338989a2e8c0', 'photo-1556910103-1c02745aae4d', 'photo-1550966871-3ed3cdb5ed0c'],
  food: ['photo-1504674900247-0877df9cc836', 'photo-1555396273-367ea4eb4db5', 'photo-1528605248644-14dd04022da1', 'photo-1567306226416-28f0efdc88ce'],
  cafe: ['photo-1495474472287-4d71bcdd2085', 'photo-1501339847302-ac426a4a7cbb', 'photo-1554118811-1e0d58224f24', 'photo-1445116572660-236099ec97a0'],
  gym: ['photo-1534438327276-14e5300c3a48', 'photo-1517836357463-d25dfeac3438', 'photo-1571902943202-507ec2618e8f', 'photo-1540497077202-7c8a3999166f'],
  fitness: ['photo-1576678927484-cc907957088c', 'photo-1593079831268-3381b0db4a77', 'photo-1558611848-73f7eb4001a1', 'photo-1549060279-7e168fcee0c2'],
  dental: ['photo-1519494026892-80bbd2d6fd0d', 'photo-1631815588090-d4bfec5b1ccb', 'photo-1579684385127-1ef15d508118', 'photo-1551190822-a9ce113d0d15'],
  medical: ['photo-1504439468489-c8920d796a29', 'photo-1581093458791-9d42e3c2fd45', 'photo-1576091160399-112ba8d25d1d', 'photo-1530497610245-94d3c16cda28'],
  hotel: ['photo-1566073771259-6a8506099945', 'photo-1551882547-ff40c63fe5fa', 'photo-1520250497591-112f2f40a3f4', 'photo-1542314831-068cd1dbfeeb'],
  luxury: ['photo-1445019980597-93fa8acb246c', 'photo-1584132967334-10e028bd69f7', 'photo-1571896349842-33c89424de2d', 'photo-1582719508461-905c673771fd'],
  electrical: ['photo-1524484485831-a92ffc0de03f', 'photo-1565538810643-b5bdb714032a', 'photo-1507494924047-60b8ee826ca9', 'photo-1513506003901-1e6a229e2d15'],
  lighting: ['photo-1493723843671-1d655e66ac1c', 'photo-1540932239986-30128078f3c5', 'photo-1555664424-778a1e5e1b48', 'photo-1558449028-b53a39d100fc'],
  craft: ['photo-1513364776144-60967b0f800f', 'photo-1452587925148-ce544e77e70d', 'photo-1558618666-fcd25c85f82e', 'photo-1513519245088-0e12902e35ca'],
  machine: ['photo-1565793298595-6a879b1d9492', 'photo-1581091226825-a6a2a5aee158', 'photo-1504328345606-18bbc8c9d7d1', 'photo-1517420879524-86d64ac2f339'],
  workshop: ['photo-1504328345606-18bbc8c9d7d1', 'photo-1565793298595-6a879b1d9492', 'photo-1581091226825-a6a2a5aee158', 'photo-1517420879524-86d64ac2f339'],
  paper: ['photo-1513364776144-60967b0f800f', 'photo-1513519245088-0e12902e35ca', 'photo-1558618666-fcd25c85f82e', 'photo-1452587925148-ce544e77e70d'],
  design: ['photo-1558618666-fcd25c85f82e', 'photo-1513519245088-0e12902e35ca', 'photo-1513364776144-60967b0f800f', 'photo-1581091226825-a6a2a5aee158'],
  industrial: ['photo-1565793298595-6a879b1d9492', 'photo-1504328345606-18bbc8c9d7d1', 'photo-1581091226825-a6a2a5aee158', 'photo-1517420879524-86d64ac2f339'],
  product: ['photo-1556740758-90de940da79c', 'photo-1441986300917-64674bd600d8', 'photo-1472851294608-062f824d29cc', 'photo-1555529669-e69e7aa0ba9a'],
  shop: ['photo-1441986300917-64674bd600d8', 'photo-1556740758-90de940da79c', 'photo-1472851294608-062f824d29cc', 'photo-1555529669-e69e7aa0ba9a'],
  retail: ['photo-1604719312566-8912e9227c6a', 'photo-1481437156560-3205f6a55735', 'photo-1528698827591-e19cef1a992c', 'photo-1580828343064-fde4fc206bc6'],
  auto: ['photo-1486262715619-67b85e0b08d3', 'photo-1530046339160-ce3e530c7d2f', 'photo-1503376780353-7e6692767b70', 'photo-1492144534655-ae79c964c9d7'],
  car: ['photo-1558979158-65a1eaa08691', 'photo-1517524008697-84bbe3c3fd98', 'photo-1549317661-bd32c8ce0afe', 'photo-1489824904134-891ab64532f1'],
  office: ['photo-1497366216548-37526070297c', 'photo-1497366811353-6870744d04b2', 'photo-1521737604893-d14cc237f11d', 'photo-1522071820081-009f0129c71c'],
  business: ['photo-1556761175-5973dc0f32e7', 'photo-1553877522-43269d4ea984', 'photo-1600880292203-757bb62b4baf', 'photo-1504384308090-c894fdcc538d'],
  team: ['photo-1522071820081-009f0129c71c', 'photo-1556761175-5973dc0f32e7', 'photo-1528605248644-14dd04022da1', 'photo-1600880292203-757bb62b4baf'],
  interior: ['photo-1497366216548-37526070297c', 'photo-1497366811353-6870744d04b2', 'photo-1554118811-1e0d58224f24', 'photo-1441986300917-64674bd600d8'],
  nature: ['photo-1441974231531-c6227db76b6e', 'photo-1470071459604-3b5ec3a7fe05', 'photo-1501854140801-50d01698950b', 'photo-1518173946687-a4c8892bbd9f'],
  city: ['photo-1449824913935-59a10b8d2000', 'photo-1480714378408-67cf0d13bc1b', 'photo-1477959858617-67f85cf4f1df', 'photo-1444723121867-7a241cacace9'],
};

export async function downloadImages(images, projectDir, businessData = {}, imageSuggestions = [], existingWebsite = null) {
  const imagesDir = path.join(projectDir, 'public', 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  const results = [];
  let downloadedCount = 0;

  // REDESIGN MODE: Try business's own images first
  if (existingWebsite && existingWebsite.allImages && existingWebsite.allImages.length > 0) {
    console.log(`[ImageDownloader] REDESIGN MODE: Trying ${existingWebsite.allImages.length} real business images...`);

    const businessImages = existingWebsite.allImages
      .filter(img => img.src && img.src.startsWith('http'))
      .filter(img => {
        const src = img.src.toLowerCase();
        if (src.includes('logo') || src.includes('icon') || src.includes('favicon')) return false;
        if (src.includes('pixel') || src.includes('tracker')) return false;
        if (img.width && img.width < 100) return false;
        return true;
      })
      .slice(0, TARGET_IMAGES);

    for (let i = 0; i < businessImages.length && downloadedCount < TARGET_IMAGES; i++) {
      const img = businessImages[i];
      const filename = `business-${downloadedCount + 1}.jpg`;
      const localPath = path.join(imagesDir, filename);
      try {
        await downloadFile(img.src, localPath);
        const stats = await fs.stat(localPath);
        if (stats.size > 5000) {
          results.push({ url: img.src, localPath: `/images/${filename}`, altText: img.alt || 'business image', source: 'business_website' });
          downloadedCount++;
          console.log(`[ImageDownloader]   ✓ ${filename} — real business image (${Math.round(stats.size / 1024)}KB)`);
        } else { await fs.unlink(localPath).catch(() => {}); }
      } catch { await fs.unlink(localPath).catch(() => {}); }
    }
    console.log(`[ImageDownloader] Got ${downloadedCount}/${TARGET_IMAGES} from business website`);
  }

  // Use LLM suggestions to pick matching photos from library
  if (downloadedCount < TARGET_IMAGES && imageSuggestions.length > 0) {
    console.log(`[ImageDownloader] Matching LLM suggestions to photo library...`);
    const usedPhotoIds = new Set();

    for (let i = 0; i < imageSuggestions.length && downloadedCount < TARGET_IMAGES; i++) {
      const suggestion = imageSuggestions[i];
      const searchTerm = (suggestion.search_term || suggestion.purpose || '').toLowerCase();
      if (!searchTerm) continue;

      const photoId = findBestPhoto(searchTerm, usedPhotoIds);
      if (!photoId) continue;
      usedPhotoIds.add(photoId);

      const filename = `business-${downloadedCount + 1}.jpg`;
      const localPath = path.join(imagesDir, filename);
      const url = `https://images.unsplash.com/${photoId}?w=1600&h=900&fit=crop&q=80`;

      try {
        await downloadFile(url, localPath);
        const stats = await fs.stat(localPath);
        if (stats.size > 5000) {
          results.push({ url, localPath: `/images/${filename}`, altText: suggestion.purpose || searchTerm, source: 'unsplash_matched', purpose: suggestion.purpose || '' });
          downloadedCount++;
          console.log(`[ImageDownloader]   ✓ ${filename} — "${searchTerm.slice(0, 40)}" (${Math.round(stats.size / 1024)}KB) [${suggestion.purpose || ''}]`);
        } else { await fs.unlink(localPath).catch(() => {}); }
      } catch (err) {
        await fs.unlink(localPath).catch(() => {});
        console.log(`[ImageDownloader]   ✗ ${filename} — failed: ${err.message}`);
      }
    }
  }

  // Fill remaining with industry-based photos
  if (downloadedCount < TARGET_IMAGES) {
    const industry = (businessData.industry || '').toLowerCase();
    const industryPhotos = findIndustryPhotos(industry);
    const usedIds = new Set(results.map(r => r.url));

    console.log(`[ImageDownloader] Filling ${TARGET_IMAGES - downloadedCount} remaining with industry photos...`);
    for (const photoId of industryPhotos) {
      if (downloadedCount >= TARGET_IMAGES) break;
      const url = `https://images.unsplash.com/${photoId}?w=1600&h=900&fit=crop&q=80`;
      if (usedIds.has(url)) continue;

      const filename = `business-${downloadedCount + 1}.jpg`;
      const localPath = path.join(imagesDir, filename);
      try {
        await downloadFile(url, localPath);
        const stats = await fs.stat(localPath);
        if (stats.size > 5000) {
          results.push({ url, localPath: `/images/${filename}`, altText: `${industry} image`, source: 'unsplash_industry' });
          downloadedCount++;
          usedIds.add(url);
          console.log(`[ImageDownloader]   ✓ ${filename} — industry photo (${Math.round(stats.size / 1024)}KB)`);
        } else { await fs.unlink(localPath).catch(() => {}); }
      } catch { await fs.unlink(localPath).catch(() => {}); }
    }
  }

  // Last resort — copy first successful image
  if (downloadedCount < TARGET_IMAGES && downloadedCount > 0) {
    const firstPath = path.join(imagesDir, 'business-1.jpg');
    while (downloadedCount < TARGET_IMAGES) {
      const filename = `business-${downloadedCount + 1}.jpg`;
      try {
        await fs.copyFile(firstPath, path.join(imagesDir, filename));
        results.push({ url: '', localPath: `/images/${filename}`, altText: '', source: 'fallback_copy' });
        downloadedCount++;
      } catch { break; }
    }
  }

  console.log(`[ImageDownloader] Done: ${results.filter(r => r.source !== 'fallback_copy').length} unique + ${results.filter(r => r.source === 'fallback_copy').length} fallback = ${downloadedCount} total`);
  return results;
}

function findBestPhoto(searchTerm, usedIds) {
  const words = searchTerm.split(/[\s,]+/).filter(w => w.length > 2);
  let bestMatch = null;
  let bestScore = 0;

  for (const [keyword, photos] of Object.entries(PHOTO_LIBRARY)) {
    let score = 0;
    for (const word of words) {
      if (word === keyword) score += 10;
      else if (keyword.includes(word)) score += 5;
      else if (word.includes(keyword)) score += 4;
      else if (word.slice(0, 4) === keyword.slice(0, 4) && word.length > 3) score += 3;
    }
    if (searchTerm.includes(keyword)) score += 7;

    if (score > bestScore) {
      const available = photos.filter(p => !usedIds.has(p));
      if (available.length > 0) {
        bestScore = score;
        bestMatch = available[0];
      }
    }
  }

  return bestMatch;
}

function findIndustryPhotos(industry) {
  const allPhotos = [];
  const keywords = industry.split(/[\s_-]+/).filter(w => w.length > 2);

  for (const [key, photos] of Object.entries(PHOTO_LIBRARY)) {
    for (const word of keywords) {
      if (key.includes(word) || word.includes(key)) {
        allPhotos.push(...photos);
        break;
      }
    }
  }

  if (allPhotos.length === 0) {
    allPhotos.push(...(PHOTO_LIBRARY.business || []), ...(PHOTO_LIBRARY.office || []));
  }

  return [...new Set(allPhotos)];
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', async () => {
        try { await fs.writeFile(dest, Buffer.concat(chunks)); resolve(); }
        catch (err) { reject(err); }
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Timeout')); });
  });
}

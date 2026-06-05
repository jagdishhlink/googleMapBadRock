import fs from 'fs/promises';
import path from 'path';
import slugifyLib from 'slugify';
import { downloadImages } from './image-downloader.js';

function slugify(name) {
  return slugifyLib(name, { lower: true, strict: true }).slice(0, 50);
}

let imagesAlreadyDownloaded = false;

export async function writeProject(state, baseOutputDir) {
  if (!state.businessData || !state.generatedFiles) {
    throw new Error('Cannot write project: missing business data or files');
  }

  const projectSlug = slugify(state.businessData.name);
  const projectDir = path.resolve(baseOutputDir, projectSlug);

  await fs.mkdir(projectDir, { recursive: true });

  for (const file of state.generatedFiles.files) {
    const filePath = path.join(projectDir, file.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content, 'utf-8');
  }

  if (!imagesAlreadyDownloaded) {
    imagesAlreadyDownloaded = true;
    const imageSuggestions = state.imageSuggestions || [];
    const existingWebsite = state.existingWebsite || null;
    const downloadedImages = await downloadImages([], projectDir, state.businessData, imageSuggestions, existingWebsite);
    const fromBusiness = downloadedImages.filter(img => img.source === 'business_website').length;
    const fromStock = downloadedImages.filter(img => img.source !== 'business_website' && img.source !== 'fallback_copy').length;
    console.log(`[ProjectWriter] Images: ${fromBusiness} business + ${fromStock} stock = ${downloadedImages.length} total`);
  }

  const manifest = {
    business: state.businessData.name,
    industry: state.businessData.industry,
    filesGenerated: state.generatedFiles.files.length,
    websiteMode: state.websiteMode || 'new',
    stage: state.stage,
    verificationAttempts: state.verificationAttempts,
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(projectDir, '.agent-web-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  return projectDir;
}

export { slugify };

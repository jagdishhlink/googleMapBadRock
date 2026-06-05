import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const KEY_FILE = path.resolve(__dirname, '../../', process.env.GOOGLE_KEY_FILE || 'scrapper_google.json');

async function getAuth() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

function getSheetName() {
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

function buildClientMessage(state) {
  const bd = state.businessData || {};
  const mode = state.websiteMode || 'new';
  const ew = state.existingWebsite;

  if (mode === 'redesign' && ew) {
    const weaknessCount = (ew.weaknesses || []).length;
    const pagesBuilt = state.websitePlan?.pages?.length || 0;
    return `Hi! We've redesigned your website for ${bd.name}. Your old website had ${weaknessCount} issues that we've fixed. The new version has ${pagesBuilt} premium pages with modern design, better SEO, mobile-friendly layout, and clear call-to-action buttons. Your business photos have been reused where relevant. Please review and let us know if you'd like any changes!`;
  }

  const pagesBuilt = state.websitePlan?.pages?.length || 0;
  return `Hi! We've created a brand new website for ${bd.name}. Your business didn't have a website before, so we built one from scratch with ${pagesBuilt} pages including homepage, services, about, and contact. It features modern design, mobile-friendly layout, SEO optimization, and click-to-call buttons. Please review and let us know your feedback!`;
}

function buildImprovements(state) {
  const mode = state.websiteMode || 'new';
  const ew = state.existingWebsite;

  if (mode !== 'redesign' || !ew) {
    return 'New website created from scratch — no existing site to compare.';
  }

  const improvements = [];

  // List weaknesses we fixed
  for (const weakness of (ew.weaknesses || [])) {
    if (weakness.includes('meta description')) {
      improvements.push('✅ Added SEO meta description (was missing)');
    } else if (weakness.includes('structured data')) {
      improvements.push('✅ Added structured data for Google rich snippets');
    } else if (weakness.includes('H1')) {
      improvements.push('✅ Fixed heading hierarchy for better SEO');
    } else if (weakness.includes('content sections')) {
      improvements.push('✅ Added more content sections for better engagement');
    } else if (weakness.includes('call-to-action')) {
      improvements.push('✅ Added clear Call-to-Action buttons');
    } else if (weakness.includes('images')) {
      improvements.push('✅ Added high-quality images throughout');
    } else if (weakness.includes('phone')) {
      improvements.push('✅ Added click-to-call phone button');
    } else if (weakness.includes('navigation')) {
      improvements.push('✅ Improved navigation with more pages');
    } else if (weakness.includes('Single-page')) {
      improvements.push('✅ Expanded to multi-page website');
    } else if (weakness.includes('color')) {
      improvements.push('✅ Improved brand colors and visual identity');
    } else if (weakness.includes('contact form')) {
      improvements.push('✅ Added contact form for lead generation');
    }
  }

  // General improvements always done in redesign
  improvements.push('✅ Modern responsive design (mobile + desktop)');
  improvements.push('✅ Faster loading speed with optimized images');
  improvements.push('✅ Professional premium look & feel');

  return improvements.join('\n');
}

function buildOldWebsiteIssues(state) {
  const ew = state.existingWebsite;
  if (!ew || !ew.isAccessible) return '';

  const issues = [];

  for (const weakness of (ew.weaknesses || [])) {
    if (weakness.includes('meta description')) {
      issues.push('❌ No SEO meta description — Google shows random text in search results');
    } else if (weakness.includes('structured data')) {
      issues.push('❌ No structured data — missing star ratings and info in Google search');
    } else if (weakness.includes('No H1')) {
      issues.push('❌ No main heading — Google cannot understand page topic');
    } else if (weakness.includes('Multiple H1')) {
      issues.push('❌ Multiple main headings — confuses search engines');
    } else if (weakness.includes('content sections')) {
      issues.push('❌ Very few content sections — visitors leave quickly');
    } else if (weakness.includes('call-to-action')) {
      issues.push('❌ No clear action buttons — visitors don\'t know what to do next');
    } else if (weakness.includes('images')) {
      issues.push('❌ Few images — looks unprofessional and empty');
    } else if (weakness.includes('phone')) {
      issues.push('❌ No click-to-call button — mobile users can\'t call easily');
    } else if (weakness.includes('navigation')) {
      issues.push('❌ Poor navigation — visitors can\'t find information');
    } else if (weakness.includes('Single-page')) {
      issues.push('❌ Only one page — limited content, bad for SEO');
    } else if (weakness.includes('color')) {
      issues.push('❌ Weak brand colors — doesn\'t stand out from competitors');
    } else if (weakness.includes('contact form')) {
      issues.push('❌ No contact form — losing potential customer inquiries');
    }
  }

  return issues.join('\n') || 'No major issues detected';
}

export async function saveToGoogleSheet(state) {
  if (!SPREADSHEET_ID) {
    console.log('[GoogleSheets] No GOOGLE_SPREADSHEET_ID set, skipping...');
    return;
  }

  try {
    const authClient = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const sheetName = getSheetName();

    await ensureSheetExists(sheets, sheetName);

    const headersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:T1`,
    });

    if (!headersRes.data.values || headersRes.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:T1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'Date',
            'Business Name',
            'Industry',
            'Phone',
            'Address',
            'Google Rating',
            'Reviews',
            'Google Maps Link',
            'Old Website',
            'Mode (New/Redesign)',
            'Message to Client',
            'Old Website Issues',
            'Improvements Made',
            'Pages Built',
            'Design Style',
            'Generation Time',
            'Live Website URL',
            'GitHub Repository',
            'Status',
            'Notes',
          ]],
        },
      });
    }

    const bd = state.businessData || {};
    const mode = state.websiteMode || 'new';
    const ew = state.existingWebsite;

    const row = [
      // Date
      new Date().toISOString().split('T')[0],
      // Business Name
      bd.name || '',
      // Industry
      bd.industry || '',
      // Phone
      bd.phone || '',
      // Address
      bd.address || '',
      // Google Rating
      bd.rating ? `${bd.rating}/5` : '',
      // Reviews
      bd.reviewCount ? `${bd.reviewCount} reviews` : '',
      // Google Maps Link
      state.googleMapsUrl || '',
      // Old Website
      bd.website || 'No website',
      // Mode
      mode === 'redesign' ? '🔄 Redesign' : '🆕 New Website',
      // Message to Client
      buildClientMessage(state),
      // Old Website Issues
      mode === 'redesign' ? buildOldWebsiteIssues(state) : 'N/A — No old website existed',
      // Improvements Made
      buildImprovements(state),
      // Pages Built
      (state.websitePlan?.pages || []).map(p => p.slug || p.title).join(', ') || '',
      // Design Style
      state.websiteDna ? `${state.websiteDna.design_archetype} — ${state.websiteDna.uniqueness_factor || ''}` : '',
      // Generation Time
      state.generationTime ? `${state.generationTime} min` : '',
      // Live Website URL
      state.liveUrl || '',
      // GitHub Repository
      state.githubUrl || '',
      // Status
      state.stage === 'complete' ? '✅ Complete' : state.stage === 'failed' ? '❌ Failed' : '⚠️ Partial',
      // Notes
      mode === 'redesign' && ew
        ? `Crawled ${(ew.pages?.length || 0) + 1} pages, found ${ew.allImages?.length || 0} images, fixed ${ew.weaknesses?.length || 0} issues`
        : `Generated ${state.generatedFiles?.files?.length || 0} files`,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:T`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    console.log(`[GoogleSheets] ✓ Saved to "${sheetName}" — ${mode === 'redesign' ? '🔄 Redesign' : '🆕 New'} for "${bd.name}"`);
  } catch (error) {
    console.log(`[GoogleSheets] ✗ Error: ${error.message}`);
  }
}

async function ensureSheetExists(sheets, sheetName) {
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = res.data.sheets.map(s => s.properties.title);

    if (!existingSheets.includes(sheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetName },
            },
          }],
        },
      });
      console.log(`[GoogleSheets] Created new sheet: "${sheetName}"`);
    }
  } catch (error) {
    console.log(`[GoogleSheets] Sheet check error: ${error.message}`);
  }
}

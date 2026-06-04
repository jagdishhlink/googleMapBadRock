import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESIGN_RULES_DIR = path.resolve(__dirname, '../../design-rules');

// Map industries to best-matching design systems from all 73 available
const INDUSTRY_TO_DESIGN = {
  // Food & Beverage
  restaurant: ['starbucks', 'airbnb', 'uber'],
  cafe: ['starbucks', 'airbnb', 'uber'],
  food: ['starbucks', 'uber', 'airbnb'],
  bakery: ['starbucks', 'airbnb', 'pinterest'],
  bar: ['spotify', 'uber', 'starbucks'],
  pizza: ['starbucks', 'uber', 'airbnb'],
  biryani: ['starbucks', 'uber', 'airbnb'],
  punjabi: ['starbucks', 'uber', 'airbnb'],
  dhaba: ['starbucks', 'uber', 'airbnb'],

  // Hospitality & Travel
  hotel: ['airbnb', 'uber', 'apple'],
  hospitality: ['airbnb', 'uber', 'apple'],
  resort: ['airbnb', 'apple', 'framer'],
  travel: ['airbnb', 'uber', 'spotify'],

  // Beauty & Wellness
  salon: ['framer', 'spotify', 'pinterest'],
  beauty: ['framer', 'pinterest', 'spotify'],
  spa: ['apple', 'framer', 'pinterest'],
  skincare: ['framer', 'apple', 'pinterest'],
  cosmetics: ['framer', 'pinterest', 'apple'],

  // Fitness & Sports
  gym: ['nike', 'tesla', 'spacex'],
  fitness: ['nike', 'tesla', 'uber'],
  yoga: ['framer', 'apple', 'cal'],
  sports: ['nike', 'tesla', 'playstation'],
  crossfit: ['nike', 'spacex', 'tesla'],

  // Medical & Health
  dental: ['stripe', 'linear.app', 'vercel'],
  medical: ['stripe', 'linear.app', 'intercom'],
  healthcare: ['stripe', 'linear.app', 'notion'],
  clinic: ['stripe', 'linear.app', 'vercel'],
  hospital: ['stripe', 'ibm', 'intercom'],
  pharmacy: ['stripe', 'shopify', 'intercom'],
  doctor: ['stripe', 'linear.app', 'vercel'],
  veterinary: ['intercom', 'stripe', 'notion'],

  // Legal & Professional
  law: ['stripe', 'ibm', 'hashicorp'],
  legal: ['stripe', 'ibm', 'hashicorp'],
  attorney: ['stripe', 'ibm', 'notion'],
  advocate: ['stripe', 'ibm', 'hashicorp'],
  consulting: ['stripe', 'notion', 'linear.app'],
  accounting: ['stripe', 'wise', 'ibm'],

  // Retail & Shopping
  retail: ['shopify', 'apple', 'nike'],
  shop: ['shopify', 'apple', 'nike'],
  store: ['shopify', 'apple', 'stripe'],
  ecommerce: ['shopify', 'stripe', 'vercel'],
  wholesale: ['shopify', 'stripe', 'ibm'],
  fashion: ['nike', 'framer', 'apple'],
  clothing: ['nike', 'shopify', 'framer'],
  jewelry: ['apple', 'framer', 'shopify'],
  furniture: ['airbnb', 'apple', 'framer'],
  grocery: ['shopify', 'uber', 'starbucks'],

  // Electrical & Hardware
  electrical: ['shopify', 'stripe', 'vercel'],
  electronics: ['apple', 'dell-1996', 'nvidia'],
  hardware: ['shopify', 'ibm', 'hashicorp'],
  appliance: ['apple', 'shopify', 'stripe'],
  lighting: ['framer', 'apple', 'vercel'],
  plumbing: ['ibm', 'shopify', 'stripe'],

  // Technology & Software
  tech: ['vercel', 'linear.app', 'stripe'],
  software: ['vercel', 'linear.app', 'supabase'],
  saas: ['vercel', 'stripe', 'linear.app'],
  startup: ['vercel', 'linear.app', 'supabase'],
  ai: ['opencode.ai', 'x.ai', 'claude'],
  cloud: ['vercel', 'supabase', 'mongodb'],
  hosting: ['vercel', 'supabase', 'clickhouse'],

  // Finance & Banking
  finance: ['stripe', 'wise', 'revolut'],
  bank: ['stripe', 'wise', 'revolut'],
  insurance: ['stripe', 'intercom', 'ibm'],
  investment: ['stripe', 'wise', 'ibm'],
  crypto: ['binance', 'coinbase', 'kraken'],

  // Automotive
  auto: ['tesla', 'bmw', 'uber'],
  car: ['tesla', 'bmw', 'ferrari'],
  mechanic: ['uber', 'tesla', 'warp'],
  garage: ['tesla', 'uber', 'spacex'],
  bike: ['nike', 'tesla', 'uber'],

  // Education
  education: ['notion', 'linear.app', 'cal'],
  school: ['notion', 'intercom', 'cal'],
  tutor: ['notion', 'cal', 'intercom'],
  coaching: ['notion', 'nike', 'cal'],
  university: ['ibm', 'notion', 'stripe'],

  // Creative & Media
  photography: ['framer', 'pinterest', 'apple'],
  creative: ['framer', 'figma', 'webflow'],
  design: ['figma', 'framer', 'webflow'],
  agency: ['vercel', 'framer', 'webflow'],
  marketing: ['hubspot', 'intercom', 'posthog'],
  media: ['spotify', 'theverge', 'wired'],
  video: ['runwayml', 'spotify', 'framer'],
  music: ['spotify', 'apple', 'framer'],

  // Construction & Real Estate
  construction: ['spacex', 'hashicorp', 'ibm'],
  real_estate: ['airbnb', 'stripe', 'intercom'],
  architect: ['framer', 'apple', 'vercel'],
  interior: ['framer', 'pinterest', 'airbnb'],
  builder: ['spacex', 'tesla', 'hashicorp'],

  // Services
  cleaning: ['intercom', 'uber', 'stripe'],
  laundry: ['uber', 'intercom', 'stripe'],
  courier: ['uber', 'stripe', 'vercel'],
  delivery: ['uber', 'stripe', 'shopify'],
  repair: ['uber', 'shopify', 'stripe'],
  pest_control: ['intercom', 'stripe', 'ibm'],
  security: ['ibm', 'hashicorp', 'sentry'],
  event: ['airbnb', 'cal', 'spotify'],
  wedding: ['framer', 'pinterest', 'airbnb'],
  catering: ['starbucks', 'airbnb', 'uber'],
  printing: ['figma', 'shopify', 'framer'],

  // Luxury & Premium
  luxury: ['ferrari', 'bugatti', 'lamborghini'],
  premium: ['apple', 'tesla', 'bmw'],

  // Gaming & Entertainment
  gaming: ['playstation', 'nvidia', 'spacex'],
  entertainment: ['spotify', 'playstation', 'netflix'],

  // Telecom & Connectivity
  telecom: ['vodafone', 'apple', 'ibm'],
  mobile: ['apple', 'vodafone', 'uber'],
  internet: ['vercel', 'vodafone', 'stripe'],

  default: ['vercel', 'stripe', 'linear.app'],
};

export function matchDesignSystem(industry, businessName = '') {
  const normalized = (industry || '').toLowerCase().replace(/[\s_-]/g, '');
  const nameLower = (businessName || '').toLowerCase();

  // Find best match — check all keywords
  let designs = null;
  let bestScore = 0;

  for (const [key, value] of Object.entries(INDUSTRY_TO_DESIGN)) {
    if (key === 'default') continue;

    let score = 0;
    if (normalized === key) score = 10;
    else if (normalized.includes(key)) score = 8;
    else if (key.includes(normalized) && normalized.length > 3) score = 6;
    else if (nameLower.includes(key)) score = 4;

    if (score > bestScore) {
      bestScore = score;
      designs = value;
    }
  }

  if (!designs) designs = INDUSTRY_TO_DESIGN.default;

  // Try each design system in order, return first that exists
  for (const design of designs) {
    const designPath = path.join(DESIGN_RULES_DIR, design, 'DESIGN.md');
    if (fs.existsSync(designPath)) {
      return {
        name: design,
        path: designPath,
        content: fs.readFileSync(designPath, 'utf-8'),
      };
    }
  }

  // Fallback to vercel
  const fallbackPath = path.join(DESIGN_RULES_DIR, 'vercel', 'DESIGN.md');
  return {
    name: 'vercel',
    path: fallbackPath,
    content: fs.existsSync(fallbackPath) ? fs.readFileSync(fallbackPath, 'utf-8') : '',
  };
}

export function getDesignContext(designSystem) {
  const content = designSystem.content;
  if (!content) return '';

  const lines = content.split('\n');
  // Extract key sections: colors, typography, spacing, components (skip verbose explanations)
  const keyLines = [];
  let inSection = false;
  let lineCount = 0;
  const maxLines = 300;

  for (const line of lines) {
    if (lineCount >= maxLines) break;
    // Prioritize lines with actual design values
    if (line.match(/^#{1,3}\s/) || line.match(/#[0-9a-fA-F]{3,8}/) || line.match(/\d+px/) || line.match(/font|color|spacing|radius|shadow|padding|margin/i)) {
      keyLines.push(line);
      inSection = true;
      lineCount++;
    } else if (inSection && line.trim()) {
      keyLines.push(line);
      lineCount++;
    } else if (!line.trim()) {
      inSection = false;
      if (keyLines.length > 0 && keyLines[keyLines.length - 1] !== '') {
        keyLines.push('');
        lineCount++;
      }
    }
  }

  const trimmed = keyLines.join('\n').slice(0, 6000);

  // Extract concrete colors for quick reference
  const colors = extractColorsFromDesign(content);
  const colorSummary = colors ? `
QUICK COLOR REFERENCE (use these exact values):
  Primary: ${colors.primary}
  Secondary/Dark: ${colors.secondary}
  Accent: ${colors.accent}
  Text: ${colors.ink}
  Background: ${colors.canvas}
  Muted text: ${colors.mute}` : '';

  return `DESIGN SYSTEM: "${designSystem.name}"-inspired design
Apply this design system's visual language — colors, typography, spacing, and component styling:
${colorSummary}

${trimmed}

KEY DESIGN RULES:
- Use EXACT hex color values in Tailwind arbitrary values like bg-[${colors?.primary || '#533afd'}]
- Match font sizes, weights, and letter-spacing for headings vs body
- Use consistent border-radius values throughout
- Follow button styling (padding, rounded, colors, hover states)
- Apply the overall aesthetic: ${designSystem.name} is ${designSystem.name === 'nike' ? 'bold and energetic' : designSystem.name === 'apple' ? 'minimal and premium' : designSystem.name === 'stripe' ? 'clean and professional' : designSystem.name === 'framer' ? 'creative and modern' : designSystem.name === 'airbnb' ? 'warm and welcoming' : 'modern and polished'}
- Use consistent spacing from this system`;
}

export function getDesignForPrompt(industry, businessName) {
  const design = matchDesignSystem(industry, businessName);
  return {
    designName: design.name,
    context: getDesignContext(design),
    colors: extractColorsFromDesign(design.content),
  };
}

function extractColorsFromDesign(content) {
  if (!content) return null;

  const getColor = (patterns) => {
    for (const pattern of patterns) {
      const match = content.match(new RegExp(`${pattern}\\s*["']?(#[0-9a-fA-F]{3,8})["']?`));
      if (match) return match[1];
    }
    return null;
  };

  return {
    primary: getColor(['primary:', 'primary":', 'brand:']) || '#1565C0',
    primaryDeep: getColor(['primary-deep', 'primary-press', 'primary-dark', 'primary-hover']) || '#0D47A1',
    secondary: getColor(['secondary', 'brand-dark', 'ink:']) || '#0D47A1',
    accent: getColor(['accent', 'highlight', 'warning:', 'success:']) || '#FF8F00',
    ink: getColor(['ink:', 'text:', 'foreground:']) || '#171717',
    mute: getColor(['mute', 'body:', 'text-secondary', 'ink-mute']) || '#6b7280',
    canvas: getColor(['canvas:', 'background:', 'surface:']) || '#ffffff',
    canvasSoft: getColor(['canvas-soft', 'background-soft', 'surface-secondary', 'canvas-soft:']) || '#f9fafb',
  };
}

export function listAvailableDesigns() {
  try {
    return fs.readdirSync(DESIGN_RULES_DIR).filter(d =>
      fs.existsSync(path.join(DESIGN_RULES_DIR, d, 'DESIGN.md'))
    );
  } catch {
    return [];
  }
}

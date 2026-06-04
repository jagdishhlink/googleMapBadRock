export function createWebsitePlan(data = {}) {
  return {
    pages: data.pages || [],
    navigation: data.navigation || [],
    theme: data.theme || createThemeConfig(),
    features: data.features || [],
    contentPlan: data.contentPlan || data.content_plan || {},
    targetAudience: data.targetAudience || data.target_audience || '',
    tone: data.tone || 'professional',
  };
}

export function createPageSpec(slug, title, description, sections = [], isDynamic = false) {
  return { slug, title, description, sections, isDynamic };
}

export function createNavItem(label, href, children = []) {
  return { label, href, children };
}

export function createThemeConfig(data = {}) {
  return {
    primaryColor: data.primaryColor || data.primary_color || '#2563eb',
    secondaryColor: data.secondaryColor || data.secondary_color || '#1e40af',
    accentColor: data.accentColor || data.accent_color || '#f59e0b',
    fontHeading: data.fontHeading || data.font_heading || 'Inter',
    fontBody: data.fontBody || data.font_body || 'Inter',
    style: data.style || 'modern',
  };
}

export function createFeatureSpec(name, description, page) {
  return { name, description, page };
}

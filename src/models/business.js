export function createBusinessInfo(data = {}) {
  return {
    name: data.name || '',
    industry: data.industry || '',
    categories: data.categories || [],
    address: data.address || '',
    phone: data.phone || '',
    website: data.website || '',
    hours: data.hours || {},
    rating: data.rating || null,
    reviewCount: data.reviewCount || null,
    reviews: data.reviews || [],
    images: data.images || [],
    description: data.description || '',
    priceLevel: data.priceLevel || '',
  };
}

export function createImageAsset(url, localPath = '', altText = '') {
  return { url, localPath, altText };
}

export function createReviewSnippet(author, rating, text) {
  return { author, rating, text };
}

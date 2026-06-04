export const PipelineStage = {
  SCRAPING: 'scraping',
  WEBSITE_DETECTION: 'website_detection',
  PLANNING: 'planning',
  CODE_GENERATION: 'code_generation',
  VERIFICATION: 'verification',
  COMPLETE: 'complete',
  FAILED: 'failed',
};

export const WebsiteMode = {
  NEW: 'new',
  REDESIGN: 'redesign',
};

export function createPipelineState(googleMapsUrl, maxAttempts = 3) {
  return {
    googleMapsUrl,
    stage: PipelineStage.SCRAPING,
    businessData: null,
    websiteMode: WebsiteMode.NEW,
    existingWebsite: null,
    websitePlan: null,
    generatedFiles: null,
    verificationResult: null,
    verificationAttempts: 0,
    maxVerificationAttempts: maxAttempts,
    errors: [],
  };
}

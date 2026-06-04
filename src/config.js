import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export function getConfig(overrides = {}) {
  return {
    // LLM Provider: "groq" | "bedrock" | "groq-with-fallback"
    llmProvider: overrides.llmProvider || process.env.LLM_PROVIDER || 'bedrock',

    // Groq
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

    // AWS Bedrock
    awsRegion: overrides.awsRegion || process.env.AGENT_WEB_AWS_REGION || process.env.AWS_REGION || 'us-east-1',
    awsAccessKeyId: overrides.awsAccessKeyId || process.env.AGENT_WEB_AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: overrides.awsSecretAccessKey || process.env.AGENT_WEB_AWS_SECRET_ACCESS_KEY || '',
    bedrockModelId: overrides.bedrockModelId || process.env.AGENT_WEB_BEDROCK_MODEL_ID || process.env.AI_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0',

    // General
    maxTokens: overrides.maxTokens || parseInt(process.env.AGENT_WEB_MAX_TOKENS || '16384'),
    maxVerificationRetries: overrides.maxVerificationRetries || parseInt(process.env.AGENT_WEB_MAX_VERIFICATION_RETRIES || '1'),
    outputDir: overrides.outputDir || process.env.AGENT_WEB_OUTPUT_DIR || './output',
    headlessBrowser: overrides.headlessBrowser !== undefined ? overrides.headlessBrowser : process.env.AGENT_WEB_HEADLESS_BROWSER !== 'false',
    defaultGoogleMapsUrl: process.env.GOOGLE_MAPS_URL || '',
  };
}

import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Groq from 'groq-sdk';

export class BaseAgent {
  constructor(config) {
    this.config = config;
    this.llmProvider = config.llmProvider || 'bedrock';
    this.maxTokens = config.maxTokens;
    this.name = 'base';

    // Initialize Groq client
    if (this.llmProvider === 'groq' || this.llmProvider === 'groq-with-fallback') {
      this.groqClient = new Groq({ apiKey: config.groqApiKey });
      this.groqModel = config.groqModel;
    }

    // Initialize Bedrock client
    if (this.llmProvider === 'bedrock' || this.llmProvider === 'groq-with-fallback') {
      this.bedrockClient = new AnthropicBedrock({
        awsRegion: config.awsRegion,
        awsAccessKey: config.awsAccessKeyId,
        awsSecretKey: config.awsSecretAccessKey,
      });
      this.bedrockModel = config.bedrockModelId;
    }
  }

  async callLLM(system, messages, maxTokensOverride) {
    const maxTokens = maxTokensOverride || this.maxTokens;

    if (this.llmProvider === 'groq') {
      return await this.callGroq(system, messages, maxTokens);
    }

    if (this.llmProvider === 'bedrock') {
      return await this.callBedrock(system, messages, maxTokens);
    }

    // groq-with-fallback: try Groq first, fallback to Bedrock
    try {
      return await this.callGroq(system, messages, maxTokens);
    } catch (err) {
      this.log(`Groq failed (${err.message}), falling back to Bedrock...`);
      return await this.callBedrock(system, messages, maxTokens);
    }
  }

  async callGroq(system, messages, maxTokens) {
    // Groq free tier has lower limits — cap tokens
    const groqMaxTokens = Math.min(maxTokens, 8000);

    const groqMessages = [
      { role: 'system', content: system },
      ...messages.map(m => {
        // Groq doesn't support image content, convert to text only
        if (Array.isArray(m.content)) {
          const textParts = m.content.filter(p => p.type === 'text').map(p => p.text);
          return { role: m.role, content: textParts.join('\n') };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    // Truncate system prompt if too long for Groq
    if (groqMessages[0].content.length > 4000) {
      groqMessages[0].content = groqMessages[0].content.slice(0, 4000);
    }

    // Truncate user message if too long
    const lastMsg = groqMessages[groqMessages.length - 1];
    if (lastMsg.content.length > 6000) {
      lastMsg.content = lastMsg.content.slice(0, 6000);
    }

    const response = await this.groqClient.chat.completions.create({
      model: this.groqModel,
      messages: groqMessages,
      max_tokens: groqMaxTokens,
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  }

  async callBedrock(system, messages, maxTokens) {
    const response = await this.bedrockClient.messages.create({
      model: this.bedrockModel,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system }],
      messages,
    });

    let text = response.content[0].text;

    // Handle truncation — continue if max_tokens hit
    if (response.stop_reason === 'max_tokens') {
      const continuation = await this.bedrockClient.messages.create({
        model: this.bedrockModel,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: system }],
        messages: [
          ...messages,
          { role: 'assistant', content: text },
          { role: 'user', content: 'Continue exactly where you left off. Do not repeat any code already written.' },
        ],
      });
      text += continuation.content[0].text;
    }

    return text;
  }

  async callLLMJson(system, messages) {
    const raw = await this.callLLM(system, messages);
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    return JSON.parse(cleaned.trim());
  }

  async run(state) {
    throw new Error('run() must be implemented by subclass');
  }

  log(msg) {
    console.log(`[${this.name}] ${msg}`);
  }
}

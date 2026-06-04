import { ScraperAgent } from '../agents/scraper-agent.js';
import { PlannerAgent } from '../agents/planner-agent.js';
import { ContentAgent } from '../agents/content-agent.js';
import { CodeGenAgent } from '../agents/codegen-agent.js';
import { VerifierAgent } from '../agents/verifier-agent.js';
import { createPipelineState, PipelineStage } from '../models/pipeline-state.js';
import { writeProject } from '../output/project-writer.js';

export class WebsitePipeline {
  constructor(config) {
    this.config = config;
    this.scraper = new ScraperAgent(config);
    this.planner = new PlannerAgent(config);
    this.content = new ContentAgent(config);
    this.codegen = new CodeGenAgent(config);
    this.verifier = new VerifierAgent(config);
  }

  async run(googleMapsUrl) {
    let state = createPipelineState(googleMapsUrl, this.config.maxVerificationRetries);

    state = await this.scraper.run(state);
    if (state.stage === PipelineStage.FAILED) return state;

    state = await this.planner.run(state);
    if (state.stage === PipelineStage.FAILED) return state;

    state = await this.content.run(state);

    while (state.verificationAttempts < state.maxVerificationAttempts) {
      state = await this.codegen.run(state);
      if (state.stage === PipelineStage.FAILED) return state;

      if (state.generatedFiles && state.generatedFiles.files.length > 0) {
        await writeProject(state, this.config.outputDir);
      }

      state = await this.verifier.run(state);

      if (state.verificationResult && state.verificationResult.isValid) {
        state.stage = PipelineStage.COMPLETE;
        break;
      }

      state.verificationAttempts++;
    }

    if (state.generatedFiles && state.generatedFiles.files.length > 0) {
      await writeProject(state, this.config.outputDir);
    }

    if (state.stage !== PipelineStage.COMPLETE) {
      state.stage = PipelineStage.FAILED;
    }

    return state;
  }
}

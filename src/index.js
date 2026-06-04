#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from './config.js';
import { WebsitePipeline } from './orchestrator/pipeline.js';
import { slugify } from './output/project-writer.js';

const program = new Command();

program
  .name('agent-web')
  .description('Generate websites from Google Maps business listings')
  .argument('[url]', 'Google Maps business URL (or set GOOGLE_MAPS_URL in .env)')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-m, --model <id>', 'AWS Bedrock model ID')
  .option('--region <region>', 'AWS region')
  .option('-r, --retries <n>', 'Max verification retries', '3')
  .option('--no-headless', 'Run browser with UI (not headless)')
  .action(async (urlArg, options) => {
    const config = getConfig({
      outputDir: options.output,
      bedrockModelId: options.model,
      awsRegion: options.region,
      maxVerificationRetries: parseInt(options.retries),
      headlessBrowser: options.headless !== false,
    });

    const url = urlArg || config.defaultGoogleMapsUrl;
    if (!url) {
      console.log(chalk.red('\n  Error: No URL provided. Pass a Google Maps URL or set GOOGLE_MAPS_URL in .env\n'));
      process.exit(1);
    }

    console.log(chalk.blue.bold('\n  Agent Web - Website Generator\n'));
    console.log(`  URL: ${url}`);
    console.log(`  Model: ${config.bedrockModelId} (${config.awsRegion})\n`);

    const pipeline = new WebsitePipeline(config);
    const spinner = ora('Starting pipeline...').start();

    try {
      spinner.text = 'Stage 1: Scraping Google Maps...';
      const state = await pipeline.run(url);
      spinner.stop();

      if (state.stage === 'complete') {
        const projectName = slugify(state.businessData.name);
        console.log(chalk.green.bold('\n  Success!'));
        console.log(`  Website generated at: ${config.outputDir}/${projectName}`);
        console.log(`  Files: ${state.generatedFiles.files.length}`);
        console.log(`  Verification attempts: ${state.verificationAttempts + 1}`);
        console.log('\n  To run the website:');
        console.log(`    cd ${config.outputDir}/${projectName}`);
        console.log('    npm install');
        console.log('    npm run dev\n');
      } else {
        console.log(chalk.red.bold('\n  Failed!'));
        console.log(`  Stage: ${state.stage}`);
        for (const error of state.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
        if (state.verificationResult) {
          const errors = state.verificationResult.issues.filter(i => i.severity === 'error');
          console.log(chalk.yellow(`  Verification errors: ${errors.length}`));
          for (const issue of errors.slice(0, 5)) {
            console.log(chalk.yellow(`    ${issue.filePath}:${issue.line} - ${issue.message}`));
          }
        }
        process.exit(1);
      }
    } catch (err) {
      spinner.stop();
      console.log(chalk.red.bold(`\n  Pipeline Error: ${err.message}\n`));
      process.exit(1);
    }
  });

program.parse();

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;

export async function pushToGitHub(projectDir, businessName) {
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER) {
    console.log('[GitHub] Missing credentials, skipping push...');
    return null;
  }

  const repoName = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  try {
    // Step 1: Create repo on GitHub (if not exists)
    const repoCreated = await createRepo(repoName, businessName);
    if (!repoCreated) {
      console.log(`[GitHub] Using existing repo: ${repoName}`);
    }

    const remoteUrl = `https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO_OWNER}/${repoName}.git`;

    // Step 2: Init git, commit, push
    if (!fs.existsSync(path.join(projectDir, '.git'))) {
      run('git init', projectDir);
    }

    const gitignore = `node_modules/\n.next/\n.env\n.env.local\n`;
    fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignore, 'utf-8');

    run('git config user.email "bot@agent-web.com"', projectDir);
    run('git config user.name "Agent Web Bot"', projectDir);

    run('git add -A', projectDir);

    try {
      run(`git commit -m "Generated website for ${businessName}"`, projectDir);
    } catch {
      run('git commit --allow-empty -m "Update website"', projectDir);
    }

    try { run('git remote remove origin', projectDir); } catch {}
    run(`git remote add origin ${remoteUrl}`, projectDir);

    run('git branch -M main', projectDir);
    run('git push -u origin main --force', projectDir);

    const repoUrl = `https://github.com/${GITHUB_REPO_OWNER}/${repoName}`;
    console.log(`[GitHub] ✓ Pushed to: ${repoUrl}`);
    return repoUrl;
  } catch (error) {
    console.log(`[GitHub] ✗ Error: ${error.message}`);
    return null;
  }
}

async function createRepo(repoName, description) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      name: repoName,
      description: `Generated website for ${description}`,
      private: false,
      auto_init: false,
    });

    const options = {
      hostname: 'api.github.com',
      path: '/user/repos',
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'AgentWeb/1.0',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(true);
        } else if (res.statusCode === 422) {
          // Repo already exists
          resolve(false);
        } else {
          resolve(false);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

function run(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: 'pipe', timeout: 30000 }).toString().trim();
}

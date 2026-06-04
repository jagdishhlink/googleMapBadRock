import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

export async function deployToVercel(projectDir, businessName) {
  if (!VERCEL_TOKEN) {
    console.log('[Vercel] No VERCEL_TOKEN set, skipping deploy...');
    return null;
  }

  const projectSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const absDir = path.resolve(projectDir);

  try {
    // Clean vercel config
    const vercelDir = path.join(absDir, '.vercel');
    if (fs.existsSync(vercelDir)) {
      fs.rmSync(vercelDir, { recursive: true, force: true });
    }

    // Simple vercel.json
    fs.writeFileSync(path.join(absDir, 'vercel.json'), JSON.stringify({
      framework: 'nextjs',
    }, null, 2));

    fs.writeFileSync(path.join(absDir, '.vercelignore'), 'node_modules\n.git\n.next\n');

    // Deploy using path as argument with scope
    let cmd = `npx vercel "${absDir}" --yes --prod --token="${VERCEL_TOKEN}" --confirm`;
    if (VERCEL_TEAM_ID) {
      cmd += ` --scope="${VERCEL_TEAM_ID}"`;
    }

    const output = execSync(cmd, {
      stdio: 'pipe',
      timeout: 300000,
      env: { ...process.env, FORCE_COLOR: '0' },
    }).toString().trim();

    // Production URL is always projectSlug.vercel.app (--prod assigns it)
    const deployUrl = `https://${projectSlug}.vercel.app`;

    console.log(`[Vercel] ✓ Deployed: ${deployUrl}`);
    return deployUrl;
  } catch (error) {
    const errOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;

    // Check if deploy actually succeeded (URL in output despite exit code)
    const urlMatch = errOutput.match(/https:\/\/[^\s]+\.vercel\.app/);
    if (urlMatch) {
      console.log(`[Vercel] ✓ Deployed: ${urlMatch[0]}`);
      return urlMatch[0];
    }

    console.log(`[Vercel] ✗ Deploy failed: ${errOutput.slice(0, 200)}`);
    return null;
  }
}

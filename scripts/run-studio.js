// Launch Drizzle Studio using remote D1 (d1-http driver) only.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function loadDevVars() {
  const devVarsPath = path.join(process.cwd(), '.dev.vars');
  if (!fs.existsSync(devVarsPath)) return;
  try {
    const lines = fs.readFileSync(devVarsPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      // Remove surrounding quotes if present
      let val = t.slice(eq + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (_) {}
}

function run() {
  // Load .dev.vars into process.env so remote creds work without manual export
  loadDevVars();

  const hasRemote = Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
  );

  if (hasRemote) {
    console.log('[drizzle:studio] Using remote D1 (d1-http driver)');
    return launchStudio({ ...process.env });
  }

  console.error('[drizzle:studio] Missing Cloudflare credentials for remote D1.');
  console.error('Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN in .dev.vars');
  process.exit(1);
}

function launchStudio(env) {
  let bin;
  try {
    bin = require.resolve('drizzle-kit/bin.cjs');
  } catch (e1) {
    const candidate = path.join(process.cwd(), 'node_modules', 'drizzle-kit', 'bin.cjs');
    if (fs.existsSync(candidate)) {
      bin = candidate;
    } else {
      // Fallback to platform-specific .bin shim
      const shim = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'drizzle-kit.cmd' : 'drizzle-kit');
      if (!fs.existsSync(shim)) {
        console.error('Could not resolve drizzle-kit CLI. Did you run `yarn install`?');
        process.exit(1);
      }
      // Spawn shim directly
      const shimChild = spawn(shim, ['studio'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
      shimChild.on('exit', (code) => process.exit(code ?? 0));
      return;
    }
  }

  const child = spawn(process.execPath, [bin, 'studio'], { stdio: 'inherit', env });
  child.on('exit', (code) => process.exit(code ?? 0));
}

run();

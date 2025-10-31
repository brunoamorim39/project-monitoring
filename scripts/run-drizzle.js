// Run drizzle-kit CLI with environment prepared.
// - Loads .dev.vars into process.env
// - Leaves d1-http (remote) vs sqlite (local) selection to drizzle.config.ts,
//   which checks CLOUDFLARE_* env vars.

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
      let val = t.slice(eq + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (_) {}
}

function run() {
  loadDevVars();
  const args = process.argv.slice(2);

  let bin;
  try {
    bin = require.resolve('drizzle-kit/bin.cjs');
  } catch (e) {
    const shim = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'drizzle-kit.cmd' : 'drizzle-kit');
    if (!fs.existsSync(shim)) {
      console.error('Could not resolve drizzle-kit CLI. Did you run `yarn install`?');
      process.exit(1);
    }
    const child = spawn(shim, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
    child.on('exit', code => process.exit(code ?? 0));
    return;
  }

  const child = spawn(process.execPath, [bin, ...args], { stdio: 'inherit', env: process.env });
  child.on('exit', code => process.exit(code ?? 0));
}

run();


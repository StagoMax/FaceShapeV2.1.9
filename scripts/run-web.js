const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const command = process.argv[2];

if (!command) {
  console.error('[web] Missing command. Usage: node scripts/run-web.js <dev|build|start|lint> [...args]');
  process.exit(1);
}

const envFile = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envFile)) {
  const result = dotenv.config({ path: envFile });
  if (result.error) {
    console.warn('[web] Failed to parse .env file:', result.error.message);
  } else {
    console.log('[web] Loaded variables from .env');
  }
} else {
  console.warn('[web] .env file not found, continuing without it');
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(
  npmCmd,
  ['run', '--workspace=apps/web', command, '--', ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

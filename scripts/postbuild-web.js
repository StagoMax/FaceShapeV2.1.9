const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const distDir = path.join(projectRoot, 'dist');

if (!fs.existsSync(publicDir)) {
  console.log('[postbuild] public/ not found, skipping.');
  process.exit(0);
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.cpSync(publicDir, distDir, { recursive: true });
console.log('[postbuild] Copied public/ to dist/.');

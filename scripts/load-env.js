const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_FILE = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(ENV_FILE)) {
  const result = dotenv.config({ path: ENV_FILE });
  if (result.error) {
    console.warn('[env] Failed to parse .env file:', result.error.message);
  } else {
    console.log('[env] Loaded variables from .env');
  }
} else {
  console.warn('[env] .env file not found, skipping load');
}


#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const path = require('path');

const SOUNDS_DIR = path.join(__dirname, 'frontend', 'public', 'sounds');

// Ensure directory exists
if (!fs.existsSync(SOUNDS_DIR)) {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

const SOUND_FILES = {
  success: "https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg",
  error: "https://actions.google.com/sounds/v1/cartoon/cartoon_cowbell.ogg"
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function prefetchSounds() {
  console.log("Fetching sound assets...");
  try {
    for (const [name, url] of Object.entries(SOUND_FILES)) {
      await downloadFile(url, path.join(SOUNDS_DIR, `${name}.ogg`));
      console.log(`Downloaded ${name}.ogg`);
    }
  } catch (e) {
    console.error(e);
  }
}

prefetchSounds();

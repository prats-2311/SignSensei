#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'frontend', 'public');
const VIDEOS_DIR = path.join(PUBLIC_DIR, 'videos', 'signs');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');

// Ensure directories exist
[VIDEOS_DIR, MODELS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// A standard test MP4 (Big Buck Bunny snippet) to act as a placeholder for our ASL signs
const PLACEHOLDER_VIDEO_URL = "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4";

// A standard Rive test asset (Marty the bird)
const RIVE_MASCOT_URL = "https://public.rive.app/community/runtime-files/3860-8025-marty.riv";

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function prefetchAssets() {
  console.log("Fetching demo assets...");
  
  try {
    // 1. Download Mascot
    console.log("Downloading Rive Mascot...");
    await downloadFile(RIVE_MASCOT_URL, path.join(MODELS_DIR, 'mascot.riv'));
    
    // 2. Download Core Vocabulary Placeholder Videos
    const coreSigns = ['hello', 'thank_you', 'yes', 'no', 'apple'];
    
    for (const sign of coreSigns) {
        console.log(`Downloading video for: ${sign}`);
        // In a real scenario, this would hit different URLs for each sign.
        // For this hackathon stub, we use the same placeholder video for all 5 to prove the dynamic routing works.
        await downloadFile(PLACEHOLDER_VIDEO_URL, path.join(VIDEOS_DIR, `${sign}.mp4`));
    }
    
    console.log("✅ All demo assets downloaded successfully!");
  } catch (err) {
    console.error("❌ Error downloading assets:", err);
  }
}

prefetchAssets();

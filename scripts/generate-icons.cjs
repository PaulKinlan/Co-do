/**
 * Icon Generation Script
 *
 * This script generates PNG icons from the SVG icon.
 * Run with: node scripts/generate-icons.js
 *
 * Note: This requires the 'sharp' package. Install with: npm install --save-dev sharp
 * Or you can manually create PNG icons from public/icon.svg using any image editing tool.
 */

const fs = require('fs');
const path = require('path');

// Create placeholder instructions
const instructions = `
ICON GENERATION INSTRUCTIONS
=============================

To create proper PWA icons, you need to generate PNG files from the SVG icon.

Option 1: Use an online tool
- Open public/icon.svg in any browser
- Use an online SVG to PNG converter (e.g., https://svgtopng.com)
- Generate 192x192 and 512x512 PNG versions
- Save them as public/icon-192.png and public/icon-512.png

Option 2: Use ImageMagick (if installed)
- Install ImageMagick: https://imagemagick.org/script/download.php
- Run these commands from the project root:

  magick public/icon.svg -resize 192x192 public/icon-192.png
  magick public/icon.svg -resize 512x512 public/icon-512.png

Option 3: Use sharp (Node.js package)
- Install sharp: npm install --save-dev sharp
- Then this script will automatically generate the icons

For now, we'll create placeholder icons that you should replace.
`;

console.log(instructions);

// Create placeholder icon files if they don't exist
const publicDir = path.join(__dirname, '..', 'public');

// Try to use sharp if available
try {
  const sharp = require('sharp');
  const svgPath = path.join(publicDir, 'icon.svg');

  console.log('Generating icons with sharp...');

  Promise.all([
    sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192.png')),
    sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'))
  ]).then(() => {
    console.log('✓ Icons generated successfully!');
  }).catch(err => {
    console.error('Error generating icons:', err);
  });
} catch (err) {
  console.log('Sharp not available. Please install it or use one of the manual methods above.');
  console.log('Run: npm install --save-dev sharp');
}

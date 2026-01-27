#!/usr/bin/env node

/**
 * Generate PWA icons from SVG
 *
 * This script requires @resvg/resvg-js to be installed:
 * npm install --save-dev @resvg/resvg-js
 *
 * Run with: node generate-icons.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('PWA Icon Generator');
console.log('==================\n');

// Read SVG file
const svgPath = path.join(__dirname, 'public', 'icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf-8');

// Generate 192x192 icon
console.log('Generating icon-192.png...');
const resvg192 = new Resvg(svgContent, {
  fitTo: { mode: 'width', value: 192 },
});
const png192 = resvg192.render();
const png192Path = path.join(__dirname, 'public', 'icon-192.png');
fs.writeFileSync(png192Path, png192.asPng());
console.log('✓ Created icon-192.png');

// Generate 512x512 icon
console.log('Generating icon-512.png...');
const resvg512 = new Resvg(svgContent, {
  fitTo: { mode: 'width', value: 512 },
});
const png512 = resvg512.render();
const png512Path = path.join(__dirname, 'public', 'icon-512.png');
fs.writeFileSync(png512Path, png512.asPng());
console.log('✓ Created icon-512.png');

console.log('\n✓ All icons generated successfully!');
console.log('\nGenerated files:');
console.log('  - public/icon-192.png (192x192)');
console.log('  - public/icon-512.png (512x512)');

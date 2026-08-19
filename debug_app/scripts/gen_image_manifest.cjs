const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, '..', 'public', 'puzzle_image');
const outFile = path.join(__dirname, '..', 'public', 'existing_images.json');

if (!fs.existsSync(imgDir)) {
  console.error('puzzle_image folder not found at:', imgDir);
  process.exit(1);
}

const files = fs.readdirSync(imgDir)
  .filter(f => f.toLowerCase().endsWith('.png'))
  .sort();

fs.writeFileSync(outFile, JSON.stringify(files, null, 0));
console.log(`✅ Written ${files.length} entries to existing_images.json`);
console.log('First 5:', files.slice(0, 5));

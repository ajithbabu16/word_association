import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');
const imageDir = path.join(__dirname, '../puzzle_image');
const outputFile = path.join(publicDir, 'existing_images.json');

try {
  const targetDir = path.join(publicDir, 'puzzle_image');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (fs.existsSync(imageDir)) {
    const files = fs.readdirSync(imageDir);
    const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));

    // Copy each png file to public/puzzle_image
    pngFiles.forEach(file => {
      const srcPath = path.join(imageDir, file);
      const destPath = path.join(targetDir, file);
      fs.copyFileSync(srcPath, destPath);
    });

    fs.writeFileSync(outputFile, JSON.stringify(pngFiles, null, 2));
    console.log(`[Manifest Generator] Copied and generated manifest with ${pngFiles.length} images.`);
  } else {
    fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
    console.log(`[Manifest Generator] puzzle_image directory not found.`);
  }
} catch (err) {
  console.error('[Manifest Generator] Error generating manifest:', err);
}

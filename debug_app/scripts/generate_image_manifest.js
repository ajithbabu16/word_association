import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');
const targetDir = path.join(publicDir, 'puzzle_image');
const debugAppImageDir = path.join(__dirname, '../puzzle_image');
const outputFile = path.join(publicDir, 'existing_images.json');

// Source candidates: Root workspace puzzle_image takes priority
const candidateSourceDirs = [
  path.join(__dirname, '../../puzzle_image'),
  path.join(__dirname, '../puzzle_image')
];

/**
 * Recursively flattens all files inside nested subdirectories up to rootDir
 * and cleans up __MACOSX and empty subdirectories.
 */
function flattenDirectory(rootDir) {
  if (!fs.existsSync(rootDir)) return;

  // 1. Remove __MACOSX junk
  const macosxDir = path.join(rootDir, '__MACOSX');
  if (fs.existsSync(macosxDir)) {
    try {
      fs.rmSync(macosxDir, { recursive: true, force: true });
      console.log(`[Flatten] Removed ${macosxDir}`);
    } catch (e) {
      console.warn(`[Flatten] Could not remove __MACOSX: ${e.message}`);
    }
  }

  // 2. Scan and flatten subdirectories
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDirPath = path.join(rootDir, entry.name);
      
      // Recursively flatten children first
      flattenDirectory(subDirPath);

      // Move all files in subDirPath up to rootDir
      const subFiles = fs.readdirSync(subDirPath);
      for (const file of subFiles) {
        const srcPath = path.join(subDirPath, file);
        const destPath = path.join(rootDir, file);
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { force: true });
        }
        fs.renameSync(srcPath, destPath);
      }

      // Remove the now-empty subfolder
      try {
        fs.rmdirSync(subDirPath);
        console.log(`[Flatten] Flattened and removed folder: ${entry.name}`);
      } catch (e) {
        console.warn(`[Flatten] Could not remove directory ${subDirPath}: ${e.message}`);
      }
    }
  }
}

try {
  // Ensure target output folder exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Locate and flatten primary source directory
  let primarySourceDir = null;
  for (const dir of candidateSourceDirs) {
    if (fs.existsSync(dir)) {
      primarySourceDir = dir;
      break;
    }
  }

  if (primarySourceDir) {
    console.log(`[Manifest Generator] Source directory: ${primarySourceDir}`);
    flattenDirectory(primarySourceDir);

    // Collect all PNG files in primary source directory
    const sourceFiles = fs.readdirSync(primarySourceDir);
    const pngFiles = sourceFiles.filter(f => f.toLowerCase().endsWith('.png'));

    // Copy to public/puzzle_image
    let copiedCount = 0;
    pngFiles.forEach(file => {
      const srcPath = path.join(primarySourceDir, file);
      const destPath = path.join(targetDir, file);

      let shouldCopy = true;
      if (fs.existsSync(destPath)) {
        const srcStat = fs.statSync(srcPath);
        const destStat = fs.statSync(destPath);
        if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) {
          shouldCopy = false;
        }
      }

      if (shouldCopy) {
        fs.copyFileSync(srcPath, destPath);
        copiedCount++;
      }
    });

    // Also keep debug_app/puzzle_image in sync if different from primary source
    if (path.resolve(primarySourceDir) !== path.resolve(debugAppImageDir)) {
      if (!fs.existsSync(debugAppImageDir)) {
        fs.mkdirSync(debugAppImageDir, { recursive: true });
      }
      pngFiles.forEach(file => {
        const srcPath = path.join(primarySourceDir, file);
        const destPath = path.join(debugAppImageDir, file);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      });
    }

    // Read all png files in public/puzzle_image and sort deterministically
    const targetPngFiles = fs.readdirSync(targetDir)
      .filter(f => f.toLowerCase().endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    fs.writeFileSync(outputFile, JSON.stringify(targetPngFiles, null, 2));
    console.log(`[Manifest Generator] Source has ${pngFiles.length} PNGs. Copied ${copiedCount} files to public/puzzle_image.`);
    console.log(`[Manifest Generator] Generated manifest with ${targetPngFiles.length} images at ${outputFile}.`);
  } else {
    const targetPngFiles = fs.existsSync(targetDir)
      ? fs.readdirSync(targetDir).filter(f => f.toLowerCase().endsWith('.png')).sort()
      : [];
    fs.writeFileSync(outputFile, JSON.stringify(targetPngFiles, null, 2));
    console.log(`[Manifest Generator] No source directory found. Preserved ${targetPngFiles.length} existing images.`);
  }
} catch (err) {
  console.error('[Manifest Generator] Error:', err);
}

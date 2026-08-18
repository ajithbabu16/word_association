import fs from 'fs';
import path from 'path';
import readline from 'readline';
import PDFDocument from 'pdfkit';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const __dirname = path.resolve();
const publicDir = path.join(__dirname, 'public');
const imagesDir = path.join(publicDir, 'puzzle_image');
const mainJsonPath = path.join(publicDir, 'main.json');

// Read all images into a map (lowercase name without extension -> full path)
const imagesMap = new Map<string, string>();
if (fs.existsSync(imagesDir)) {
  const files = fs.readdirSync(imagesDir);
  for (const file of files) {
    if (file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.jpg')) {
      const nameWithoutExt = path.parse(file).name.toLowerCase();
      imagesMap.set(nameWithoutExt, path.join(imagesDir, file));
    }
  }
}

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

async function run() {
  let fromLevelStr = process.argv[2];
  let toLevelStr = process.argv[3];

  if (!fromLevelStr || !toLevelStr) {
    fromLevelStr = await prompt('Enter from level: ');
    toLevelStr = await prompt('Enter to level: ');
  }
  
  rl.close();

  const fromLevel = parseInt(fromLevelStr, 10);
  const toLevel = parseInt(toLevelStr, 10);

  if (isNaN(fromLevel) || isNaN(toLevel)) {
    console.error('Invalid level range.');
    return;
  }

  if (!fs.existsSync(mainJsonPath)) {
    console.error('main.json not found in public folder.');
    return;
  }

  const mainData = JSON.parse(fs.readFileSync(mainJsonPath, 'utf8'));
  const levels = mainData.levels.filter((l: any) => l.levelNumber >= fromLevel && l.levelNumber <= toLevel);

  if (levels.length === 0) {
    console.log('No levels found in that range.');
    return;
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const outputFileName = `puzzle_levels_${fromLevel}_to_${toLevel}.pdf`;
  doc.pipe(fs.createWriteStream(outputFileName));

  // Register a default font or just use Helvetica
  doc.font('Helvetica');

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const totalCategories = level.groups ? level.groups.length : 0;
    
    if (i > 0) {
      doc.addPage();
    }

    doc.fontSize(16).fillColor('black').text(`Level ${level.levelNumber} - Total Categories: ${totalCategories}/${totalCategories}`, 50, 50);
    doc.moveDown(1);

    const pictureCategoryNames = (level.groups || [])
      .filter((g: any) => g.picture === true)
      .map((g: any) => (g.category || '').toUpperCase());

    let currentY = doc.y;

    // Draw Table Headers
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Category Title', 50, currentY);
    doc.text('Formation Words', 200, currentY);
    doc.text('Images', 350, currentY);
    currentY += 20;

    doc.moveTo(50, currentY).lineTo(550, currentY).lineWidth(1).stroke();
    currentY += 10;

    doc.font('Helvetica');

    let groupIndex = 0;
    for (const group of level.groups || []) {
      const catTitle = group.category || 'UNKNOWN';
      const words = group.words || [];
      const wordsStr = words.join(', ');
      // Check for images
      const imagesToDraw: {word: string, path: string | null}[] = [];
      
      if (group.picture === true) {
        const titleKey = catTitle.toLowerCase();
        if (imagesMap.has(titleKey)) {
          imagesToDraw.push({ word: catTitle, path: imagesMap.get(titleKey)! });
        } else {
          imagesToDraw.push({ word: catTitle, path: null });
        }
      }

      for (const word of words) {
        const isEligibleImage = pictureCategoryNames.includes(word.toUpperCase());
        if (isEligibleImage) {
          const wordKey = word.toLowerCase();
          if (!imagesToDraw.some(img => img.word.toLowerCase() === wordKey)) {
            if (imagesMap.has(wordKey)) {
              imagesToDraw.push({ word, path: imagesMap.get(wordKey)! });
            } else {
              imagesToDraw.push({ word, path: null });
            }
          }
        }
      }

      // Set font size before measuring to get accurate heights
      doc.fontSize(10).font('Helvetica');

      // Calculate row height
      const textHeightTitle = doc.heightOfString(catTitle, { width: 140 });
      const textHeightWords = doc.heightOfString(wordsStr, { width: 140 });
      const cardW = 60;
      const cardH = 70;
      const spacingX = 10;
      const spacingY = 15;
      
      let imagesHeight = 0;
      if (imagesToDraw.length > 0) {
        const imgsPerRow = Math.floor(200 / (cardW + spacingX)); 
        const numRows = Math.ceil(imagesToDraw.length / imgsPerRow);
        imagesHeight = numRows * (cardH + spacingY); 
      }
      
      const rowHeight = Math.max(textHeightTitle, textHeightWords, imagesHeight) + 15;

      // Check page break
      if (currentY + rowHeight > 800) {
        doc.addPage();
        currentY = 50;
        
        doc.fontSize(12).font('Helvetica-Bold');
        doc.fillColor('black').text('Category Title', 50, currentY);
        doc.text('Formation Words', 200, currentY);
        doc.text('Images', 350, currentY);
        currentY += 20;
        doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
        currentY += 10;
        doc.font('Helvetica');
      }

      // Draw Row Content
      doc.fontSize(10).fillColor('black');
      doc.text(catTitle, 50, currentY, { width: 140 });
      doc.text(wordsStr, 200, currentY, { width: 140 });

      // Draw Images as Cards
      if (imagesToDraw.length > 0) {
        let imgX = 350;
        let imgY = currentY;
        const CATEGORY_COLORS = ['#64D1E5', '#F799A2', '#FDA874', '#E29FD6', '#FAC84D', '#7EDE58'];
        const catColor = CATEGORY_COLORS[groupIndex % CATEGORY_COLORS.length];

        for (const imgObj of imagesToDraw) {
          if (imgX + cardW > 550) {
            imgX = 350;
            imgY += cardH + spacingY;
          }
          
          // Draw outer colored border
          doc.roundedRect(imgX, imgY, cardW, cardH, 6).fill(catColor);
          
          // Draw inner dark background
          doc.roundedRect(imgX + 3, imgY + 3, cardW - 6, cardH - 6, 4).fill('#1f2937');
          
          if (imgObj.path) {
            const iconSize = 34;
            const iconX = imgX + (cardW - iconSize) / 2;
            const iconY = imgY + 8;
            doc.image(imgObj.path, iconX, iconY, { width: iconSize, height: iconSize });
          } else {
            // Draw missing image box
            const iconSize = 34;
            const iconX = imgX + (cardW - iconSize) / 2;
            const iconY = imgY + 8;
            doc.rect(iconX, iconY, iconSize, iconSize).lineWidth(1).strokeColor('red').stroke();
            doc.fontSize(6).fillColor('red').text('MISSING\nIMAGE', iconX, iconY + (iconSize / 2) - 5, { width: iconSize, align: 'center' });
          }
          
          // Draw text label at bottom
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff').text(imgObj.word.toUpperCase(), imgX + 3, imgY + cardH - 16, { width: cardW - 6, align: 'center' });
          
          // Reset font/color
          doc.font('Helvetica').fillColor('black');
          
          imgX += cardW + spacingX;
        }
      }

      currentY += rowHeight;
      doc.moveTo(50, currentY - 5).lineTo(550, currentY - 5).lineWidth(0.5).strokeColor('#cccccc').stroke();
      doc.strokeColor('black'); // reset stroke color
      
      groupIndex++;
    }
  }

  doc.end();
  console.log(`Successfully generated ${outputFileName}`);
}

run().catch(err => {
  console.error('Error generating PDF:', err);
});

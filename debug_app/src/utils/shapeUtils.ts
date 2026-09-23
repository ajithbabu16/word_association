export interface CutPieceResult {
  id: string;
  name: string;
  blob: Blob;
  canvas: HTMLCanvasElement;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalX: number;
  originalY: number;
  originalWidth: number;
  originalHeight: number;
  shapeType: string;
  textureUuid?: string;
  spriteFrameUuid?: string;
}

/**
 * Detects the bounding box of non-transparent pixel content in a canvas.
 * Ignores outer empty transparent background pixels so cuts happen ONLY on the real image subject.
 */
export function getAlphaContentBounds(canvas: HTMLCanvasElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
  if (!ctx) return { x: 0, y: 0, width: canvas.width, height: canvas.height };

  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 5) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Crops transparent outer bounds from a canvas to leave a tight-fitting non-transparent canvas.
 */
export function cropAlphaBounds(canvas: HTMLCanvasElement): {
  croppedCanvas: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
} {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
  if (!ctx) return { croppedCanvas: canvas, offsetX: 0, offsetY: 0, width: canvas.width, height: canvas.height };

  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 5) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    // Completely empty canvas
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 1;
    emptyCanvas.height = 1;
    return { croppedCanvas: emptyCanvas, offsetX: 0, offsetY: 0, width: 1, height: 1 };
  }

  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;
  const croppedCtx = croppedCanvas.getContext('2d');

  if (croppedCtx) {
    croppedCtx.drawImage(canvas, minX, minY, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
  }

  return {
    croppedCanvas,
    offsetX: minX,
    offsetY: minY,
    width: croppedWidth,
    height: croppedHeight,
  };
}

/**
 * Cut an image/canvas into an N x M grid of tiles (strictly on actual image bounds).
 */
export async function createGridCutPieces(
  sourceCanvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  baseName: string = 'hp'
): Promise<CutPieceResult[]> {
  const results: CutPieceResult[] = [];
  const bounds = getAlphaContentBounds(sourceCanvas);
  const tileWidth = Math.floor(bounds.width / cols);
  const tileHeight = Math.floor(bounds.height / rows);
  let pieceCount = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = tileWidth;
      tileCanvas.height = tileHeight;
      const ctx = tileCanvas.getContext('2d');
      if (!ctx) continue;

      const srcX = bounds.x + c * tileWidth;
      const srcY = bounds.y + r * tileHeight;

      ctx.drawImage(sourceCanvas, srcX, srcY, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);

      const trimmed = cropAlphaBounds(tileCanvas);
      if (trimmed.width <= 1 || trimmed.height <= 1) continue; // Skip empty background pieces!

      const pieceName = `${baseName}_${pieceCount}`;
      pieceCount++;

      const blob = await new Promise<Blob>((resolve) =>
        trimmed.croppedCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
      );
      const dataUrl = trimmed.croppedCanvas.toDataURL('image/png');

      results.push({
        id: `${pieceName}_${r}_${c}`,
        name: pieceName,
        blob,
        canvas: trimmed.croppedCanvas,
        dataUrl,
        x: srcX + trimmed.offsetX,
        y: srcY + trimmed.offsetY,
        width: trimmed.width,
        height: trimmed.height,
        originalX: srcX,
        originalY: srcY,
        originalWidth: tileWidth,
        originalHeight: tileHeight,
        shapeType: 'grid_tile',
      });
    }
  }

  return results;
}

/**
 * Mask canvas into a Geometric shape (Circle, Polygon, Hexagon, RoundedRect) on actual image content.
 */
export async function createGeometricCutPiece(
  sourceCanvas: HTMLCanvasElement,
  shape: 'circle' | 'hexagon' | 'triangle' | 'octagon' | 'rounded_rect',
  baseName: string = 'hp'
): Promise<CutPieceResult> {
  const bounds = getAlphaContentBounds(sourceCanvas);
  const width = bounds.width;
  const height = bounds.height;

  const maskedCanvas = document.createElement('canvas');
  maskedCanvas.width = width;
  maskedCanvas.height = height;
  const ctx = maskedCanvas.getContext('2d');

  if (ctx) {
    ctx.beginPath();

    if (shape === 'circle') {
      const radiusX = width / 2;
      const radiusY = height / 2;
      ctx.ellipse(width / 2, height / 2, radiusX, radiusY, 0, 0, 2 * Math.PI);
    } else if (shape === 'rounded_rect') {
      const radius = Math.min(width, height) * 0.15;
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(0, 0, width, height, radius);
      } else {
        ctx.rect(0, 0, width, height);
      }
    } else {
      const sides = shape === 'triangle' ? 3 : shape === 'hexagon' ? 6 : 8;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2;

      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    ctx.clip();
    ctx.drawImage(sourceCanvas, bounds.x, bounds.y, width, height, 0, 0, width, height);
  }

  const trimmed = cropAlphaBounds(maskedCanvas);
  const blob = await new Promise<Blob>((resolve) =>
    trimmed.croppedCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
  );
  const dataUrl = trimmed.croppedCanvas.toDataURL('image/png');

  const pieceName = `${baseName}_1`;

  return {
    id: `${pieceName}_${shape}`,
    name: pieceName,
    blob,
    canvas: trimmed.croppedCanvas,
    dataUrl,
    x: bounds.x + trimmed.offsetX,
    y: bounds.y + trimmed.offsetY,
    width: trimmed.width,
    height: trimmed.height,
    originalX: bounds.x,
    originalY: bounds.y,
    originalWidth: width,
    originalHeight: height,
    shapeType: shape,
  };
}

/**
 * Cuts canvas into interlocking Jigsaw Puzzle pieces (strictly on actual image bounds).
 */
export async function createJigsawCutPieces(
  sourceCanvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  baseName: string = 'hp'
): Promise<CutPieceResult[]> {
  const results: CutPieceResult[] = [];
  const bounds = getAlphaContentBounds(sourceCanvas);
  const W = bounds.width;
  const H = bounds.height;
  const tileW = W / cols;
  const tileH = H / rows;
  let pieceCount = 1;

  // Generate tab directions (-1 = inward socket, +1 = outward tab, 0 = border)
  const horizontalTabs: number[][] = [];
  const verticalTabs: number[][] = [];

  for (let r = 0; r <= rows; r++) {
    horizontalTabs[r] = [];
    for (let c = 0; c < cols; c++) {
      horizontalTabs[r][c] = r === 0 || r === rows ? 0 : Math.random() > 0.5 ? 1 : -1;
    }
  }

  for (let r = 0; r < rows; r++) {
    verticalTabs[r] = [];
    for (let c = 0; c <= cols; c++) {
      verticalTabs[r][c] = c === 0 || c === cols ? 0 : Math.random() > 0.5 ? 1 : -1;
    }
  }

  const tabSizeW = tileW * 0.2;
  const tabSizeH = tileH * 0.2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pieceCanvas = document.createElement('canvas');
      const marginW = tabSizeW * 1.5;
      const marginH = tabSizeH * 1.5;
      pieceCanvas.width = tileW + marginW * 2;
      pieceCanvas.height = tileH + marginH * 2;

      const ctx = pieceCanvas.getContext('2d');
      if (!ctx) continue;

      const topTab = horizontalTabs[r][c];
      const bottomTab = horizontalTabs[r + 1][c];
      const leftTab = verticalTabs[r][c];
      const rightTab = verticalTabs[r][c + 1];

      const x0 = marginW;
      const y0 = marginH;
      const x1 = marginW + tileW;
      const y1 = marginH + tileH;

      ctx.beginPath();
      ctx.moveTo(x0, y0);

      // Top Edge
      if (topTab !== 0) {
        const midX = (x0 + x1) / 2;
        ctx.lineTo(midX - tabSizeW, y0);
        ctx.bezierCurveTo(
          midX - tabSizeW,
          y0 - topTab * tabSizeH,
          midX + tabSizeW,
          y0 - topTab * tabSizeH,
          midX + tabSizeW,
          y0
        );
      }
      ctx.lineTo(x1, y0);

      // Right Edge
      if (rightTab !== 0) {
        const midY = (y0 + y1) / 2;
        ctx.lineTo(x1, midY - tabSizeH);
        ctx.bezierCurveTo(
          x1 + rightTab * tabSizeW,
          midY - tabSizeH,
          x1 + rightTab * tabSizeW,
          midY + tabSizeH,
          x1,
          midY + tabSizeH
        );
      }
      ctx.lineTo(x1, y1);

      // Bottom Edge
      if (bottomTab !== 0) {
        const midX = (x0 + x1) / 2;
        ctx.lineTo(midX + tabSizeW, y1);
        ctx.bezierCurveTo(
          midX + tabSizeW,
          y1 + bottomTab * tabSizeH,
          midX - tabSizeW,
          y1 + bottomTab * tabSizeH,
          midX - tabSizeW,
          y1
        );
      }
      ctx.lineTo(x0, y1);

      // Left Edge
      if (leftTab !== 0) {
        const midY = (y0 + y1) / 2;
        ctx.lineTo(x0, midY + tabSizeH);
        ctx.bezierCurveTo(
          x0 - leftTab * tabSizeW,
          midY + tabSizeH,
          x0 - leftTab * tabSizeW,
          midY - tabSizeH,
          x0,
          midY - tabSizeH
        );
      }
      ctx.lineTo(x0, y0);
      ctx.closePath();

      ctx.clip();

      const drawSrcX = bounds.x + c * tileW - marginW;
      const drawSrcY = bounds.y + r * tileH - marginH;
      ctx.drawImage(sourceCanvas, drawSrcX, drawSrcY, pieceCanvas.width, pieceCanvas.height, 0, 0, pieceCanvas.width, pieceCanvas.height);

      const trimmed = cropAlphaBounds(pieceCanvas);
      if (trimmed.width <= 1 || trimmed.height <= 1) continue; // Skip empty background pieces!

      const pieceName = `${baseName}_${pieceCount}`;
      pieceCount++;

      const blob = await new Promise<Blob>((resolve) =>
        trimmed.croppedCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
      );
      const dataUrl = trimmed.croppedCanvas.toDataURL('image/png');

      const absoluteX = bounds.x + c * tileW - marginW + trimmed.offsetX;
      const absoluteY = bounds.y + r * tileH - marginH + trimmed.offsetY;

      results.push({
        id: `${pieceName}_${r}_${c}`,
        name: pieceName,
        blob,
        canvas: trimmed.croppedCanvas,
        dataUrl,
        x: absoluteX,
        y: absoluteY,
        width: trimmed.width,
        height: trimmed.height,
        originalX: bounds.x + c * tileW,
        originalY: bounds.y + r * tileH,
        originalWidth: tileW,
        originalHeight: tileH,
        shapeType: 'jigsaw_piece',
      });
    }
  }

  return results;
}

/**
 * Cuts canvas into Triangle shape pieces (strictly on actual image bounds).
 */
export async function createTriangleCutPieces(
  sourceCanvas: HTMLCanvasElement,
  cols: number,
  rows: number,
  triangleSplitMode: 'diagonal_2' | 'quad_4' = 'diagonal_2',
  baseName: string = 'hp'
): Promise<CutPieceResult[]> {
  const results: CutPieceResult[] = [];
  const bounds = getAlphaContentBounds(sourceCanvas);
  const W = bounds.width;
  const H = bounds.height;
  const tileW = W / cols;
  const tileH = H / rows;
  let pieceCount = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const srcX = bounds.x + c * tileW;
      const srcY = bounds.y + r * tileH;

      if (triangleSplitMode === 'diagonal_2') {
        // Triangle 1: Top-Left (0,0 -> tileW,0 -> 0,tileH)
        const t1Canvas = document.createElement('canvas');
        t1Canvas.width = tileW;
        t1Canvas.height = tileH;
        const ctx1 = t1Canvas.getContext('2d');
        if (ctx1) {
          ctx1.beginPath();
          ctx1.moveTo(0, 0);
          ctx1.lineTo(tileW, 0);
          ctx1.lineTo(0, tileH);
          ctx1.closePath();
          ctx1.clip();
          ctx1.drawImage(sourceCanvas, srcX, srcY, tileW, tileH, 0, 0, tileW, tileH);

          const trimmed1 = cropAlphaBounds(t1Canvas);
          if (trimmed1.width > 1 && trimmed1.height > 1) {
            const name1 = `${baseName}_${pieceCount}`;
            pieceCount++;
            const blob1 = await new Promise<Blob>((res) =>
              trimmed1.croppedCanvas.toBlob((b) => res(b || new Blob()), 'image/png')
            );
            results.push({
              id: `${name1}_${r}_${c}_1`,
              name: name1,
              blob: blob1,
              canvas: trimmed1.croppedCanvas,
              dataUrl: trimmed1.croppedCanvas.toDataURL('image/png'),
              x: srcX + trimmed1.offsetX,
              y: srcY + trimmed1.offsetY,
              width: trimmed1.width,
              height: trimmed1.height,
              originalX: srcX,
              originalY: srcY,
              originalWidth: tileW,
              originalHeight: tileH,
              shapeType: 'triangle',
            });
          }
        }

        // Triangle 2: Bottom-Right (tileW,0 -> tileW,tileH -> 0,tileH)
        const t2Canvas = document.createElement('canvas');
        t2Canvas.width = tileW;
        t2Canvas.height = tileH;
        const ctx2 = t2Canvas.getContext('2d');
        if (ctx2) {
          ctx2.beginPath();
          ctx2.moveTo(tileW, 0);
          ctx2.lineTo(tileW, tileH);
          ctx2.lineTo(0, tileH);
          ctx2.closePath();
          ctx2.clip();
          ctx2.drawImage(sourceCanvas, srcX, srcY, tileW, tileH, 0, 0, tileW, tileH);

          const trimmed2 = cropAlphaBounds(t2Canvas);
          if (trimmed2.width > 1 && trimmed2.height > 1) {
            const name2 = `${baseName}_${pieceCount}`;
            pieceCount++;
            const blob2 = await new Promise<Blob>((res) =>
              trimmed2.croppedCanvas.toBlob((b) => res(b || new Blob()), 'image/png')
            );
            results.push({
              id: `${name2}_${r}_${c}_2`,
              name: name2,
              blob: blob2,
              canvas: trimmed2.croppedCanvas,
              dataUrl: trimmed2.croppedCanvas.toDataURL('image/png'),
              x: srcX + trimmed2.offsetX,
              y: srcY + trimmed2.offsetY,
              width: trimmed2.width,
              height: trimmed2.height,
              originalX: srcX,
              originalY: srcY,
              originalWidth: tileW,
              originalHeight: tileH,
              shapeType: 'triangle',
            });
          }
        }
      } else {
        // quad_4: 4 triangles
        const midX = tileW / 2;
        const midY = tileH / 2;
        const triConfigs = [
          { pts: [[0, 0], [tileW, 0], [midX, midY]] },
          { pts: [[tileW, 0], [tileW, tileH], [midX, midY]] },
          { pts: [[tileW, tileH], [0, tileH], [midX, midY]] },
          { pts: [[0, tileH], [0, 0], [midX, midY]] },
        ];

        for (let i = 0; i < triConfigs.length; i++) {
          const cfg = triConfigs[i];
          const tCanvas = document.createElement('canvas');
          tCanvas.width = tileW;
          tCanvas.height = tileH;
          const ctx = tCanvas.getContext('2d');
          if (ctx) {
            ctx.beginPath();
            ctx.moveTo(cfg.pts[0][0], cfg.pts[0][1]);
            ctx.lineTo(cfg.pts[1][0], cfg.pts[1][1]);
            ctx.lineTo(cfg.pts[2][0], cfg.pts[2][1]);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(sourceCanvas, srcX, srcY, tileW, tileH, 0, 0, tileW, tileH);

            const trimmed = cropAlphaBounds(tCanvas);
            if (trimmed.width > 1 && trimmed.height > 1) {
              const name = `${baseName}_${pieceCount}`;
              pieceCount++;
              const blob = await new Promise<Blob>((res) =>
                trimmed.croppedCanvas.toBlob((b) => res(b || new Blob()), 'image/png')
              );
              results.push({
                id: `${name}_${r}_${c}_${i}`,
                name,
                blob,
                canvas: trimmed.croppedCanvas,
                dataUrl: trimmed.croppedCanvas.toDataURL('image/png'),
                x: srcX + trimmed.offsetX,
                y: srcY + trimmed.offsetY,
                width: trimmed.width,
                height: trimmed.height,
                originalX: srcX,
                originalY: srcY,
                originalWidth: tileW,
                originalHeight: tileH,
                shapeType: 'triangle',
              });
            }
          }
        }
      }
    }
  }

  return results;
}

export interface LowPolyMesh {
  vertices: { x: number; y: number }[];
  triangles: [number, number, number][];
}

/**
 * Detects the actual polygon corner vertices of low-poly artwork using Harris corner detection.
 * This finds the exact points where colored facets meet — producing cuts that follow the artwork's triangles.
 */
export function detectImageLowPolyVertices(
  sourceCanvas: HTMLCanvasElement,
  targetPointCount: number = 80
): { x: number; y: number }[] {
  const bounds = getAlphaContentBounds(sourceCanvas);
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true }) || sourceCanvas.getContext('2d');
  if (!ctx) return [];

  const { width, height } = sourceCanvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const clamped = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(x)));
  const getAlpha = (x: number, y: number) => data[(clamped(y, 0, height - 1) * width + clamped(x, 0, width - 1)) * 4 + 3];

  // --- STEP 1: Compute per-pixel luminance for gradient ---
  const lum = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 10) {
        lum[y * width + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
    }
  }

  const L = (x: number, y: number) => lum[clamped(y, 0, height - 1) * width + clamped(x, 0, width - 1)];

  // --- STEP 2: Compute Sobel gradients Ix, Iy ---
  const Ix = new Float32Array(width * height);
  const Iy = new Float32Array(width * height);

  for (let y = bounds.y + 1; y < bounds.y + bounds.height - 1; y++) {
    for (let x = bounds.x + 1; x < bounds.x + bounds.width - 1; x++) {
      if (getAlpha(x, y) <= 10) continue;
      // Sobel 3×3
      Ix[y * width + x] =
        (-L(x - 1, y - 1) + L(x + 1, y - 1)) +
        (-2 * L(x - 1, y)   + 2 * L(x + 1, y)) +
        (-L(x - 1, y + 1) + L(x + 1, y + 1));
      Iy[y * width + x] =
        (-L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1)) +
        ( L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1));
    }
  }

  // --- STEP 3: Harris Corner Response with 5×5 window ---
  const k = 0.04;
  const cornerScore = new Float32Array(width * height);
  const winR = 3;

  for (let y = bounds.y + winR; y < bounds.y + bounds.height - winR; y++) {
    for (let x = bounds.x + winR; x < bounds.x + bounds.width - winR; x++) {
      if (getAlpha(x, y) <= 10) continue;
      let Ixx = 0, Iyy = 0, Ixy = 0;
      for (let wy = -winR; wy <= winR; wy++) {
        for (let wx = -winR; wx <= winR; wx++) {
          const ix = Ix[(y + wy) * width + (x + wx)];
          const iy = Iy[(y + wy) * width + (x + wx)];
          Ixx += ix * ix;
          Iyy += iy * iy;
          Ixy += ix * iy;
        }
      }
      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;
      cornerScore[y * width + x] = det - k * trace * trace;
    }
  }

  // --- STEP 4: Non-maximum suppression & collect candidates ---
  const nmsRadius = 4;
  const candidates: { x: number; y: number; score: number }[] = [];

  for (let y = bounds.y + nmsRadius; y < bounds.y + bounds.height - nmsRadius; y++) {
    for (let x = bounds.x + nmsRadius; x < bounds.x + bounds.width - nmsRadius; x++) {
      const score = cornerScore[y * width + x];
      if (score <= 0) continue;
      // Local maximum in nmsRadius neighbourhood
      let isMax = true;
      for (let ny = -nmsRadius; ny <= nmsRadius && isMax; ny++) {
        for (let nx = -nmsRadius; nx <= nmsRadius && isMax; nx++) {
          if (ny === 0 && nx === 0) continue;
          if (cornerScore[(y + ny) * width + (x + nx)] >= score) isMax = false;
        }
      }
      if (isMax) candidates.push({ x, y, score });
    }
  }

  // Sort by corner strength descending — strongest = actual polygon corners
  candidates.sort((a, b) => b.score - a.score);

  // --- STEP 5: Spatial grid suppression to spread vertices evenly ---
  const targetCount = Math.min(300, Math.max(40, targetPointCount));
  // Min spacing adapts: more points → smaller spacing (catches fine wing triangles)
  const minSpacing = Math.max(
    10,
    Math.floor(Math.sqrt((bounds.width * bounds.height) / targetCount) * 0.5)
  );

  const gridCell = minSpacing;
  const gridW = Math.ceil(width / gridCell) + 2;
  const gridH = Math.ceil(height / gridCell) + 2;
  const grid = new Uint8Array(gridW * gridH);
  const selected: { x: number; y: number }[] = [];

  const tryAdd = (x: number, y: number): boolean => {
    if (selected.length >= targetCount) return false;
    const gx = Math.floor(x / gridCell);
    const gy = Math.floor(y / gridCell);
    if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = gx + dx; const cy = gy + dy;
        if (cx >= 0 && cx < gridW && cy >= 0 && cy < gridH && grid[cy * gridW + cx]) return false;
      }
    }
    selected.push({ x, y });
    grid[gy * gridW + gx] = 1;
    return true;
  };

  // Add all Harris corners in score order (these ARE the actual artwork polygon vertices)
  for (const c of candidates) {
    tryAdd(c.x, c.y);
  }

  // --- STEP 6: Guarantee silhouette boundary & limb-tip coverage ---
  // Column extrema (leg tips, antenna tips)
  const colStep = Math.max(2, Math.floor(minSpacing / 2));
  for (let x = bounds.x; x < bounds.x + bounds.width; x += colStep) {
    // Bottom tip
    for (let y = bounds.y + bounds.height - 1; y >= bounds.y; y--) {
      if (getAlpha(x, y) > 10) { tryAdd(x, y); break; }
    }
    // Top tip
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      if (getAlpha(x, y) > 10) { tryAdd(x, y); break; }
    }
  }

  // Silhouette boundary contour
  const bStep = Math.max(minSpacing, 12);
  for (let y = bounds.y; y < bounds.y + bounds.height; y += bStep) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += bStep) {
      if (getAlpha(x, y) > 10) {
        const isBoundary =
          getAlpha(x - 2, y) <= 10 || getAlpha(x + 2, y) <= 10 ||
          getAlpha(x, y - 2) <= 10 || getAlpha(x, y + 2) <= 10;
        if (isBoundary) tryAdd(x, y);
      }
    }
  }

  return selected;
}


/**
 * Filters out pure background triangles while keeping 100% of subject triangles.
 * Uses dense interior point sampling: DISCARD only if the centroid AND majority of
 * interior samples are on transparent/background pixels.
 */
export function filterSubjectTriangles(
  sourceCanvas: HTMLCanvasElement,
  vertices: { x: number; y: number }[],
  triangles: [number, number, number][]
): [number, number, number][] {
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true }) || sourceCanvas.getContext('2d');
  if (!ctx) return triangles;

  const { width, height } = sourceCanvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const getAlpha = (x: number, y: number): number => {
    const px = Math.min(width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(height - 1, Math.max(0, Math.round(y)));
    return data[(py * width + px) * 4 + 3];
  };

  const validTriangles: [number, number, number][] = [];

  for (const tri of triangles) {
    const p1 = vertices[tri[0]];
    const p2 = vertices[tri[1]];
    const p3 = vertices[tri[2]];
    if (!p1 || !p2 || !p3) continue;

    const cx = (p1.x + p2.x + p3.x) / 3;
    const cy = (p1.y + p2.y + p3.y) / 3;

    // Sample centroid + 12 dense interior points via barycentric coords
    let subjectHits = 0;
    const baryCoords = [
      [1/3, 1/3, 1/3],
      [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6],
      [0.5, 0.5, 0.0], [0.5, 0.0, 0.5], [0.0, 0.5, 0.5],
      [0.7, 0.15, 0.15], [0.15, 0.7, 0.15], [0.15, 0.15, 0.7],
      [0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.1, 0.1, 0.8],
    ];
    const totalSamples = baryCoords.length;
    for (const [u, v, w] of baryCoords) {
      const sx = u * p1.x + v * p2.x + w * p3.x;
      const sy = u * p1.y + v * p2.y + w * p3.y;
      if (getAlpha(sx, sy) > 10) subjectHits++;
    }

    // Discard if less than 45% of interior samples are on the subject
    if (subjectHits / totalSamples < 0.45) continue;

    // Also discard if centroid is in transparent background AND fewer than 3 hits
    if (subjectHits < 3 && getAlpha(cx, cy) <= 10) continue;

    validTriangles.push(tri);
  }

  return validTriangles;
}

/**
 * Automated full pixel coverage pass: Ensures every subject pixel (e.g., lower leg tips) is covered by at least one triangle.
 */
export function ensureFullSubjectCoverage(
  sourceCanvas: HTMLCanvasElement,
  vertices: { x: number; y: number }[],
  triangles: [number, number, number][]
): { vertices: { x: number; y: number }[]; triangles: [number, number, number][] } {
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { vertices, triangles };

  const { width, height } = sourceCanvas;
  const srcData = ctx.getImageData(0, 0, width, height).data;

  const getAlpha = (x: number, y: number): number => {
    const px = Math.min(width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(height - 1, Math.max(0, Math.round(y)));
    return srcData[(py * width + px) * 4 + 3];
  };

  const isEdgeSolid = (pA: { x: number; y: number }, pB: { x: number; y: number }): boolean => {
    let transparentCount = 0;
    const samples = 7;
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const sx = pA.x + t * (pB.x - pA.x);
      const sy = pA.y + t * (pB.y - pA.y);
      if (getAlpha(sx, sy) <= 10) transparentCount++;
    }
    return transparentCount <= 1;
  };

  // Rasterize current triangles to test coverage
  const covCanvas = document.createElement('canvas');
  covCanvas.width = width;
  covCanvas.height = height;
  const covCtx = covCanvas.getContext('2d', { willReadFrequently: true });
  if (!covCtx) return { vertices, triangles };

  covCtx.fillStyle = '#ffffff';
  for (const tri of triangles) {
    const p1 = vertices[tri[0]];
    const p2 = vertices[tri[1]];
    const p3 = vertices[tri[2]];
    if (!p1 || !p2 || !p3) continue;

    covCtx.beginPath();
    covCtx.moveTo(p1.x, p1.y);
    covCtx.lineTo(p2.x, p2.y);
    covCtx.lineTo(p3.x, p3.y);
    covCtx.closePath();
    covCtx.fill();
  }

  const covData = covCtx.getImageData(0, 0, width, height).data;

  const uncovered: { x: number; y: number }[] = [];
  const scanStep = 4;
  for (let y = 0; y < height; y += scanStep) {
    for (let x = 0; x < width; x += scanStep) {
      const idx = (y * width + x) * 4;
      if (srcData[idx + 3] > 10 && covData[idx] === 0) {
        uncovered.push({ x, y });
      }
    }
  }

  if (uncovered.length === 0) {
    return { vertices, triangles };
  }

  const extraVertices = [...vertices];
  const updatedTriangles = [...triangles];

  const binSize = 16;
  const binMap = new Map<string, { maxY: number; sumX: number; count: number }>();

  for (const p of uncovered) {
    const bx = Math.floor(p.x / binSize);
    const by = Math.floor(p.y / binSize);
    const key = `${bx},${by}`;
    let bin = binMap.get(key);
    if (!bin) {
      bin = { maxY: p.y, sumX: 0, count: 0 };
      binMap.set(key, bin);
    }
    bin.sumX += p.x;
    bin.count++;
    if (p.y > bin.maxY) bin.maxY = p.y;
  }

  binMap.forEach((bin) => {
    const targetX = Math.round(bin.sumX / bin.count);
    const targetY = bin.maxY;

    // Only add vertex if it is on subject pixels
    if (getAlpha(targetX, targetY) <= 10) return;

    let isDuplicate = false;
    for (const v of extraVertices) {
      const dx = v.x - targetX;
      const dy = v.y - targetY;
      if (dx * dx + dy * dy < 36) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      const newIdx = extraVertices.length;
      const newPt = { x: targetX, y: targetY };

      // Connect to 2 nearest existing vertices ONLY if edges are solid (no air gap crossing!)
      const candidates = extraVertices
        .map((v, i) => ({ i, v, distSq: (v.x - targetX) ** 2 + (v.y - targetY) ** 2 }))
        .filter((item) => item.i !== newIdx && isEdgeSolid(newPt, item.v))
        .sort((a, b) => a.distSq - b.distSq);

      if (candidates.length >= 2) {
        extraVertices.push(newPt);
        updatedTriangles.push([candidates[0].i, candidates[1].i, newIdx]);
      }
    }
  });

  return { vertices: extraVertices, triangles: updatedTriangles };
}

/**
 * Fast 2D Bowyer-Watson Delaunay Triangulation.
 */
export function delaunayTriangulate(
  points: { x: number; y: number }[],
  width: number,
  height: number
): [number, number, number][] {
  if (points.length < 3) return [];

  // Define super-triangle enclosing all points
  const margin = Math.max(width, height) * 10;
  const pSuper0 = { x: width / 2, y: -margin };
  const pSuper1 = { x: -margin, y: height * 2 + margin };
  const pSuper2 = { x: width * 2 + margin, y: height * 2 + margin };

  const allPoints = [...points, pSuper0, pSuper1, pSuper2];
  const superIndices = [points.length, points.length + 1, points.length + 2];

  let triangles: [number, number, number][] = [[superIndices[0], superIndices[1], superIndices[2]]];

  // Helper to check if point (px, py) is inside circumcircle of triangle (a, b, c)
  function inCircumcircle(px: number, py: number, aIdx: number, bIdx: number, cIdx: number): boolean {
    const A = allPoints[aIdx];
    const B = allPoints[bIdx];
    const C = allPoints[cIdx];

    const ax = A.x - px;
    const ay = A.y - py;
    const bx = B.x - px;
    const by = B.y - py;
    const cx = C.x - px;
    const cy = C.y - py;

    const det = (ax * ax + ay * ay) * (bx * cy - cx * by) -
                (bx * bx + by * by) * (ax * cy - cx * ay) +
                (cx * cx + cy * cy) * (ax * by - bx * ay);

    const cross = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    return cross > 0 ? det > 0 : det < 0;
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const badTriangles: [number, number, number][] = [];

    for (const tri of triangles) {
      if (inCircumcircle(p.x, p.y, tri[0], tri[1], tri[2])) {
        badTriangles.push(tri);
      }
    }

    // Find boundary edges of bad triangles
    const polygonEdges: [number, number][] = [];
    for (const tri of badTriangles) {
      const edges: [number, number][] = [
        [tri[0], tri[1]],
        [tri[1], tri[2]],
        [tri[2], tri[0]],
      ];

      for (const edge of edges) {
        let isShared = false;
        for (const other of badTriangles) {
          if (other === tri) continue;
          if (
            (other.includes(edge[0]) && other.includes(edge[1]))
          ) {
            isShared = true;
            break;
          }
        }
        if (!isShared) {
          polygonEdges.push(edge);
        }
      }
    }

    // Remove bad triangles
    triangles = triangles.filter((t) => !badTriangles.includes(t));

    // Create new triangles from polygon edges to point i
    for (const edge of polygonEdges) {
      triangles.push([edge[0], edge[1], i]);
    }
  }

  // Filter out triangles connected to super-triangle vertices
  const result: [number, number, number][] = [];
  for (const tri of triangles) {
    if (
      !superIndices.includes(tri[0]) &&
      !superIndices.includes(tri[1]) &&
      !superIndices.includes(tri[2])
    ) {
      result.push(tri);
    }
  }

  return result;
}

/**
 * Cuts canvas into Image-Adaptive Low-Poly Triangle pieces matching image artwork (Fast Parallel Batching).
 */
export async function createImageLowPolyCutPieces(
  sourceCanvas: HTMLCanvasElement,
  vertices: { x: number; y: number }[],
  triangles: [number, number, number][],
  baseName: string = 'hp'
): Promise<CutPieceResult[]> {
  const finalVertices = vertices;
  const finalTriangles = triangles;

  const pad = 3;
  // Expand each triangle vertex outward from centroid by this many pixels
  // This fills the 1-2px seam gap between adjacent triangle pieces
  const EXPAND_PX = 1.5;

  // Process all triangle pieces in parallel for fast execution
  const piecePromises = finalTriangles.map(async ([i1, i2, i3], i) => {
    const p1 = finalVertices[i1];
    const p2 = finalVertices[i2];
    const p3 = finalVertices[i3];
    if (!p1 || !p2 || !p3) return null;

    // Compute centroid and expand each vertex outward to eliminate seam gaps
    const cx = (p1.x + p2.x + p3.x) / 3;
    const cy = (p1.y + p2.y + p3.y) / 3;
    const expand = (p: { x: number; y: number }) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: p.x + (dx / d) * EXPAND_PX, y: p.y + (dy / d) * EXPAND_PX };
    };
    const ep1 = expand(p1);
    const ep2 = expand(p2);
    const ep3 = expand(p3);

    const minX = Math.max(0, Math.floor(Math.min(ep1.x, ep2.x, ep3.x)) - pad);
    const minY = Math.max(0, Math.floor(Math.min(ep1.y, ep2.y, ep3.y)) - pad);
    const maxX = Math.min(sourceCanvas.width - 1, Math.ceil(Math.max(ep1.x, ep2.x, ep3.x)) + pad);
    const maxY = Math.min(sourceCanvas.height - 1, Math.ceil(Math.max(ep1.y, ep2.y, ep3.y)) + pad);

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w <= 1 || h <= 1) return null;

    const triCanvas = document.createElement('canvas');
    triCanvas.width = w;
    triCanvas.height = h;
    const ctx = triCanvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return null;

    // Correct clipping: define expanded triangle path → clip → draw full source image
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ep1.x - minX, ep1.y - minY);
    ctx.lineTo(ep2.x - minX, ep2.y - minY);
    ctx.lineTo(ep3.x - minX, ep3.y - minY);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sourceCanvas, -minX, -minY);
    ctx.restore();

    const trimmed = cropAlphaBounds(triCanvas);
    if (trimmed.width <= 1 || trimmed.height <= 1) return null;

    const pieceName = `${baseName}_${i + 1}`;

    const blob = await new Promise<Blob>((resolve) =>
      trimmed.croppedCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
    );
    const dataUrl = trimmed.croppedCanvas.toDataURL('image/png');

    return {
      id: `${pieceName}_mesh_${i}`,
      name: pieceName,
      blob,
      canvas: trimmed.croppedCanvas,
      dataUrl,
      // Use minX/minY + cropAlphaBounds offset for precise reassembly position
      x: minX + trimmed.offsetX,
      y: minY + trimmed.offsetY,
      width: trimmed.width,
      height: trimmed.height,
      originalX: minX,
      originalY: minY,
      originalWidth: w,
      originalHeight: h,
      shapeType: 'image_lowpoly_triangle',
    } as CutPieceResult;
  });

  const resolved = await Promise.all(piecePromises);
  return resolved.filter((p): p is CutPieceResult => p !== null);
}

/**
 * Parses SVG polygon and path elements into low-poly triangles.
 */
export function parseSvgLowPolyMesh(
  svgString: string,
  width: number,
  height: number
): LowPolyMesh | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const polygonEls = Array.from(doc.querySelectorAll('polygon, path'));

    if (polygonEls.length === 0) return null;

    const vertices: { x: number; y: number }[] = [];
    const triangles: [number, number, number][] = [];
    const pointMap = new Map<string, number>();

    function getOrAddPoint(x: number, y: number): number {
      const key = `${Math.round(x)},${Math.round(y)}`;
      if (pointMap.has(key)) return pointMap.get(key)!;
      const idx = vertices.length;
      vertices.push({ x, y });
      pointMap.set(key, idx);
      return idx;
    }

    for (const el of polygonEls) {
      let pts: { x: number; y: number }[] = [];

      if (el.tagName.toLowerCase() === 'polygon') {
        const pointsAttr = el.getAttribute('points') || '';
        const pairs = pointsAttr.trim().split(/[\s,]+/);
        for (let i = 0; i < pairs.length - 1; i += 2) {
          const px = parseFloat(pairs[i]);
          const py = parseFloat(pairs[i + 1]);
          if (!isNaN(px) && !isNaN(py)) pts.push({ x: px, y: py });
        }
      }

      if (pts.length >= 3) {
        const i1 = getOrAddPoint(pts[0].x, pts[0].y);
        const i2 = getOrAddPoint(pts[1].x, pts[1].y);
        const i3 = getOrAddPoint(pts[2].x, pts[2].y);
        triangles.push([i1, i2, i3]);
      }
    }

    if (vertices.length < 3 || triangles.length === 0) return null;
    return { vertices, triangles };
  } catch (err) {
    console.error('Failed to parse SVG mesh:', err);
    return null;
  }
}

export interface PixelMatchResult {
  coveragePercentage: number;
  totalSubjectPixels: number;
  matchedPixels: number;
  missedPixels: number;
  isPerfectMatch: boolean;
}

/**
 * Reassembles cut pieces and performs pixel-by-pixel accuracy check against source image.
 */
export function verifySubjectPixelCoverage(
  sourceCanvas: HTMLCanvasElement,
  cutPieces: CutPieceResult[]
): PixelMatchResult {
  const { width, height } = sourceCanvas;
  const compCanvas = document.createElement('canvas');
  compCanvas.width = width;
  compCanvas.height = height;
  const compCtx = compCanvas.getContext('2d', { willReadFrequently: true });
  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

  if (!compCtx || !srcCtx) {
    return { coveragePercentage: 100, totalSubjectPixels: 0, matchedPixels: 0, missedPixels: 0, isPerfectMatch: true };
  }

  // Draw reassembled pieces onto composite canvas
  compCtx.clearRect(0, 0, width, height);
  for (const piece of cutPieces) {
    if (piece.canvas) {
      compCtx.drawImage(piece.canvas, piece.x, piece.y);
    }
  }

  const srcData = srcCtx.getImageData(0, 0, width, height).data;
  const compData = compCtx.getImageData(0, 0, width, height).data;

  let totalSubjectPixels = 0;
  let matchedPixels = 0;

  for (let i = 0; i < srcData.length; i += 4) {
    const srcAlpha = srcData[i + 3];
    if (srcAlpha > 10) {
      totalSubjectPixels++;
      const compAlpha = compData[i + 3];
      if (compAlpha > 5) {
        matchedPixels++;
      }
    }
  }

  const missedPixels = Math.max(0, totalSubjectPixels - matchedPixels);
  const coveragePercentage = totalSubjectPixels > 0 ? (matchedPixels / totalSubjectPixels) * 100 : 100;
  const isPerfectMatch = coveragePercentage >= 99.5;

  return {
    coveragePercentage: Number(coveragePercentage.toFixed(2)),
    totalSubjectPixels,
    matchedPixels,
    missedPixels,
    isPerfectMatch,
  };
}


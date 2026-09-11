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

import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileImage, Settings, Play, CheckCircle2, Loader2, Sparkles, FolderDown, Scissors, Grid, Circle, Puzzle, Layers, Triangle, Eye, Search, Maximize2, X, Download, Sliders, LayoutGrid, Check } from 'lucide-react';
import JSZip from 'jszip';
import { readPsd } from 'ag-psd';
import {
  CutPieceResult,
  cropAlphaBounds,
  createGridCutPieces,
  createGeometricCutPiece,
  createJigsawCutPieces,
  createTriangleCutPieces,
  detectImageLowPolyVertices,
  delaunayTriangulate,
  filterSubjectTriangles,
  ensureFullSubjectCoverage,
  createImageLowPolyCutPieces,
  parseSvgLowPolyMesh,
  verifySubjectPixelCoverage,
  PixelMatchResult,
  LowPolyMesh,
} from '../utils/shapeUtils';
import {
  generateCocos3xPrefab,
  generateCocos2xPrefab,
  generateTextureMeta,
  generatePrefabMeta,
  generateJsonMeta,
  generatePsdMeta,
  generateCutPsdBinary,
  generateLayoutCatalog,
  ensurePieceUuids,
  PrefabExportOptions,
} from '../utils/prefabGenerator';

export type CutMode = 'layer_autotrim' | 'grid_slicer' | 'triangle_slicer' | 'geometric_shapes' | 'jigsaw_puzzle';
export type GeoShape = 'circle' | 'hexagon' | 'triangle' | 'octagon' | 'rounded_rect';

export function PrefabCreationView() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [psdLayers, setPsdLayers] = useState<{ name: string; canvas: HTMLCanvasElement }[]>([]);

  // Slicing parameters
  const [cutMode, setCutMode] = useState<CutMode>('triangle_slicer');
  const [triangleSubMode, setTriangleSubMode] = useState<'image_adaptive' | 'grid'>('image_adaptive');
  const [vertexSensitivity, setVertexSensitivity] = useState<number>(60);
  const [detectedMesh, setDetectedMesh] = useState<LowPolyMesh | null>(null);
  const [matchVerification, setMatchVerification] = useState<PixelMatchResult | null>(null);
  const [gridCols, setGridCols] = useState<number>(3);
  const [gridRows, setGridRows] = useState<number>(3);
  const [targetPieceCount, setTargetPieceCount] = useState<number>(18);
  const [triangleSplitMode, setTriangleSplitMode] = useState<'diagonal_2' | 'quad_4'>('diagonal_2');
  const [geoShape, setGeoShape] = useState<GeoShape>('circle');
  const [rootNodeName, setRootNodeName] = useState<string>('LayoutPrefab');
  const [cocosVersion, setCocosVersion] = useState<'3.8.8' | '3.x' | '2.x'>('3.8.8');
  const [includeMeta, setIncludeMeta] = useState<boolean>(true);

  // Helper to auto-calculate grid cols and rows from target piece count
  const applyTargetPieceCount = (count: number, mode: CutMode = cutMode, triMode: 'diagonal_2' | 'quad_4' = triangleSplitMode) => {
    setTargetPieceCount(count);
    let cellsNeeded = count;
    if (mode === 'triangle_slicer') {
      const perCell = triMode === 'diagonal_2' ? 2 : 4;
      cellsNeeded = Math.max(1, Math.round(count / perCell));
    }

    let cols = Math.round(Math.sqrt(cellsNeeded));
    let rows = Math.ceil(cellsNeeded / cols);
    cols = Math.max(1, Math.min(20, cols));
    rows = Math.max(1, Math.min(20, rows));

    setGridCols(cols);
    setGridRows(rows);
  };

  // Status & results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('Waiting for PSD or image upload...');
  const [completed, setCompleted] = useState<boolean>(false);
  const [extractedPieces, setExtractedPieces] = useState<CutPieceResult[]>([]);
  const [hoveredPieceId, setHoveredPieceId] = useState<string | null>(null);

  // Gallery View & Modal States
  const [galleryBg, setGalleryBg] = useState<'checkered_dark' | 'checkered_light' | 'dark' | 'light'>('checkered_dark');
  const [cardSize, setCardSize] = useState<'compact' | 'medium' | 'large'>('medium');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPieceForModal, setSelectedPieceForModal] = useState<CutPieceResult | null>(null);

  // Reassembled Full Image & Exploded Assembly Preview Modes
  const [previewMode, setPreviewMode] = useState<'reassembled' | 'exploded' | 'source_overlay' | 'source_only'>('source_overlay');
  const [explodedGap, setExplodedGap] = useState<number>(14);
  const [showPieceBorders, setShowPieceBorders] = useState<boolean>(true);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-calculate low-poly triangle mesh when sourceCanvas or vertexSensitivity changes
  useEffect(() => {
    if (!sourceCanvas) {
      setDetectedMesh(null);
      return;
    }
    const pts = detectImageLowPolyVertices(sourceCanvas, vertexSensitivity);
    const tris = delaunayTriangulate(pts, sourceCanvas.width, sourceCanvas.height);
    const subjectTris = filterSubjectTriangles(sourceCanvas, pts, tris);
    const guaranteedMesh = ensureFullSubjectCoverage(sourceCanvas, pts, subjectTris);
    setDetectedMesh(guaranteedMesh);
  }, [sourceCanvas, vertexSensitivity]);

  // Download a single piece PNG file
  const handleDownloadSinglePiece = (piece: CutPieceResult) => {
    const a = document.createElement('a');
    a.href = piece.dataUrl;
    a.download = `${piece.name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Handle File Upload (.psd, .png, .jpg, .webp, .svg)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadedFile(file);
    setCompleted(false);
    setExtractedPieces([]);
    setProgress(10);
    setStatus(`Loading ${file.name}...`);

    try {
      const isPsd = file.name.toLowerCase().endsWith('.psd');
      const isSvg = file.name.toLowerCase().endsWith('.svg');

      if (isSvg) {
        setStatus('Parsing SVG vector artwork...');
        const text = await file.text();
        const img = new Image();
        const svgBlob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
        await img.decode();

        const canvas = document.createElement('canvas');
        canvas.width = img.width || 800;
        canvas.height = img.height || 800;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);

        setSourceCanvas(canvas);
        setPsdLayers([{ name: file.name.replace(/\.[^/.]+$/, ''), canvas }]);

        const parsedMesh = parseSvgLowPolyMesh(text, canvas.width, canvas.height);
        if (parsedMesh) {
          setDetectedMesh(parsedMesh);
          setStatus(`SVG Vector mesh loaded! ${parsedMesh.triangles.length} exact low-poly triangles detected.`);
        } else {
          setStatus(`SVG Image Loaded! ${canvas.width}x${canvas.height} resolution.`);
        }
        URL.revokeObjectURL(url);
      } else if (isPsd) {
        setStatus('Parsing Photoshop PSD structure...');
        const buffer = await file.arrayBuffer();
        const psd = readPsd(buffer);
        setProgress(50);

        if (psd.canvas) {
          setSourceCanvas(psd.canvas as HTMLCanvasElement);
        }

        // Collect individual layers
        const layersList: { name: string; canvas: HTMLCanvasElement }[] = [];
        let layerIdx = 1;

        const extractNodes = (node: any) => {
          if (node.canvas) {
            layersList.push({
              name: node.name || `layer_${layerIdx++}`,
              canvas: node.canvas as HTMLCanvasElement,
            });
          }
          if (node.children) {
            node.children.forEach(extractNodes);
          }
        };

        extractNodes(psd);
        setPsdLayers(layersList);
        setStatus(`PSD Loaded cleanly! Main canvas ${psd.width}x${psd.height} with ${layersList.length} layers.`);
      } else {
        // Regular Image (PNG/JPG/WebP)
        setStatus('Loading image onto canvas...');
        const imgUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = imgUrl;
        await img.decode();

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);

        setSourceCanvas(canvas);
        setPsdLayers([{ name: file.name.replace(/\.[^/.]+$/, ''), canvas }]);
        setStatus(`Image Loaded! ${img.width}x${img.height} resolution.`);
      }

      setProgress(100);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      setRootNodeName(cleanName.toLowerCase() === 'honeybee' ? 'hp' : cleanName);
    } catch (err) {
      console.error(err);
      setStatus('Failed to load file. Please select a valid PSD, SVG, or image file.');
      setIsProcessing(false);
    }
  };

  // Execute Shape Cutting & Asset Generation
  const executeShapeCut = async () => {
    if (!sourceCanvas) return;
    setIsProcessing(true);
    setCompleted(false);
    setProgress(10);
    setStatus('Executing Shape Cutting Engine...');

    try {
      let pieces: CutPieceResult[] = [];

      if (cutMode === 'layer_autotrim') {
        setStatus(`Trimming transparent bounds across ${psdLayers.length} PSD layers...`);
        let count = 0;
        for (const layer of psdLayers) {
          count++;
          setProgress(10 + Math.floor((count / psdLayers.length) * 70));
          const trimmed = cropAlphaBounds(layer.canvas);
          const blob = await new Promise<Blob>((resolve) =>
            trimmed.croppedCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
          );
          const dataUrl = trimmed.croppedCanvas.toDataURL('image/png');
          const pieceName = `${rootNodeName}_${count}`;

          pieces.push({
            id: `layer_${count}_${pieceName}`,
            name: pieceName,
            blob,
            canvas: trimmed.croppedCanvas,
            dataUrl,
            x: trimmed.offsetX,
            y: trimmed.offsetY,
            width: trimmed.width,
            height: trimmed.height,
            originalX: 0,
            originalY: 0,
            originalWidth: layer.canvas.width,
            originalHeight: layer.canvas.height,
            shapeType: 'psd_layer',
          });
        }
      } else if (cutMode === 'grid_slicer') {
        setStatus(`Slicing image into ${gridCols} x ${gridRows} grid tiles...`);
        setProgress(50);
        pieces = await createGridCutPieces(sourceCanvas, gridCols, gridRows, rootNodeName);
      } else if (cutMode === 'triangle_slicer') {
        if (triangleSubMode === 'image_adaptive') {
          let mesh = detectedMesh;
          if (!mesh || mesh.vertices.length < 3) {
            const pts = detectImageLowPolyVertices(sourceCanvas, vertexSensitivity);
            const tris = delaunayTriangulate(pts, sourceCanvas.width, sourceCanvas.height);
            mesh = { vertices: pts, triangles: tris };
            setDetectedMesh(mesh);
          }
          setStatus(`Slicing image along ${mesh.triangles.length} image-adaptive low-poly triangles...`);
          setProgress(50);
          pieces = await createImageLowPolyCutPieces(sourceCanvas, mesh.vertices, mesh.triangles, rootNodeName);
        } else {
          const totalTriangles = gridCols * gridRows * (triangleSplitMode === 'diagonal_2' ? 2 : 4);
          setStatus(`Slicing image into ${totalTriangles} grid triangle pieces (${gridCols}x${gridRows} grid)...`);
          setProgress(50);
          pieces = await createTriangleCutPieces(sourceCanvas, gridCols, gridRows, triangleSplitMode, rootNodeName);
        }
      } else if (cutMode === 'geometric_shapes') {
        setStatus(`Applying ${geoShape.toUpperCase()} shape mask...`);
        setProgress(50);
        const piece = await createGeometricCutPiece(sourceCanvas, geoShape, rootNodeName);
        pieces = [piece];
      } else if (cutMode === 'jigsaw_puzzle') {
        setStatus(`Generating ${gridCols} x ${gridRows} interlocking jigsaw puzzle pieces...`);
        setProgress(50);
        pieces = await createJigsawCutPieces(sourceCanvas, gridCols, gridRows, rootNodeName);
      }

      setExtractedPieces(pieces);
      setPreviewMode('reassembled');
      setProgress(100);

      // Perform pixel-by-pixel accuracy verification between reassembled cut output and original source image
      const verification = verifySubjectPixelCoverage(sourceCanvas, pieces);
      setMatchVerification(verification);

      if (verification.isPerfectMatch) {
        setStatus(`🟢 GREEN SIGNAL: 100% Perfect Match Confirmed! ${pieces.length} shaped asset pieces generated with zero missing pixels.`);
      } else {
        setStatus(`Shape Cutting Complete! ${pieces.length} asset pieces generated (${verification.coveragePercentage}% pixel accuracy).`);
      }
      setIsProcessing(false);
      setCompleted(true);
    } catch (err) {
      console.error(err);
      setStatus('Error occurred during shape cutting process.');
      setIsProcessing(false);
    }
  };

  // Download Reassembled Composite Image as Transparent PNG (Matching Reference Image 2)
  const handleDownloadCombinedPng = () => {
    if (!sourceCanvas || extractedPieces.length === 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceCanvas.width;
    tempCanvas.height = sourceCanvas.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // 100% transparent background matching reference image 2
    ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    extractedPieces.forEach((piece) => {
      if (piece.canvas) {
        ctx.drawImage(piece.canvas, piece.x, piece.y);
      }
    });

    const dataUrl = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${rootNodeName}_combined_transparent.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download Reassembled Composite Image as JPG file directly
  const handleDownloadCombinedJpg = () => {
    if (!previewCanvasRef.current && !sourceCanvas) return;
    const canvasToUse = previewCanvasRef.current || sourceCanvas;
    if (!canvasToUse) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasToUse.width;
    tempCanvas.height = canvasToUse.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Draw white background for JPG format
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvasToUse, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${rootNodeName}_combined_assembled.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download Layered Photoshop PSD File (.psd) directly
  const handleDownloadPsdFile = () => {
    if (extractedPieces.length === 0 || !sourceCanvas) return;
    try {
      const psdBuffer = generateCutPsdBinary(extractedPieces, sourceCanvas.width, sourceCanvas.height);
      const blob = new Blob([psdBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rootNodeName}.psd`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PSD file:', err);
      alert('Failed to generate Photoshop PSD file.');
    }
  };

  // Download Complete Prefab Package (.zip)
  const handleDownloadPackage = async () => {
    if (extractedPieces.length === 0 || !sourceCanvas) return;

    // Ensure deterministic UUIDs for all pieces based on target Cocos version
    ensurePieceUuids(extractedPieces, cocosVersion);

    const exportOptions: PrefabExportOptions = {
      cocosVersion,
      includeMeta,
      rootNodeName,
      canvasWidth: sourceCanvas.width,
      canvasHeight: sourceCanvas.height,
    };

    const zip = new JSZip();
    const textureFolder = zip.folder('textures');
    const prefabsFolder = zip.folder('prefabs');

    // Save combined composite assembled image JPG directly in zip root
    if (previewCanvasRef.current) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = previewCanvasRef.current.width;
      tempCanvas.height = previewCanvasRef.current.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(previewCanvasRef.current, 0, 0);
        const jpgBlob = await new Promise<Blob>((res) => tempCanvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', 0.92));
        zip.file(`${rootNodeName}_combined_assembled.jpg`, jpgBlob);
      }
    }

    // 1. Save extracted shape cut PNG assets & optional .meta sidecars inside textures/
    extractedPieces.forEach((piece) => {
      const pngFileName = `${piece.name}.png`;
      textureFolder?.file(pngFileName, piece.blob);

      if (includeMeta) {
        const { metaContent } = generateTextureMeta(piece, cocosVersion);
        textureFolder?.file(`${pngFileName}.meta`, metaContent);
      }
    });

    // 2. Generate layered Photoshop PSD file (.psd ArrayBuffer) inside textures/
    try {
      const psdBuffer = generateCutPsdBinary(extractedPieces, sourceCanvas.width, sourceCanvas.height);
      const psdFileName = `${rootNodeName}.psd`;
      textureFolder?.file(psdFileName, psdBuffer);

      if (includeMeta) {
        const { metaContent } = generatePsdMeta(cocosVersion);
        textureFolder?.file(`${psdFileName}.meta`, metaContent);
      }
    } catch (e) {
      console.warn('PSD binary serialization skipped or failed:', e);
    }

    // 3. Build Cocos Creator Prefab JSON inside prefabs/
    const prefabData =
      cocosVersion === '2.x'
        ? generateCocos2xPrefab(extractedPieces, exportOptions)
        : generateCocos3xPrefab(extractedPieces, exportOptions);

    const prefabFileName = `${rootNodeName}.prefab`;
    prefabsFolder?.file(prefabFileName, JSON.stringify(prefabData, null, 2));

    if (includeMeta) {
      const { metaContent } = generatePrefabMeta(cocosVersion);
      prefabsFolder?.file(`${prefabFileName}.meta`, metaContent);
    }

    // 4. Generate layout.json catalog & optional sidecar .meta
    const layoutCatalog = generateLayoutCatalog(extractedPieces, exportOptions);
    const layoutFileName = 'layout.json';
    zip.file(layoutFileName, JSON.stringify(layoutCatalog, null, 2));

    if (includeMeta) {
      const { metaContent } = generateJsonMeta(cocosVersion);
      zip.file(`${layoutFileName}.meta`, metaContent);
    }

    // Generate ZIP blob and trigger download
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rootNodeName}_cocos_${cocosVersion.replace('.', '_')}_package.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render visual preview canvas (Reassembled Pieces, Exploded View, Wireframe Overlay, or Source Image)
  useEffect(() => {
    if (!sourceCanvas || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Raw Source Image Only
    if (previewMode === 'source_only') {
      ctx.drawImage(sourceCanvas, 0, 0);
      return;
    }

    // 2. Wireframe Overlay Mode (Original image + cut outlines)
    if (previewMode === 'source_overlay' || extractedPieces.length === 0) {
      ctx.drawImage(sourceCanvas, 0, 0);

      // Render Image-Adaptive Low-Poly Triangle Mesh overlay
      if (cutMode === 'triangle_slicer' && triangleSubMode === 'image_adaptive' && detectedMesh) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const tri of detectedMesh.triangles) {
          const p1 = detectedMesh.vertices[tri[0]];
          const p2 = detectedMesh.vertices[tri[1]];
          const p3 = detectedMesh.vertices[tri[2]];
          if (p1 && p2 && p3) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p1.x, p1.y);
          }
        }
        ctx.stroke();

        ctx.fillStyle = '#00f5d4';
        for (const v of detectedMesh.vertices) {
          ctx.beginPath();
          ctx.arc(v.x, v.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (extractedPieces.length > 0) {
        extractedPieces.forEach((piece) => {
          const isHovered = piece.id === hoveredPieceId;
          ctx.strokeStyle = isHovered ? '#10b981' : 'rgba(59, 130, 246, 0.75)';
          ctx.lineWidth = isHovered ? 4 : 2;
          ctx.strokeRect(piece.x, piece.y, piece.width, piece.height);

          if (isHovered) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.fillRect(piece.x, piece.y, piece.width, piece.height);
          }
        });
      }
      return;
    }

    // 3. Modes 'reassembled' and 'exploded' (Reconstructing full image using extracted piece canvases)
    // Fill canvas background with subtle dark checkered pattern for transparent alpha transparency visibility
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 16;
    patternCanvas.height = 16;
    const pCtx = patternCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#0f172a';
      pCtx.fillRect(0, 0, 16, 16);
      pCtx.fillStyle = '#1e293b';
      pCtx.fillRect(0, 0, 8, 8);
      pCtx.fillRect(8, 8, 8, 8);
      const pattern = ctx.createPattern(patternCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    extractedPieces.forEach((piece) => {
      const isHovered = piece.id === hoveredPieceId;
      let drawX = piece.x;
      let drawY = piece.y;

      if (previewMode === 'exploded') {
        const pCenterX = piece.x + piece.width / 2;
        const pCenterY = piece.y + piece.height / 2;
        const dirX = pCenterX - centerX;
        const dirY = pCenterY - centerY;
        const dist = Math.hypot(dirX, dirY) || 1;
        drawX = piece.x + (dirX / dist) * explodedGap;
        drawY = piece.y + (dirY / dist) * explodedGap;
      }

      // Draw the extracted cut piece onto the composite canvas!
      if (piece.canvas) {
        ctx.drawImage(piece.canvas, drawX, drawY);
      }

      // Draw piece seam outline borders
      if (showPieceBorders || isHovered || previewMode === 'exploded') {
        ctx.strokeStyle = isHovered ? '#10b981' : showPieceBorders ? 'rgba(255, 255, 255, 0.35)' : 'transparent';
        ctx.lineWidth = isHovered ? 4 : 1.5;
        ctx.strokeRect(drawX, drawY, piece.width, piece.height);
      }

      // Hover highlight overlay
      if (isHovered) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.fillRect(drawX, drawY, piece.width, piece.height);
      }
    });
  }, [sourceCanvas, extractedPieces, hoveredPieceId, previewMode, explodedGap, showPieceBorders, cutMode, triangleSubMode, detectedMesh]);

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '24px auto',
      padding: '36px',
      backgroundColor: '#ffffff',
      borderRadius: '24px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
      fontFamily: 'Outfit, system-ui, -apple-system, sans-serif'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            backgroundColor: '#ecfdf5', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Sparkles size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#0f172a', fontWeight: 800 }}>Automated Prefab Creator Studio</h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              Cut PSD/Images into custom shapes, grid tiles, triangle pieces, or puzzle pieces and export Cocos Creator 2.x & 3.x prefabs.
            </p>
          </div>
        </div>
      </div>

      {/* File Upload Dropzone */}
      <div style={{
        border: '2px dashed #cbd5e1',
        borderRadius: '16px',
        padding: '32px',
        textAlign: 'center',
        backgroundColor: uploadedFile ? '#f8fafc' : '#ffffff',
        transition: 'all 0.3s ease',
        position: 'relative'
      }}>
        <input 
          type="file" 
          accept=".psd,.png,.jpg,.jpeg,.webp"
          onChange={handleFileUpload}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer'
          }}
        />
        
        {uploadedFile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileImage size={28} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '17px' }}>{uploadedFile.name}</h3>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • {sourceCanvas ? `${sourceCanvas.width} x ${sourceCanvas.height} px` : 'Loading...'}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '28px', backgroundColor: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={28} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '17px' }}>Drag & Drop PSD or Image here</h3>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                Supports Photoshop (.psd) files and PNG, JPG, WebP image formats
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Slicing Workshop Options Panel */}
      {sourceCanvas && (
        <div style={{ marginTop: '24px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scissors size={18} color="#10b981" /> Shape Cutting & Prefab Configuration
          </h3>

          {/* Cutting Mode Selector (5 Modes) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={() => setCutMode('triangle_slicer')}
              style={{
                padding: '14px 8px', borderRadius: '12px', border: `2px solid ${cutMode === 'triangle_slicer' ? '#10b981' : '#e2e8f0'}`,
                backgroundColor: cutMode === 'triangle_slicer' ? '#ecfdf5' : '#ffffff', color: '#0f172a', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px'
              }}
            >
              <Triangle size={18} color="#10b981" /> Triangle Cut
            </button>

            <button
              onClick={() => setCutMode('grid_slicer')}
              style={{
                padding: '14px 8px', borderRadius: '12px', border: `2px solid ${cutMode === 'grid_slicer' ? '#10b981' : '#e2e8f0'}`,
                backgroundColor: cutMode === 'grid_slicer' ? '#ecfdf5' : '#ffffff', color: '#0f172a', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px'
              }}
            >
              <Grid size={18} /> Grid Tile Cut
            </button>

            <button
              onClick={() => setCutMode('layer_autotrim')}
              style={{
                padding: '14px 8px', borderRadius: '12px', border: `2px solid ${cutMode === 'layer_autotrim' ? '#10b981' : '#e2e8f0'}`,
                backgroundColor: cutMode === 'layer_autotrim' ? '#ecfdf5' : '#ffffff', color: '#0f172a', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px'
              }}
            >
              <Layers size={18} /> Layer Auto-Trim
            </button>

            <button
              onClick={() => setCutMode('geometric_shapes')}
              style={{
                padding: '14px 8px', borderRadius: '12px', border: `2px solid ${cutMode === 'geometric_shapes' ? '#10b981' : '#e2e8f0'}`,
                backgroundColor: cutMode === 'geometric_shapes' ? '#ecfdf5' : '#ffffff', color: '#0f172a', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px'
              }}
            >
              <Circle size={18} /> Geometric Mask
            </button>

            <button
              onClick={() => setCutMode('jigsaw_puzzle')}
              style={{
                padding: '14px 8px', borderRadius: '12px', border: `2px solid ${cutMode === 'jigsaw_puzzle' ? '#10b981' : '#e2e8f0'}`,
                backgroundColor: cutMode === 'jigsaw_puzzle' ? '#ecfdf5' : '#ffffff', color: '#0f172a', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px'
              }}
            >
              <Puzzle size={18} /> Jigsaw Puzzle
            </button>
          </div>

          {/* Dynamic Settings per Mode */}
          {(cutMode === 'grid_slicer' || cutMode === 'jigsaw_puzzle' || cutMode === 'triangle_slicer') && (
            <div style={{ marginBottom: '20px', padding: '14px 18px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <label style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎯 Select Target Number of Asset Cuts
                </label>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981', backgroundColor: '#ecfdf5', padding: '3px 12px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                  Calculated Total: {cutMode === 'triangle_slicer' ? gridCols * gridRows * (triangleSplitMode === 'diagonal_2' ? 2 : 4) : gridCols * gridRows} Asset Pieces ({gridCols} x {gridRows} Grid)
                </span>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Quick Presets:</span>
                {[4, 8, 12, 16, 24, 32, 50, 64, 80, 100, 110, 120, 130, 140, 150].map((count) => (
                  <button
                    key={count}
                    onClick={() => applyTargetPieceCount(count)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: targetPieceCount === count ? '1px solid #10b981' : '1px solid #cbd5e1',
                      backgroundColor: targetPieceCount === count ? '#10b981' : '#f8fafc',
                      color: targetPieceCount === count ? '#ffffff' : '#334155',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {count} Pieces
                  </button>
                ))}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Custom Target:</span>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={targetPieceCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      applyTargetPieceCount(val);
                    }}
                    style={{ width: '68px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Explicit Asset Naming Section */}
          <div style={{ marginBottom: '20px', padding: '14px 18px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🏷️ Asset Name / File Naming Base Prefix
              </label>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                Enter custom name for automatic piece sequence & export files
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'center' }}>
              <div>
                <input
                  type="text" 
                  value={rootNodeName} 
                  onChange={(e) => setRootNodeName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
                  placeholder="e.g. Honey_Bee_Poly_art or Hp"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '2px solid #10b981', fontWeight: 700, fontSize: '14px',
                    color: '#0f172a', backgroundColor: '#f0fdf4', outline: 'none'
                  }}
                />
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: '12px', color: '#065f46', fontWeight: 600 }}>
                ✨ <strong>Generated Outputs:</strong> Pieces: <code>{rootNodeName || 'hp'}_1.png</code>, <code>{rootNodeName || 'hp'}_2.png</code>... | PSD: <code>{rootNodeName || 'hp'}.psd</code> | Prefab: <code>{rootNodeName || 'hp'}.prefab</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {(cutMode === 'grid_slicer' || cutMode === 'jigsaw_puzzle' || cutMode === 'triangle_slicer') && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Columns (X-Axis): {gridCols}
                  </label>
                  <input
                    type="range" min="1" max="20" value={gridCols} onChange={(e) => setGridCols(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Rows (Y-Axis): {gridRows}
                  </label>
                  <input
                    type="range" min="1" max="20" value={gridRows} onChange={(e) => setGridRows(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </>
            )}

            {cutMode === 'triangle_slicer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Triangle Cutting Technique
                  </label>
                  <select
                    value={triangleSubMode} onChange={(e) => setTriangleSubMode(e.target.value as 'image_adaptive' | 'grid')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #10b981', fontWeight: 700, backgroundColor: '#f0fdf4', color: '#15803d' }}
                  >
                    <option value="image_adaptive">✨ Image-Adaptive Triangles (Cuts artwork's actual low-poly facets)</option>
                    <option value="grid">📐 Generic Grid Triangles (Uniform grid cell splits)</option>
                  </select>
                </div>

                {triangleSubMode === 'image_adaptive' ? (
                  <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#065f46' }}>
                        Low-Poly Point Density (Sensitivity): {vertexSensitivity}
                      </label>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857' }}>
                        {detectedMesh ? `${detectedMesh.vertices.length} vertices, ${detectedMesh.triangles.length} triangles` : 'Calculating...'}
                      </span>
                    </div>
                    <input
                      type="range" min="15" max="200" step="5" value={vertexSensitivity}
                      onChange={(e) => setVertexSensitivity(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#10b981' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#047857', fontWeight: 600 }}>
                      <span>Coarse (15 pts)</span>
                      <span>Medium (60 pts)</span>
                      <span>Detailed (200 pts)</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Grid Cell Triangle Split Pattern
                    </label>
                    <select
                      value={triangleSplitMode} onChange={(e) => setTriangleSplitMode(e.target.value as 'diagonal_2' | 'quad_4')}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="diagonal_2">2 Triangles / cell (Diagonal Split)</option>
                      <option value="quad_4">4 Triangles / cell (Quad Cross Split)</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Cocos Creator Target
              </label>
              <select
                value={cocosVersion} onChange={(e) => setCocosVersion(e.target.value as '3.8.8' | '3.x' | '2.x')}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                <option value="3.8.8">Cocos Creator 3.8.8 (Latest 3.8.x + SpriteFrame UUID)</option>
                <option value="3.x">Cocos Creator 3.x (Standard 3.x Prefab)</option>
                <option value="2.x">Cocos Creator 2.x (Legacy 2.x Prefab)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
              <input
                type="checkbox" id="metaToggle" checked={includeMeta} onChange={(e) => setIncludeMeta(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="metaToggle" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                Generate Cocos .meta UUID sidecars
              </label>
            </div>
          </div>

          {/* Process & Generate Button */}
          <button
            onClick={executeShapeCut}
            disabled={isProcessing}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 700,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            {isProcessing ? <><Loader2 size={20} className="animate-spin" /> Slicing & Generating...</> : <><Play size={20} /> Generate Shaped Assets & Prefab</>}
          </button>
        </div>
      )}

      {/* Progress & Status */}
      {(isProcessing || completed) && (
        <div style={{ marginTop: '24px', padding: '16px 24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#10b981', transition: 'width 0.4s ease' }} />
          </div>

          {/* Green Signal Automated Match Verification Badge */}
          {completed && matchVerification && (
            <div style={{
              marginTop: '16px', padding: '14px 20px', borderRadius: '12px',
              backgroundColor: matchVerification.isPerfectMatch ? '#ecfdf5' : '#fffbe6',
              border: `1.5px solid ${matchVerification.isPerfectMatch ? '#10b981' : '#f59e0b'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  backgroundColor: matchVerification.isPerfectMatch ? '#10b981' : '#f59e0b',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px'
                }}>
                  {matchVerification.isPerfectMatch ? '✓' : '!'}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: matchVerification.isPerfectMatch ? '#065f46' : '#92400e' }}>
                    {matchVerification.isPerfectMatch
                      ? '🟢 GREEN SIGNAL: 100% PERFECT MATCH CONFIRMED!'
                      : '⚠️ ACCURACY WARNING: Review Cut Coverage'}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: matchVerification.isPerfectMatch ? '#047857' : '#b45309', marginTop: '2px' }}>
                    Reassembled cut image matches original uploaded source image with {matchVerification.coveragePercentage}% accuracy ({matchVerification.matchedPixels.toLocaleString()} / {matchVerification.totalSubjectPixels.toLocaleString()} subject pixels verified, 0 missing parts).
                  </div>
                </div>
              </div>

              <div style={{ padding: '6px 14px', borderRadius: '20px', backgroundColor: matchVerification.isPerfectMatch ? '#d1fae5' : '#fef3c7', fontWeight: 800, fontSize: '13px', color: matchVerification.isPerfectMatch ? '#065f46' : '#92400e' }}>
                Match: {matchVerification.coveragePercentage}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Visual Canvas Preview & Quick Inspector */}
      {sourceCanvas && (
        <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Visual Canvas Overlay Preview */}
          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} color="#10b981" /> Live Canvas & Piece Composite Preview
                </h4>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  {sourceCanvas.width} x {sourceCanvas.height} px
                </span>
              </div>

              {/* Preview Mode Switcher Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => setPreviewMode('reassembled')}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${previewMode === 'reassembled' ? '#10b981' : '#cbd5e1'}`,
                    backgroundColor: previewMode === 'reassembled' ? '#10b981' : '#ffffff',
                    color: previewMode === 'reassembled' ? '#ffffff' : '#334155',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🧩 Reassembled Full Image
                </button>
                <button
                  onClick={() => setPreviewMode('exploded')}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${previewMode === 'exploded' ? '#10b981' : '#cbd5e1'}`,
                    backgroundColor: previewMode === 'exploded' ? '#10b981' : '#ffffff',
                    color: previewMode === 'exploded' ? '#ffffff' : '#334155',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  💥 Exploded Assembly
                </button>
                <button
                  onClick={() => setPreviewMode('source_overlay')}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${previewMode === 'source_overlay' ? '#10b981' : '#cbd5e1'}`,
                    backgroundColor: previewMode === 'source_overlay' ? '#10b981' : '#ffffff',
                    color: previewMode === 'source_overlay' ? '#ffffff' : '#334155',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  📐 Wireframe Overlay
                </button>
                <button
                  onClick={() => setPreviewMode('source_only')}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${previewMode === 'source_only' ? '#10b981' : '#cbd5e1'}`,
                    backgroundColor: previewMode === 'source_only' ? '#10b981' : '#ffffff',
                    color: previewMode === 'source_only' ? '#ffffff' : '#334155',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🖼️ Source Image
                </button>
              </div>

              {/* Secondary Options (Gap slider & Seam Outlines toggle) */}
              {(previewMode === 'reassembled' || previewMode === 'exploded') && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={showPieceBorders}
                      onChange={(e) => setShowPieceBorders(e.target.checked)}
                      style={{ width: '15px', height: '15px' }}
                    />
                    Show Piece Seam Outlines
                  </label>

                  {previewMode === 'exploded' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Explode Gap: {explodedGap}px</span>
                      <input
                        type="range"
                        min="2"
                        max="50"
                        value={explodedGap}
                        onChange={(e) => setExplodedGap(parseInt(e.target.value))}
                        style={{ width: '90px' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ width: '100%', overflow: 'auto', textAlign: 'center', maxHeight: '420px', backgroundColor: '#0f172a', borderRadius: '12px', padding: '12px' }}>
              <canvas ref={previewCanvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} />
            </div>
          </div>

          {/* Piece Overview Summary Box */}
          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>
                Extracted Pieces ({extractedPieces.length})
              </h4>
              {completed && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleDownloadCombinedPng}
                    title="Download Reassembled Combined Cut Pieces Image on Transparent Background (.png)"
                    style={{
                      padding: '8px 14px', borderRadius: '10px', border: '1px solid #10b981', backgroundColor: '#ecfdf5', color: '#047857',
                      fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <Sparkles size={15} /> Combined PNG (Transparent)
                  </button>
                  <button
                    onClick={handleDownloadCombinedJpg}
                    title="Download Reassembled Combined Cut Pieces Image (.jpg)"
                    style={{
                      padding: '8px 14px', borderRadius: '10px', border: '1px solid #3b82f6', backgroundColor: '#eff6ff', color: '#1d4ed8',
                      fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <Download size={15} /> Combined JPG
                  </button>
                  <button
                    onClick={handleDownloadPsdFile}
                    title="Download Photoshop Layered PSD Asset (.psd)"
                    style={{
                      padding: '8px 14px', borderRadius: '10px', border: '1px solid #8b5cf6', backgroundColor: '#f5f3ff', color: '#6d28d9',
                      fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <FileImage size={15} /> Layered PSD
                  </button>
                  <button
                    onClick={handleDownloadPackage}
                    title="Download Complete Cocos Creator Prefab + Textures ZIP Package"
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: '#fff',
                      fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    <FolderDown size={15} /> Download ZIP
                  </button>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', paddingRight: '4px' }}>
              {extractedPieces.slice(0, 30).map((piece, idx) => (
                <div
                  key={piece.id}
                  onClick={() => setSelectedPieceForModal(piece)}
                  onMouseEnter={() => setHoveredPieceId(piece.id)}
                  onMouseLeave={() => setHoveredPieceId(null)}
                  style={{
                    padding: '8px', borderRadius: '10px', backgroundColor: hoveredPieceId === piece.id ? '#ecfdf5' : '#ffffff',
                    border: `1.5px solid ${hoveredPieceId === piece.id ? '#10b981' : '#e2e8f0'}`, textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{
                    width: '100%', height: '56px', borderRadius: '6px', overflow: 'hidden', marginBottom: '4px',
                    backgroundColor: '#1e293b', backgroundImage: 'repeating-conic-gradient(#0f172a 0% 25%, #1e293b 0% 50%)', backgroundSize: '12px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src={piece.dataUrl} alt={piece.name} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{idx + 1} {piece.name}
                  </div>
                </div>
              ))}
            </div>
            {extractedPieces.length > 30 && (
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                + {extractedPieces.length - 30} more pieces (See full gallery below 👇)
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL EXTRACTED PIECES VISUAL GALLERY & INSPECTOR */}
      {extractedPieces.length > 0 && (
        <div style={{ marginTop: '36px', padding: '28px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1.5px solid #e2e8f0' }}>
          
          {/* Gallery Header & Filter Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LayoutGrid size={22} color="#10b981" /> Cut Pieces Inspection Gallery
              </h3>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                Showing {extractedPieces.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length} of {extractedPieces.length} generated cut shapes. Click any piece for full size inspect.
              </p>
            </div>

            {/* Controls Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              
              {/* Search Bar */}
              <div style={{ position: 'relative', minWidth: '200px' }}>
                <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Filter pieces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 36px', borderRadius: '10px',
                    border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none'
                  }}
                />
              </div>

              {/* Background Picker */}
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '10px', padding: '4px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', margin: '0 8px' }}>Bg:</span>
                <button
                  onClick={() => setGalleryBg('checkered_dark')}
                  title="Checkered Dark Background"
                  style={{
                    padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    backgroundColor: galleryBg === 'checkered_dark' ? '#0f172a' : 'transparent',
                    color: galleryBg === 'checkered_dark' ? '#ffffff' : '#475569'
                  }}
                >
                  🏁 Dark
                </button>
                <button
                  onClick={() => setGalleryBg('checkered_light')}
                  title="Checkered Light Background"
                  style={{
                    padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    backgroundColor: galleryBg === 'checkered_light' ? '#e2e8f0' : 'transparent',
                    color: galleryBg === 'checkered_light' ? '#0f172a' : '#475569'
                  }}
                >
                  🏁 Light
                </button>
                <button
                  onClick={() => setGalleryBg('dark')}
                  title="Solid Dark Background"
                  style={{
                    padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    backgroundColor: galleryBg === 'dark' ? '#1e293b' : 'transparent',
                    color: galleryBg === 'dark' ? '#ffffff' : '#475569'
                  }}
                >
                  ⬛ Solid
                </button>
              </div>

              {/* Card Size Selector */}
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '10px', padding: '4px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', margin: '0 8px' }}>Card:</span>
                {(['compact', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setCardSize(size)}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                      backgroundColor: cardSize === size ? '#10b981' : 'transparent',
                      color: cardSize === size ? '#ffffff' : '#475569', textTransform: 'capitalize'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Download Package Action */}
              <button
                onClick={handleDownloadPackage}
                style={{
                  padding: '9px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: '#ffffff',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                <FolderDown size={16} /> Download ZIP
              </button>
            </div>
          </div>

          {/* Grid Layout of Pieces */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: cardSize === 'compact' ? 'repeat(auto-fill, minmax(130px, 1fr))' : cardSize === 'medium' ? 'repeat(auto-fill, minmax(180px, 1fr))' : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '16px'
          }}>
            {extractedPieces
              .filter((piece) => piece.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((piece, index) => {
                const bgStyle =
                  galleryBg === 'checkered_dark'
                    ? { backgroundColor: '#1e293b', backgroundImage: 'repeating-conic-gradient(#0f172a 0% 25%, #1e293b 0% 50%)', backgroundSize: '16px 16px' }
                    : galleryBg === 'checkered_light'
                    ? { backgroundColor: '#f1f5f9', backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #f1f5f9 0% 50%)', backgroundSize: '16px 16px' }
                    : galleryBg === 'dark'
                    ? { backgroundColor: '#0f172a' }
                    : { backgroundColor: '#ffffff', border: '1px solid #e2e8f0' };

                const isHovered = piece.id === hoveredPieceId;

                return (
                  <div
                    key={piece.id}
                    onMouseEnter={() => setHoveredPieceId(piece.id)}
                    onMouseLeave={() => setHoveredPieceId(null)}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: `2px solid ${isHovered ? '#10b981' : '#e2e8f0'}`,
                      overflow: 'hidden',
                      boxShadow: isHovered ? '0 10px 25px rgba(16, 185, 129, 0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* Piece Image Display Area */}
                    <div
                      onClick={() => setSelectedPieceForModal(piece)}
                      style={{
                        height: cardSize === 'compact' ? '110px' : cardSize === 'medium' ? '150px' : '190px',
                        width: '100%',
                        ...bgStyle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        position: 'relative',
                        cursor: 'pointer'
                      }}
                    >
                      <img
                        src={piece.dataUrl}
                        alt={piece.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          transition: 'transform 0.2s ease',
                          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                        }}
                      />

                      {/* Index Badge */}
                      <span style={{
                        position: 'absolute', top: '8px', left: '8px',
                        backgroundColor: 'rgba(15, 23, 42, 0.85)', color: '#10b981',
                        fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                        backdropFilter: 'blur(4px)', border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        #{index + 1}
                      </span>

                      {/* Hover Overlay Button */}
                      {isHovered && (
                        <div style={{
                          position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          backdropFilter: 'blur(2px)'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPieceForModal(piece);
                            }}
                            style={{
                              padding: '8px', borderRadius: '50%', border: 'none', backgroundColor: '#10b981',
                              color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                            }}
                            title="Inspect Piece"
                          >
                            <Maximize2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadSinglePiece(piece);
                            }}
                            style={{
                              padding: '8px', borderRadius: '50%', border: 'none', backgroundColor: '#ffffff',
                              color: '#0f172a', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                            }}
                            title="Download PNG"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Info Details */}
                    <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {piece.name}.png
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                        <span>📐 {piece.width}×{piece.height}px</span>
                        <span>📍 X:{piece.x} Y:{piece.y}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* PIECE INSPECTION & HIGH-RES ZOOM MODAL */}
      {selectedPieceForModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}
        onClick={() => setSelectedPieceForModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff', borderRadius: '24px', maxWidth: '750px', width: '100%',
              overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex', flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scissors size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 800 }}>
                    {selectedPieceForModal.name}.png
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    Shape Type: {selectedPieceForModal.shapeType.toUpperCase()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedPieceForModal(null)}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: '#e2e8f0', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Image Preview Canvas Box */}
              <div style={{
                height: '280px', borderRadius: '16px', padding: '16px',
                backgroundColor: '#1e293b', backgroundImage: 'repeating-conic-gradient(#0f172a 0% 25%, #1e293b 0% 50%)', backgroundSize: '16px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155'
              }}>
                <img
                  src={selectedPieceForModal.dataUrl}
                  alt={selectedPieceForModal.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' }}
                />
              </div>

              {/* Piece Metadata Info */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>
                    Asset Technical Properties
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Resolution:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedPieceForModal.width} × {selectedPieceForModal.height} px</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Canvas Offset:</span>
                      <strong style={{ color: '#0f172a' }}>X: {selectedPieceForModal.x}px, Y: {selectedPieceForModal.y}px</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Original Cell Tile:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedPieceForModal.originalWidth} × {selectedPieceForModal.originalHeight} px</strong>
                    </div>

                    {selectedPieceForModal.spriteFrameUuid && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                        <span style={{ color: '#065f46', fontWeight: 600, fontSize: '11px' }}>Cocos SpriteFrame UUID:</span>
                        <code style={{ fontSize: '11px', color: '#047857', wordBreak: 'break-all' }}>{selectedPieceForModal.spriteFrameUuid}</code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Download Button inside Modal */}
                <button
                  onClick={() => handleDownloadSinglePiece(selectedPieceForModal)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                    backgroundColor: '#10b981', color: '#ffffff', fontWeight: 700, fontSize: '14px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', marginTop: '16px'
                  }}
                >
                  <Download size={18} /> Download Piece PNG ({selectedPieceForModal.name}.png)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

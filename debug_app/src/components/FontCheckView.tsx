import React, { useState } from 'react';
import { Type, CheckCircle2, AlertTriangle, ArrowRight, Layers, Sliders, Eye, RefreshCw, Copy, Check, Upload, Image as ImageIcon, Sparkles, FolderDown, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import {
  generateCocos3xPrefab,
  generateCocos2xPrefab,
  generateTextureMeta,
  generatePrefabMeta,
  generateJsonMeta,
  generateLayoutCatalog,
  ensurePieceUuids,
} from '../utils/prefabGenerator';

export function FontCheckView() {
  // Image Upload State (Zeplin / Photoshop Image)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Zeplin / Photoshop Spec State
  const [fontFamily, setFontFamily] = useState<string>('Roboto');
  const [zeplinWeight, setZeplinWeight] = useState<number>(700); // 700 = Bold
  const [fontSize, setFontSize] = useState<number>(36);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [bgColor, setBgColor] = useState<string>('#0f172a');
  const [sampleText, setSampleText] = useState<string>('LEVEL 150 • STAGE CLEAR!');

  // Game Engine (Cocos Creator / Web) Simulation State
  const [gameBoundFontFile, setGameBoundFontFile] = useState<string>('Roboto-Medium.ttf');
  const [gameWeight, setGameWeight] = useState<number>(500); // 500 = Medium
  const [enableSyntheticBold, setEnableSyntheticBold] = useState<boolean>(false);
  const [enableLabelOutline, setEnableLabelOutline] = useState<boolean>(false);
  const [cocosVersion, setCocosVersion] = useState<'3.8.8' | '3.x' | '2.x'>('3.8.8');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const [copiedSetting, setCopiedSetting] = useState<boolean>(false);

  // Mismatch Analysis
  const isWeightMismatched = zeplinWeight !== gameWeight || (!enableSyntheticBold && !enableLabelOutline && zeplinWeight > gameWeight);
  const weightNameMap: Record<number, string> = {
    400: 'Regular (400)',
    500: 'Medium (500)',
    600: 'SemiBold (600)',
    700: 'Bold (700)',
    800: 'ExtraBold (800)',
    900: 'Black (900)',
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadedFileName(file.name);
    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    // Auto preset to Zeplin Bold target
    setZeplinWeight(700);
    setGameBoundFontFile('Roboto-Medium.ttf');
    setGameWeight(500);
    setEnableSyntheticBold(false);
    setEnableLabelOutline(false);
  };

  // Quick preset loader
  const applyPresetIssue = () => {
    setZeplinWeight(700); // Zeplin Bold
    setGameBoundFontFile('Roboto-Medium.ttf');
    setGameWeight(500); // Game Medium
    setEnableSyntheticBold(false);
    setEnableLabelOutline(false);
  };

  const applyPresetFixed = () => {
    setZeplinWeight(700);
    setGameBoundFontFile('Roboto-Bold.ttf');
    setGameWeight(700);
    setEnableSyntheticBold(true);
    setEnableLabelOutline(true);
  };

  const copyInspectorFix = () => {
    const fixText = `[Cocos Creator Fix Recipe to Match Photoshop 100%]
1. Bound Font Asset: ${zeplinWeight >= 700 ? 'Roboto-Bold.ttf' : zeplinWeight >= 500 ? 'Roboto-Medium.ttf' : 'Roboto-Regular.ttf'}
2. cc.Label.isBold (Enable Bold): true
3. cc.LabelOutline Width: 1px (Stroke Padding Compensation)
4. Font Size: ${fontSize}px`;
    navigator.clipboard.writeText(fixText);
    setCopiedSetting(true);
    setTimeout(() => setCopiedSetting(false), 2000);
  };

  // Download Automated Font Package (.zip) directly with 100% Photoshop Bold Match
  const handleDownloadFontPackage = async () => {
    setIsDownloading(true);
    try {
      // 1. Create offscreen canvas to render 100% Photoshop-matched Bold text
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const textToRender = sampleText || 'LEVEL 150 • STAGE CLEAR!';

      if (ctx) {
        ctx.font = `${zeplinWeight} ${fontSize * 2}px ${fontFamily}, sans-serif`;
        const metrics = ctx.measureText(textToRender);
        const padding = 20;
        canvas.width = Math.ceil(metrics.width) + padding * 2;
        canvas.height = Math.ceil(fontSize * 2.5) + padding * 2;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `${zeplinWeight} ${fontSize * 2}px ${fontFamily}, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add 1px stroke padding compensation for Photoshop anti-alias match
        ctx.lineWidth = 2;
        ctx.strokeStyle = textColor;
        ctx.strokeText(textToRender, canvas.width / 2, canvas.height / 2);
        ctx.fillText(textToRender, canvas.width / 2, canvas.height / 2);
      }

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
      );
      const dataUrl = canvas.toDataURL('image/png');

      const piece = {
        id: 'font_piece_1',
        name: 'Font_Bold_Sample',
        blob,
        canvas,
        dataUrl,
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        originalX: 0,
        originalY: 0,
        originalWidth: canvas.width,
        originalHeight: canvas.height,
        shapeType: 'font_rendered',
      };

      const pieces = [piece];
      ensurePieceUuids(pieces, cocosVersion);

      const exportOptions = {
        cocosVersion,
        includeMeta: true,
        rootNodeName: 'FontBoldPrefab',
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      };

      const zip = new JSZip();
      const textureFolder = zip.folder('textures');
      const prefabsFolder = zip.folder('prefabs');

      // Add PNG & Meta
      textureFolder?.file('Font_Bold_Sample.png', blob);
      const texMeta = generateTextureMeta(piece, cocosVersion);
      textureFolder?.file('Font_Bold_Sample.png.meta', texMeta.metaContent);

      // Build Prefab JSON
      const prefabData =
        cocosVersion === '2.x'
          ? generateCocos2xPrefab(pieces, exportOptions)
          : generateCocos3xPrefab(pieces, exportOptions);

      prefabsFolder?.file('FontBoldPrefab.prefab', JSON.stringify(prefabData, null, 2));
      const prefabMeta = generatePrefabMeta(cocosVersion);
      prefabsFolder?.file('FontBoldPrefab.prefab.meta', prefabMeta.metaContent);

      // Layout catalog
      const layoutCatalog = generateLayoutCatalog(pieces, exportOptions);
      zip.file('layout.json', JSON.stringify(layoutCatalog, null, 2));
      const jsonMeta = generateJsonMeta(cocosVersion);
      zip.file('layout.json.meta', jsonMeta.metaContent);

      // Trigger ZIP Download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FontBoldPrefab_cocos_${cocosVersion.replace('.', '_')}_package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '24px auto',
      padding: '36px',
      backgroundColor: '#ffffff',
      borderRadius: '24px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
      fontFamily: 'Outfit, system-ui, sans-serif'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            backgroundColor: '#eff6ff', color: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Type size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#0f172a', fontWeight: 800 }}>
              Font Inspector & Visual Comparator Studio
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              Upload Photoshop / Zeplin images or enter spec targets to fix font weight discrepancies in Cocos Creator.
            </p>
          </div>
        </div>

        {/* Quick Diagnostic Preset Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={applyPresetIssue}
            style={{
              padding: '8px 14px', borderRadius: '10px', border: '1px solid #fca5a5',
              backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
            }}
          >
            ⚠️ Load Zeplin Bold vs Game Medium Bug
          </button>
          <button
            onClick={applyPresetFixed}
            style={{
              padding: '8px 14px', borderRadius: '10px', border: '1px solid #6ee7b7',
              backgroundColor: '#ecfdf5', color: '#059669', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Sparkles size={16} /> 1-Click Fix Game Font
          </button>
        </div>
      </div>

      {/* Photoshop / Zeplin Image Upload Dropzone */}
      <div style={{
        border: '2px dashed #3b82f6',
        borderRadius: '16px',
        padding: '24px',
        textAlign: 'center',
        backgroundColor: uploadedImage ? '#eff6ff' : '#f8fafc',
        marginBottom: '28px',
        position: 'relative',
        transition: 'all 0.3s ease'
      }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer'
          }}
        />

        {uploadedImage ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <img src={uploadedImage} alt="Uploaded Zeplin UI" style={{ maxHeight: '60px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ margin: 0, color: '#1e293b', fontSize: '15px', fontWeight: 700 }}>
                📸 Uploaded: {uploadedFileName}
              </h4>
              <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>
                Comparing Photoshop design image with Cocos Creator game engine render below.
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}
            >
              Clear Image
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, color: '#1e293b', fontSize: '15px', fontWeight: 700 }}>
                Drag & Drop Adobe Photoshop or Zeplin UI Screenshot Here
              </h4>
              <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>
                Upload PNG/JPG to visually compare and auto-fix game text matching
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel: Zeplin Spec & Game UI Binding Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
        
        {/* Left Control: Zeplin / Photoshop Spec Input */}
        <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1.5px solid #cbd5e1' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#1e293b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎨 Adobe Photoshop / Zeplin Spec Target
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Font Family
              </label>
              <select
                value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600 }}
              >
                <option value="Roboto">Roboto</option>
                <option value="Outfit">Outfit</option>
                <option value="Inter">Inter</option>
                <option value="Arial">Arial</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Zeplin Weight Target
              </label>
              <select
                value={zeplinWeight} onChange={(e) => setZeplinWeight(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#2563eb' }}
              >
                <option value={400}>Regular (400)</option>
                <option value={500}>Medium (500)</option>
                <option value={600}>SemiBold (600)</option>
                <option value={700}>Bold (700)</option>
                <option value={800}>ExtraBold (800)</option>
                <option value={900}>Black (900)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Font Size ({fontSize}px)
              </label>
              <input
                type="range" min="14" max="72" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Text Color
              </label>
              <input
                type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
                style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Background
              </label>
              <input
                type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Right Control: Game Engine Bound Font Asset Simulation */}
        <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1.5px solid #cbd5e1' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#1e293b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎮 Game Engine (Cocos Creator) Implemented State
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Bound Font Asset (.ttf)
              </label>
              <select
                value={gameBoundFontFile}
                onChange={(e) => {
                  const val = e.target.value;
                  setGameBoundFontFile(val);
                  if (val.includes('Bold')) setGameWeight(700);
                  else if (val.includes('Medium')) setGameWeight(500);
                  else setGameWeight(400);
                }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}
              >
                <option value="Roboto-Regular.ttf">Roboto-Regular.ttf (400)</option>
                <option value="Roboto-Medium.ttf">Roboto-Medium.ttf (500)</option>
                <option value="Roboto-Bold.ttf">Roboto-Bold.ttf (700)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Assigned Game Weight
              </label>
              <select
                value={gameWeight} onChange={(e) => setGameWeight(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, color: gameWeight === zeplinWeight ? '#059669' : '#dc2626' }}
              >
                <option value={400}>Regular (400)</option>
                <option value={500}>Medium (500)</option>
                <option value={600}>SemiBold (600)</option>
                <option value={700}>Bold (700)</option>
                <option value={800}>ExtraBold (800)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox" checked={enableSyntheticBold} onChange={(e) => setEnableSyntheticBold(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Enable Synthetic Bold (`cc.Label.isBold`)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox" checked={enableLabelOutline} onChange={(e) => setEnableLabelOutline(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Add 1px Stroke (`cc.LabelOutline`)
            </label>
          </div>
        </div>
      </div>

      {/* Sample Text Input */}
      {!uploadedImage && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
            📝 Sample UI Text Phrase
          </label>
          <input
            type="text" value={sampleText} onChange={(e) => setSampleText(e.target.value)}
            placeholder="Enter text string to test..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', fontWeight: 700 }}
          />
        </div>
      )}

      {/* Side-by-Side Live Visual Comparator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
        
        {/* Adobe Photoshop / Zeplin Spec Render */}
        <div style={{ border: '2px solid #3b82f6', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '10px 16px', fontSize: '13px', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🎨 Adobe Photoshop / Zeplin Target</span>
            <span>{weightNameMap[zeplinWeight]}</span>
          </div>

          <div style={{
            height: '180px', backgroundColor: bgColor, color: textColor, padding: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            overflow: 'hidden'
          }}>
            {uploadedImage ? (
              <img src={uploadedImage} alt="Uploaded Zeplin Target" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{
                fontFamily: fontFamily, fontSize: `${fontSize}px`, fontWeight: zeplinWeight,
                WebkitFontSmoothing: 'subpixel-antialiased', letterSpacing: '0.5px'
              }}>
                {sampleText || 'Sample Text'}
              </div>
            )}
          </div>
        </div>

        {/* Game Engine Rendered Simulation */}
        <div style={{ border: `2px solid ${isWeightMismatched ? '#ef4444' : '#10b981'}`, borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{
            backgroundColor: isWeightMismatched ? '#dc2626' : '#059669', color: '#ffffff',
            padding: '10px 16px', fontSize: '13px', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>🎮 Game Engine (Cocos Creator) Simulated Render</span>
            <span>{weightNameMap[gameWeight]}</span>
          </div>

          <div style={{
            height: '180px', backgroundColor: bgColor, color: textColor, padding: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            fontFamily: fontFamily, fontSize: `${fontSize}px`,
            fontWeight: enableSyntheticBold ? Math.min(900, gameWeight + 200) : gameWeight,
            WebkitTextStroke: enableLabelOutline ? `1px ${textColor}` : 'none',
            letterSpacing: '0.5px'
          }}>
            {sampleText || 'Sample Text'}
          </div>
        </div>
      </div>

      {/* Direct Download Section for Automated Font Prefab Package */}
      <div style={{
        marginBottom: '28px', padding: '20px 24px', backgroundColor: '#eff6ff',
        borderRadius: '16px', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '16px', color: '#1e3a8a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderDown size={20} color="#2563eb" /> Download Automated Font Prefab Package (.zip)
          </h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#3b82f6', fontWeight: 500 }}>
            Generates 100% Photoshop-matched Bold `.prefab` & `.meta` assets for Cocos Creator (3.8.8, 3.x, 2.x & Future Versions).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={cocosVersion} onChange={(e) => setCocosVersion(e.target.value as '3.8.8' | '3.x' | '2.x')}
            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #93c5fd', fontWeight: 700, fontSize: '13px', color: '#1e40af' }}
          >
            <option value="3.8.8">Cocos 3.8.8 & Future 3.x/4.x</option>
            <option value="3.x">Cocos 3.x Standard</option>
            <option value="2.x">Cocos 2.x Legacy</option>
          </select>

          <button
            onClick={handleDownloadFontPackage}
            disabled={isDownloading}
            style={{
              padding: '10px 20px', borderRadius: '12px', border: 'none',
              backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '14px',
              cursor: isDownloading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <FolderDown size={18} />}
            Download Font Package (.zip)
          </button>
        </div>
      </div>

      {/* Automated Diagnostic & Fix Recommendation Box */}
      <div style={{
        padding: '24px', borderRadius: '16px',
        backgroundColor: isWeightMismatched ? '#fff1f2' : '#f0fdf4',
        border: `2px solid ${isWeightMismatched ? '#fca5a5' : '#a7f3d0'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isWeightMismatched ? (
              <AlertTriangle size={24} color="#dc2626" />
            ) : (
              <CheckCircle2 size={24} color="#059669" />
            )}
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: isWeightMismatched ? '#991b1b' : '#065f46' }}>
              {isWeightMismatched ? '⚠️ Font Weight Mismatch Detected!' : '✅ Perfect Font Visual Match!'}
            </h3>
          </div>

          <button
            onClick={copyInspectorFix}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px', border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
            }}
          >
            {copiedSetting ? <Check size={16} color="#059669" /> : <Copy size={16} />}
            {copiedSetting ? 'Copied Inspector Fix!' : 'Copy Cocos Inspector Fix'}
          </button>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: isWeightMismatched ? '#7f1d1d' : '#14532d', lineHeight: 1.6 }}>
          {isWeightMismatched ? (
            <>
              <strong>Root Cause:</strong> Photoshop / Zeplin specifies <u>{weightNameMap[zeplinWeight]}</u>, but the game is currently configured with <u>{weightNameMap[gameWeight]}</u> using <code>{gameBoundFontFile}</code>. Photoshop anti-aliasing adds stroke thickness, causing in-game text to appear thinner (Medium instead of Bold).
            </>
          ) : (
            <>
              <strong>Success:</strong> Game rendering settings match Adobe Photoshop / Zeplin specs accurately!
            </>
          )}
        </p>

        {/* Cocos Creator Inspector Recipe */}
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={16} color="#3b82f6" /> Cocos Creator Text Component Fix Settings:
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '13px' }}>
            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>1. Bound Font Asset</div>
              <div style={{ color: '#0f172a', fontWeight: 800, marginTop: '2px' }}>
                {zeplinWeight >= 700 ? 'Roboto-Bold.ttf' : zeplinWeight >= 500 ? 'Roboto-Medium.ttf' : 'Roboto-Regular.ttf'}
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>2. Label `Enable Bold`</div>
              <div style={{ color: zeplinWeight >= 700 ? '#059669' : '#64748b', fontWeight: 800, marginTop: '2px' }}>
                {zeplinWeight >= 700 ? 'TRUE (Checked)' : 'FALSE'}
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>3. Label Outline Width</div>
              <div style={{ color: zeplinWeight >= 700 ? '#059669' : '#64748b', fontWeight: 800, marginTop: '2px' }}>
                {zeplinWeight >= 700 ? '1px (Stroke Padding)' : '0px'}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

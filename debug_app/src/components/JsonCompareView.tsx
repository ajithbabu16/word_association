import React, { useState, useMemo } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, ArrowRight, GitCommit, Download } from 'lucide-react';

export function JsonCompareView({ onClose }: { onClose?: () => void }) {
  const [prevJson, setPrevJson] = useState<any>(null);
  const [currentJson, setCurrentJson] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isPrev: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (isPrev) {
          setPrevJson(json);
        } else {
          setCurrentJson(json);
        }
        setError(null);
        setShowDiff(false); // reset diff when a new file is uploaded
      } catch (err) {
        setError('Invalid JSON file. Please upload a valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const changes = useMemo(() => {
    if (!prevJson || !currentJson) return [];

    const getLevels = (data: any) => {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.levels)) return data.levels;
      return [];
    };

    const prevLevels = getLevels(prevJson);
    const currLevels = getLevels(currentJson);

    interface CategoryDiff {
      category: string;
      prevWords: string;
      currWords: string;
      status: 'Added' | 'Removed' | 'Modified' | 'Unchanged';
    }

    const diffs: {
      levelId: string;
      levelNumber: number | string;
      status: 'Added' | 'Removed' | 'Modified' | 'Unchanged';
      categories: CategoryDiff[];
    }[] = [];

    const prevMap = new Map<string, any>();
    prevLevels.forEach((l: any) => {
      const id = l.id || `${l.levelNumber}-${l.stageNumber || 1}`;
      prevMap.set(id, l);
    });

    const currMap = new Map<string, any>();
    currLevels.forEach((l: any) => {
      const id = l.id || `${l.levelNumber}-${l.stageNumber || 1}`;
      currMap.set(id, l);
    });

    const allLevelIds = Array.from(new Set([...prevMap.keys(), ...currMap.keys()]));
    allLevelIds.sort();

    allLevelIds.forEach(id => {
      const pLevel = prevMap.get(id);
      const cLevel = currMap.get(id);

      const levelNumber = pLevel?.levelNumber || cLevel?.levelNumber || '-';

      const pGroups = pLevel?.groups || [];
      const cGroups = cLevel?.groups || [];

      const pCatMap = new Map<string, any>(pGroups.map((g: any) => [g.category, g]));
      const cCatMap = new Map<string, any>(cGroups.map((g: any) => [g.category, g]));

      const allCats = Array.from(new Set([...pCatMap.keys(), ...cCatMap.keys()]));
      allCats.sort();

      const catDiffs: CategoryDiff[] = [];
      let hasModifications = false;

      allCats.forEach(cat => {
        const pGroup = pCatMap.get(cat);
        const cGroup = cCatMap.get(cat);
        const pWordsStr = pGroup ? `[${cat}:${(pGroup.words || []).join(',')}]` : '-';
        const cWordsStr = cGroup ? `[${cat}:${(cGroup.words || []).join(',')}]` : '-';
        
        let catStatus: 'Added' | 'Removed' | 'Modified' | 'Unchanged' = 'Unchanged';
        
        if (!pGroup && cGroup) {
          catStatus = 'Added';
          hasModifications = true;
        } else if (pGroup && !cGroup) {
          catStatus = 'Removed';
          hasModifications = true;
        } else if (pWordsStr !== cWordsStr) {
          catStatus = 'Modified';
          hasModifications = true;
        }

        catDiffs.push({ category: cat, prevWords: pWordsStr, currWords: cWordsStr, status: catStatus });
      });

      let levelStatus: 'Added' | 'Removed' | 'Modified' | 'Unchanged' = 'Unchanged';
      if (!pLevel && cLevel) levelStatus = 'Added';
      else if (pLevel && !cLevel) levelStatus = 'Removed';
      else if (hasModifications) levelStatus = 'Modified';

      diffs.push({ levelId: id, levelNumber, status: levelStatus, categories: catDiffs });
    });

    return diffs;
  }, [prevJson, currentJson]);

  const downloadExcel = () => {
    if (changes.length === 0) return;
    
    let htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8" />
      <style>
        table { border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
      </style>
      </head>
      <body>
      <table>
        <thead>
          <tr>
            <th style="background-color: #f1f5f9; font-weight: bold;">Level ID</th>
            <th style="background-color: #f1f5f9; font-weight: bold;">Level Number</th>
            <th style="background-color: #f1f5f9; font-weight: bold;">Changes</th>
            <th style="background-color: #f1f5f9; font-weight: bold;">Previous Build (Words)</th>
            <th style="background-color: #f1f5f9; font-weight: bold;">Current Build (Words)</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    changes.forEach(change => {
      let prevCellHtml = '';
      let currCellHtml = '';

      change.categories.forEach(c => {
        let prevStyle = '';
        if (c.status === 'Removed') prevStyle = 'color: #ef4444; text-decoration: line-through;';
        else if (c.status === 'Modified') prevStyle = 'color: #ef4444;';
        
        let currStyle = '';
        if (c.status === 'Added') currStyle = 'color: #10b981;';
        else if (c.status === 'Modified') currStyle = 'color: #10b981;';
        
        prevCellHtml += `<div style="${prevStyle}">${c.prevWords}</div>`;
        currCellHtml += `<div style="${currStyle}">${c.currWords}</div>`;
      });

      htmlContent += `
        <tr>
          <td>${change.levelId}</td>
          <td>${change.levelNumber}</td>
          <td>${change.status}</td>
          <td>${prevCellHtml}</td>
          <td>${currCellHtml}</td>
        </tr>
      `;
    });
    
    htmlContent += `
        </tbody>
      </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "json_comparison.xls");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderDiff = () => {
    if (!prevJson || !currentJson) return null;

    if (changes.length === 0) {
      return (
        <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#0f172a', borderRadius: '16px', textAlign: 'center', border: '1px solid #334155' }}>
          <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px', margin: '0 auto' }} />
          <h2 style={{ color: '#fff' }}>No differences found!</h2>
          <p style={{ color: '#94a3b8' }}>The previous and current builds are identical.</p>
        </div>
      );
    }

    return (
      <div style={{ marginTop: '32px', backgroundColor: '#0f172a', borderRadius: '16px', overflow: 'hidden', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GitCommit size={24} color="#3b82f6" />
            <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>Structured Level Comparison</h2>
          </div>
          <button 
            onClick={downloadExcel}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', 
              border: 'none', borderRadius: '8px', cursor: 'pointer', 
              fontWeight: 600, fontSize: '14px', transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            <Download size={16} /> Download Excel
          </button>
        </div>
        
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
            <thead style={{ backgroundColor: '#0f172a', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '2px solid #334155', color: '#94a3b8', whiteSpace: 'nowrap' }}>Level ID</th>
                <th style={{ padding: '16px', borderBottom: '2px solid #334155', color: '#94a3b8', whiteSpace: 'nowrap' }}>Level Number</th>
                <th style={{ padding: '16px', borderBottom: '2px solid #334155', color: '#94a3b8', whiteSpace: 'nowrap' }}>Changes</th>
                <th style={{ padding: '16px', borderBottom: '2px solid #334155', color: '#94a3b8' }}>Previous Build (Words)</th>
                <th style={{ padding: '16px', borderBottom: '2px solid #334155', color: '#94a3b8' }}>Current Build (Words)</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change, idx) => {
                let bgColor = 'transparent';
                let statusColor = '#e2e8f0';
                
                if (change.status === 'Added') {
                  bgColor = 'rgba(16, 185, 129, 0.1)';
                  statusColor = '#10b981';
                } else if (change.status === 'Removed') {
                  bgColor = 'rgba(239, 68, 68, 0.1)';
                  statusColor = '#ef4444';
                } else if (change.status === 'Modified') {
                  bgColor = 'rgba(245, 158, 11, 0.1)';
                  statusColor = '#f59e0b';
                }

                return (
                  <tr key={idx} style={{ backgroundColor: bgColor, borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '16px', borderRight: '1px solid #1e293b', fontWeight: 600, color: '#e2e8f0' }}>{change.levelId}</td>
                    <td style={{ padding: '16px', borderRight: '1px solid #1e293b', fontWeight: 600, color: '#e2e8f0' }}>{change.levelNumber}</td>
                    <td style={{ padding: '16px', borderRight: '1px solid #1e293b', color: statusColor, fontWeight: 700 }}>{change.status}</td>
                    <td style={{ padding: '16px', borderRight: '1px solid #1e293b', wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {change.categories.map((cat, i) => (
                          <div key={i} style={{ 
                            color: cat.status === 'Removed' || cat.status === 'Modified' ? '#ef4444' : '#94a3b8',
                            textDecoration: cat.status === 'Removed' ? 'line-through' : 'none',
                            backgroundColor: cat.status === 'Modified' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            padding: '4px', borderRadius: '4px'
                          }}>
                            {cat.prevWords}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '16px', wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {change.categories.map((cat, i) => (
                          <div key={i} style={{ 
                            color: cat.status === 'Added' || cat.status === 'Modified' ? '#10b981' : '#94a3b8',
                            backgroundColor: cat.status === 'Modified' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            padding: '4px', borderRadius: '4px'
                          }}>
                            {cat.currWords}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', width: '100%', maxWidth: '100%', margin: '0', boxSizing: 'border-box', color: '#fff' }}>
      {onClose && (
        <button onClick={onClose} style={{ marginBottom: '20px', padding: '10px 20px', borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
          Back to Mode Selection
        </button>
      )}
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', marginBottom: '12px', fontWeight: 800, background: 'linear-gradient(135deg, #fff, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          JSON Visual Comparison
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>Upload previous and current JSON files of Word Association puzzles for side-by-side comparison.</p>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 500 }}>
          <AlertTriangle size={24} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Previous JSON Box */}
        <div style={{ flex: '1 1 350px', backgroundColor: '#1e293b', padding: '32px', borderRadius: '20px', border: `2px solid ${prevJson ? '#10b981' : '#334155'}`, transition: 'all 0.3s', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: prevJson ? '#10b981' : '#fff' }}>
            Previous JSON {prevJson && <CheckCircle size={24} color="#10b981" />}
          </h2>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', border: '2px dashed #475569', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: '#0f172a' }}>
            <UploadCloud size={48} color={prevJson ? '#10b981' : "#94a3b8"} style={{ marginBottom: '16px' }} />
            <span style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 500 }}>Click to upload previous JSON</span>
            <input type="file" accept=".json" onChange={(e) => handleFileUpload(e, true)} style={{ display: 'none' }} />
          </label>
          {prevJson && (
            <div style={{ marginTop: '20px', fontSize: '14px', color: '#10b981', textAlign: 'center', fontWeight: 500, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px' }}>
              Successfully loaded {Array.isArray(prevJson) ? prevJson.length : Object.keys(prevJson).length} root items.
            </div>
          )}
        </div>

        {/* Current JSON Box */}
        <div style={{ flex: '1 1 350px', backgroundColor: '#1e293b', padding: '32px', borderRadius: '20px', border: `2px solid ${currentJson ? '#10b981' : '#334155'}`, transition: 'all 0.3s', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: currentJson ? '#10b981' : '#fff' }}>
            Current JSON {currentJson && <CheckCircle size={24} color="#10b981" />}
          </h2>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', border: '2px dashed #475569', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: '#0f172a' }}>
            <UploadCloud size={48} color={currentJson ? '#10b981' : "#94a3b8"} style={{ marginBottom: '16px' }} />
            <span style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 500 }}>Click to upload current JSON</span>
            <input type="file" accept=".json" onChange={(e) => handleFileUpload(e, false)} style={{ display: 'none' }} />
          </label>
          {currentJson && (
            <div style={{ marginTop: '20px', fontSize: '14px', color: '#10b981', textAlign: 'center', fontWeight: 500, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px' }}>
              Successfully loaded {Array.isArray(currentJson) ? currentJson.length : Object.keys(currentJson).length} root items.
            </div>
          )}
        </div>
      </div>
      
      {prevJson && currentJson && !showDiff && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
          <button 
            onClick={() => setShowDiff(true)}
            style={{ 
              padding: '16px 32px', 
              borderRadius: '16px', 
              border: 'none', 
              backgroundColor: '#3b82f6', 
              color: '#fff', 
              cursor: 'pointer', 
              fontSize: '18px',
              fontWeight: 700,
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Compare Files <ArrowRight size={20} />
          </button>
        </div>
      )}

      {showDiff && renderDiff()}
    </div>
  );
}

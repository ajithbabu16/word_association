import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, ArrowRight, GitCommit } from 'lucide-react';

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

  const renderDiff = () => {
    if (!prevJson || !currentJson) return null;

    // Normalize input to arrays of levels
    const getLevels = (data: any) => {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.levels)) return data.levels;
      return [];
    };

    const prevLevels = getLevels(prevJson);
    const currLevels = getLevels(currentJson);

    const changes: {
      levelId: string;
      category: string;
      prevWords: string;
      currWords: string;
      status: 'Added' | 'Removed' | 'Modified' | 'Unchanged';
    }[] = [];

    // Map by level ID
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

    // Compare
    const allLevelIds = Array.from(new Set([...prevMap.keys(), ...currMap.keys()]));
    allLevelIds.sort();

    allLevelIds.forEach(id => {
      const pLevel = prevMap.get(id);
      const cLevel = currMap.get(id);

      const pGroups = pLevel?.groups || [];
      const cGroups = cLevel?.groups || [];

      const pCatMap = new Map<string, any>(pGroups.map((g: any) => [g.category, g]));
      const cCatMap = new Map<string, any>(cGroups.map((g: any) => [g.category, g]));

      const allCats = Array.from(new Set([...pCatMap.keys(), ...cCatMap.keys()]));
      allCats.sort();

      allCats.forEach((cat: string) => {
        const pGroup = pCatMap.get(cat);
        const cGroup = cCatMap.get(cat);

        const pWords = pGroup ? (pGroup.words || []).join(', ') : '';
        const cWords = cGroup ? (cGroup.words || []).join(', ') : '';

        if (!pGroup && cGroup) {
          changes.push({ levelId: id, category: cat, prevWords: '-', currWords: cWords, status: 'Added' });
        } else if (pGroup && !cGroup) {
          changes.push({ levelId: id, category: cat, prevWords: pWords, currWords: '-', status: 'Removed' });
        } else if (pWords !== cWords) {
          changes.push({ levelId: id, category: cat, prevWords: pWords, currWords: cWords, status: 'Modified' });
        }
        // Optionally omit 'Unchanged' to only show diffs
      });
    });

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
        <div style={{ backgroundColor: '#1e293b', padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GitCommit size={24} color="#3b82f6" />
          <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>Structured Level Comparison</h2>
        </div>
        
        <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead style={{ backgroundColor: '#0f172a', position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '2px solid #334155', color: '#94a3b8', whiteSpace: 'nowrap' }}>Level ID</th>
                <th style={{ padding: '16px', borderBottom: '2px solid #334155', color: '#94a3b8', whiteSpace: 'nowrap' }}>Category Name</th>
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
                    <td style={{ padding: '16px', borderRight: '1px solid #1e293b', fontWeight: 600, color: '#e2e8f0' }}>{change.category}</td>
                    <td style={{ padding: '16px', borderRight: '1px solid #1e293b', color: statusColor, fontWeight: 700 }}>{change.status}</td>
                    <td style={{ padding: '16px', borderRight: '1px solid #1e293b', color: change.status === 'Removed' ? '#ef4444' : '#94a3b8', textDecoration: change.status === 'Removed' ? 'line-through' : 'none' }}>
                      {change.prevWords}
                    </td>
                    <td style={{ padding: '16px', color: change.status === 'Added' ? '#10b981' : change.status === 'Modified' ? '#10b981' : '#e2e8f0' }}>
                      {change.currWords}
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
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', color: '#fff' }}>
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

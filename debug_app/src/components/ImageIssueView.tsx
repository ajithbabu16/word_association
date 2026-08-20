import React, { useMemo, useState, useEffect } from 'react';
import { X, Download, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react';
import type { PuzzleRawLevel } from '../engine/PuzzleModels';
import * as XLSX from 'xlsx';

interface ImageIssueViewProps {
  levelData: PuzzleRawLevel[];
  activeMode?: 'daily' | 'main' | 'prefab' | 'special';
  onClose: () => void;
}

interface LevelImageValidation {
  levelNumber: number;
  totalPicturesCount: number;
  missingCategories: Array<{
    category: string;
    expectedCandidates: string[];
  }>;
}

const toTitle = (s: string) =>
  s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function ImageIssueView({ levelData, activeMode, onClose }: ImageIssueViewProps) {
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [showOnlyMissing, setShowOnlyMissing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Load existing images manifest on mount
  useEffect(() => {
    fetch('/existing_images.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load image manifest');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setExistingImages(data);
        }
      })
      .catch(err => {
        console.error('[ImageIssueView] Error fetching existing_images.json:', err);
      });
  }, []);

  // Build validation result
  const validatedLevels = useMemo<LevelImageValidation[]>(() => {
    const lowercaseExisting = new Set(existingImages.map(img => img.toLowerCase()));

    return levelData.map(level => {
      const missingCategories: Array<{ category: string; expectedCandidates: string[] }> = [];
      let pictureGroupsCount = 0;

      if (level.groups) {
        level.groups.forEach(group => {
          if (group.picture === true) {
            pictureGroupsCount++;
            const c = (group.category || '').trim();
            if (c) {
              const candidate1 = `${toTitle(c)}.png`;
              const candidate2 = `${c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}.png`;
              const candidate3 = `${c.toLowerCase()}.png`;
              const candidate4 = `${c}.png`;

              // Unique-fy candidate list
              const uniqueCandidates = [...new Set([candidate1, candidate2, candidate3, candidate4])];

              const hasImg = uniqueCandidates.some(cand => lowercaseExisting.has(cand.toLowerCase()));

              if (!hasImg) {
                missingCategories.push({
                  category: c,
                  expectedCandidates: uniqueCandidates,
                });
              }
            }
          }
        });
      }

      return {
        levelNumber: level.levelNumber || level.id || 0,
        totalPicturesCount: pictureGroupsCount,
        missingCategories,
      };
    }).sort((a, b) => a.levelNumber - b.levelNumber);
  }, [levelData, existingImages]);

  // Filter levels based on search and showOnlyMissing toggle
  const filteredLevels = useMemo(() => {
    return validatedLevels.filter(lvl => {
      const matchesSearch = lvl.levelNumber.toString().includes(searchTerm) ||
                            lvl.missingCategories.some(m => m.category.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesMissing = showOnlyMissing ? lvl.missingCategories.length > 0 : true;
      return matchesSearch && matchesMissing;
    });
  }, [validatedLevels, searchTerm, showOnlyMissing]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalWithImages = validatedLevels.filter(l => l.totalPicturesCount > 0).length;
    const totalMissingLevels = validatedLevels.filter(l => l.missingCategories.length > 0).length;
    const totalMissingImages = validatedLevels.reduce((sum, l) => sum + l.missingCategories.length, 0);

    return {
      totalWithImages,
      totalMissingLevels,
      totalMissingImages,
      totalImagesFound: existingImages.length
    };
  }, [validatedLevels, existingImages]);

  const handleDownloadExcel = () => {
    const sheetData = validatedLevels
      .filter(l => l.missingCategories.length > 0)
      .map(lvl => ({
        'Level Number': lvl.levelNumber,
        'Total Picture Categories': lvl.totalPicturesCount,
        'Missing Image Categories': lvl.missingCategories.map(m => m.category).join(', '),
        'Expected Filename Candidates': lvl.missingCategories.map(m => m.expectedCandidates[0]).join(', '),
      }));

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const colWidths = [
      { wch: 15 }, // Level Number
      { wch: 25 }, // Total Picture Categories
      { wch: 40 }, // Missing Image Categories
      { wch: 60 }, // Expected Filename Candidates
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Missing Images');
    XLSX.writeFile(workbook, 'missing_level_images.xlsx');
  };

  return (
    <div className="live-view-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#f8fafc', zIndex: 1000, overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>
      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>
            🖼️ Image Resource validator
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Scanning levels in <code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{activeMode === 'special' ? 'special_levels.json' : 'main.json'}</code> and verifying corresponding asset files in <code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>puzzle_image/</code> folder.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleDownloadExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold' }}
          >
            <Download size={18} /> Export Excel
          </button>
          <button className="button danger" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            <X size={18} /> Close
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Levels Evaluated</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>{validatedLevels.length}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Missing Image Levels</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>{stats.totalMissingLevels}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Missing Images</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{stats.totalMissingImages}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assets Found in Folder</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{stats.totalImagesFound}</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search Level Number or Category name..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#475569' }}>
            <input 
              type="checkbox" 
              checked={showOnlyMissing} 
              onChange={e => setShowOnlyMissing(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Show only levels with missing images
          </label>
        </div>
      </div>

      {/* Main Validation Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <thead style={{ backgroundColor: '#f1f5f9' }}>
          <tr>
            <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px', width: '120px' }}>Level</th>
            <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px', width: '120px' }}>Pics Target</th>
            <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px', width: '180px' }}>Status</th>
            <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px' }}>Missing Categories & Filenames Checked</th>
          </tr>
        </thead>
        <tbody>
          {filteredLevels.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '15px' }}>
                🎉 No level matches the filter criteria. All checked images are present!
              </td>
            </tr>
          ) : (
            filteredLevels.map((lvl, index) => {
              const isMissing = lvl.missingCategories.length > 0;
              return (
                <tr key={index} style={{ borderBottom: '1px solid #eee', backgroundColor: isMissing ? '#fff0f0' : 'white' }}>
                  <td style={{ padding: '12px', fontWeight: 800, color: '#7c3aed' }}>Level {lvl.levelNumber}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#475569' }}>{lvl.totalPicturesCount} images</td>
                  <td style={{ padding: '12px' }}>
                    {isMissing ? (
                      <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}><XCircle size={16} /> {lvl.missingCategories.length} Missing</span>
                    ) : (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}><CheckCircle size={16} /> All Ok</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>
                    {isMissing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {lvl.missingCategories.map((m, idx) => (
                          <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                              {m.category}
                            </span>
                            <span style={{ color: '#64748b' }}>expected any of:</span>
                            {m.expectedCandidates.map((c, cIdx) => (
                              <code key={cIdx} style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', color: '#0f172a' }}>
                                {c}
                              </code>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>
                        {lvl.totalPicturesCount === 0 
                          ? 'No picture categories required for this level.' 
                          : 'All picture category files found inside the assets folder.'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

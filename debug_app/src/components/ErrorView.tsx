import React, { useMemo } from 'react';
import { X, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { PuzzleRawLevel } from '../engine/PuzzleModels';
import { PuzzleValidator } from '../engine/PuzzleValidator';
import type { ValidationResult } from '../engine/PuzzleValidator';
import * as XLSX from 'xlsx';

interface ErrorViewProps {
  activeMode?: 'daily' | 'main' | 'prefab' | 'special';
  levelData: PuzzleRawLevel[];
  mainLevelData?: PuzzleRawLevel[];
  onClose: () => void;
}

interface ValidatedLevel {
  levelNumber: number;
  stageNumber?: number;
  result: ValidationResult;
}

export function ErrorView({
  activeMode = 'daily',
  levelData,
  mainLevelData = [],
  onClose
}: ErrorViewProps) {
  
  const isMain = activeMode === 'main' || activeMode === 'special';
  const isSpecial = activeMode === 'special';
  const targetData = isMain ? (mainLevelData.length > 0 ? mainLevelData : levelData) : levelData;

  const validatedData = useMemo<ValidatedLevel[]>(() => {
    const internalDict = PuzzleValidator.buildInternalDictionary(targetData);
    return targetData.map(level => {
      const result = isMain 
        ? PuzzleValidator.validateMainPuzzleLevel(level, internalDict)
        : PuzzleValidator.validateStage(level, internalDict);

      return {
        levelNumber: level.levelNumber || level.id || 0,
        stageNumber: level.stageNumber,
        result
      };
    }).sort((a, b) => {
      if (a.levelNumber === b.levelNumber && a.stageNumber !== undefined && b.stageNumber !== undefined) {
        return a.stageNumber - b.stageNumber;
      }
      return a.levelNumber - b.levelNumber;
    });
  }, [targetData, isMain]);

  const handleDownloadExcel = () => {
    const sheetData = validatedData.map(v => ({
      'Level': v.levelNumber,
      'Stage': v.stageNumber !== undefined ? v.stageNumber : 'N/A (Main)',
      'Status': v.result.status === 'OK' ? '✅ Passed' : v.result.status === 'ERRORS' ? '❌ Errors' : '⚠️ Warnings',
      'Errors': v.result.errors.join('\n'),
      'Warnings': v.result.warnings.join('\n'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheetData);

    const colWidths = [
      { wch: 10 },  // Level
      { wch: 12 },  // Stage
      { wch: 14 },  // Status
      { wch: 80 },  // Errors
      { wch: 80 },  // Warnings
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    const sheetName = isSpecial ? 'Special Puzzle Errors' : isMain ? 'Main Puzzle Errors' : 'Daily Puzzle Errors';
    const fileName = isSpecial ? 'special_puzzle_errors.xlsx' : isMain ? 'main_puzzle_errors.xlsx' : 'daily_puzzle_errors.xlsx';

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="live-view-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#f8fafc', zIndex: 1000, overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>
            {isSpecial ? 'Special' : isMain ? 'Main' : 'Daily'} Puzzle Error Validation {isMain ? '(12 Categories / Level)' : ''}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            {isMain ? `Validating 12 categories, 48 words, duplicates, stem forms & format errors in ${isSpecial ? 'special_levels.json' : 'main.json'}` : 'Validating 3 stages/day formatting, duplicates & stem variations'}
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

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <thead style={{ backgroundColor: '#f1f5f9' }}>
          <tr>
            <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px', width: '100px' }}>Level</th>
            {!isMain && <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px', width: '80px' }}>Stage</th>}
            <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px', width: '130px' }}>Status</th>
            <th style={{ borderBottom: '2px solid #cbd5e1', padding: '12px' }}>Messages & Validation Details</th>
          </tr>
        </thead>
        <tbody>
          {validatedData.map((data, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee', backgroundColor: data.result.status === 'ERRORS' ? '#fff0f0' : data.result.status === 'WARNINGS' ? '#fffbea' : 'white' }}>
              <td style={{ padding: '12px', fontWeight: 800, color: isSpecial ? '#db2777' : isMain ? '#7c3aed' : '#1e293b' }}>Level {data.levelNumber}</td>
              {!isMain && <td style={{ padding: '12px' }}>{data.stageNumber}</td>}
              <td style={{ padding: '12px' }}>
                {data.result.status === 'OK' && <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}><CheckCircle size={16} /> Passed</span>}
                {data.result.status === 'ERRORS' && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}><XCircle size={16} /> Errors</span>}
                {data.result.status === 'WARNINGS' && <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}><AlertTriangle size={16} /> Warnings</span>}
              </td>
              <td style={{ padding: '12px', fontSize: '13px' }}>
                {data.result.status === 'OK' ? (
                  <span style={{ color: '#64748b' }}>All checks passed (12 categories, 48 words, no duplicates/stem errors).</span>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#333' }}>
                    {data.result.errors.map((err, idx) => <li key={`e-${idx}`} style={{ color: '#ef4444', marginBottom: '4px' }}>❌ {err}</li>)}
                    {data.result.warnings.map((warn, idx) => <li key={`w-${idx}`} style={{ color: '#f59e0b', marginBottom: '4px' }}>⚠️ {warn}</li>)}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

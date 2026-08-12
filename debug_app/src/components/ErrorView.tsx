import React, { useMemo } from 'react';
import { X, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { PuzzleRawLevel } from '../engine/PuzzleModels';
import { PuzzleValidator } from '../engine/PuzzleValidator';
import type { ValidationResult } from '../engine/PuzzleValidator';
import * as XLSX from 'xlsx';

interface ErrorViewProps {
  levelData: PuzzleRawLevel[];
  onClose: () => void;
}

interface ValidatedLevel {
  levelNumber: number;
  stageNumber: number;
  result: ValidationResult;
}

export function ErrorView({ levelData, onClose }: ErrorViewProps) {
  
  const validatedData = useMemo<ValidatedLevel[]>(() => {
    // Build dictionary from the game's own words for missing-space detection
    const internalDict = PuzzleValidator.buildInternalDictionary(levelData);
    return levelData.map(level => {
      const result = PuzzleValidator.validateStage(level, internalDict);
      return {
        levelNumber: level.levelNumber || 0,
        stageNumber: level.stageNumber || 0,
        result
      };
    }).sort((a, b) => {
      if (a.levelNumber === b.levelNumber) return a.stageNumber - b.stageNumber;
      return a.levelNumber - b.levelNumber;
    });
  }, [levelData]);

  const handleDownloadExcel = () => {
    // Build rows for the Excel sheet
    const sheetData = validatedData.map(v => ({
      'Level': v.levelNumber,
      'Stage': v.stageNumber,
      'Status': v.result.status === 'OK' ? '✅ Passed' : v.result.status === 'ERRORS' ? '❌ Errors' : '⚠️ Warnings',
      'Errors': v.result.errors.join('\n'),
      'Warnings': v.result.warnings.join('\n'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheetData);

    // Auto-size columns
    const colWidths = [
      { wch: 8 },   // Level
      { wch: 8 },   // Stage
      { wch: 14 },  // Status
      { wch: 80 },  // Errors
      { wch: 80 },  // Warnings
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Puzzle Errors');
    XLSX.writeFile(workbook, 'puzzle_errors.xlsx');
  };

  return (
    <div className="live-view-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#f3f4f6', zIndex: 1000, overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Puzzle Error Validation</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleDownloadExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold' }}
          >
            <Download size={18} /> Export Excel
          </button>
          <button className="button danger" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <X size={18} /> Close
          </button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <thead style={{ backgroundColor: '#f4f4f4' }}>
          <tr>
            <th style={{ borderBottom: '2px solid #ddd', padding: '12px', width: '80px' }}>Level</th>
            <th style={{ borderBottom: '2px solid #ddd', padding: '12px', width: '80px' }}>Stage</th>
            <th style={{ borderBottom: '2px solid #ddd', padding: '12px', width: '120px' }}>Status</th>
            <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Messages</th>
          </tr>
        </thead>
        <tbody>
          {validatedData.map((data, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee', backgroundColor: data.result.status === 'ERRORS' ? '#fff0f0' : data.result.status === 'WARNINGS' ? '#fffbea' : 'white' }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>{data.levelNumber}</td>
              <td style={{ padding: '12px' }}>{data.stageNumber}</td>
              <td style={{ padding: '12px' }}>
                {data.result.status === 'OK' && <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={16} /> Passed</span>}
                {data.result.status === 'ERRORS' && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={16} /> Errors</span>}
                {data.result.status === 'WARNINGS' && <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={16} /> Warnings</span>}
              </td>
              <td style={{ padding: '12px', fontSize: '13px' }}>
                {data.result.status === 'OK' ? (
                  <span style={{ color: '#666' }}>All checks passed.</span>
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

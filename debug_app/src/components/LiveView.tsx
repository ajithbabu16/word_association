import React, { useState } from 'react';
import { Eye, X, Download, FileText, FileSpreadsheet, Clock } from 'lucide-react';
import { 
  exportCSV, 
  exportExcel, 
  exportPDF, 
  formatDuration, 
  getTotalMoves, 
  getTotalTimeSec 
} from '../utils/exportUtils';

export interface StageRecord {
  passed: boolean;
  startScreenshot: string | null;
  screenshot: string | null; // completion screenshot
  moves?: number | null;
  startTime?: string | null;
  completionTime?: string | null;
  durationSec?: number | null;
  error?: string | null;
}

export interface TrackingData {
  date: string;
  levelNumber: number;
  stage1: StageRecord;
  stage2: StageRecord;
  stage3: StageRecord;
}

interface LiveViewProps {
  trackingHistory: TrackingData[];
  onClose: () => void;
}

export function LiveView({ trackingHistory, onClose }: LiveViewProps) {
  const [fullscreenModal, setFullscreenModal] = useState<{ title: string; url: string } | null>(null);

  const handleDownloadCSV = () => exportCSV(trackingHistory);
  const handleDownloadExcel = () => exportExcel(trackingHistory);
  const handleDownloadPDF = () => exportPDF(trackingHistory);

  const renderStageCell = (stage: StageRecord, stageNum: number, levelNumber: number, date: string) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        {stage.error ? (
          <span style={{ fontWeight: '600', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            ❌ Error: {stage.error}
          </span>
        ) : (
          <span style={{ fontWeight: '600', color: stage.passed ? '#059669' : '#d97706' }}>
            {stage.passed ? '✅ Passed' : '❌ Pending'}
          </span>
        )}

        {stage.passed && stage.moves !== undefined && stage.moves !== null && (
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            color: '#2563eb', 
            backgroundColor: '#eff6ff', 
            padding: '2px 8px', 
            borderRadius: '6px', 
            border: '1px solid #bfdbfe' 
          }}>
            Moves: {stage.moves}
          </span>
        )}

        {(stage.startTime || stage.completionTime || stage.durationSec !== undefined) && (
          <div style={{ 
            fontSize: '11px', 
            color: '#374151', 
            backgroundColor: '#f3f4f6', 
            padding: '4px 8px', 
            borderRadius: '6px', 
            border: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: '#059669' }}>
              <Clock size={12} /> Time: {formatDuration(stage.durationSec)}
            </div>
            {stage.startTime && stage.completionTime && (
              <div style={{ fontSize: '10px', color: '#6b7280' }}>
                {stage.startTime} ➔ {stage.completionTime}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          {stage.startScreenshot && (
            <button 
              onClick={() => setFullscreenModal({ title: `Level ${levelNumber} • Stage ${stageNum} (Start View)`, url: stage.startScreenshot! })}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                cursor: 'pointer', 
                padding: '4px 8px', 
                borderRadius: '6px', 
                border: 'none', 
                backgroundColor: '#4b5563', 
                color: 'white', 
                fontSize: '11px', 
                fontWeight: '600' 
              }}
            >
              <Eye size={13} /> Start View
            </button>
          )}

          {stage.screenshot && (
            <button 
              onClick={() => setFullscreenModal({ title: `Level ${levelNumber} • Stage ${stageNum} (Finish View)`, url: stage.screenshot! })}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                cursor: 'pointer', 
                padding: '4px 8px', 
                borderRadius: '6px', 
                border: 'none', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                fontSize: '11px', 
                fontWeight: '600' 
              }}
            >
              <Eye size={13} /> Finish View
            </button>
          )}
        </div>
        <span style={{ fontSize: '11px', color: '#888' }}>Lvl {levelNumber} • {date}</span>
      </div>
    );
  };

  return (
    <div className="live-view-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#f3f4f6', zIndex: 1000, overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#111' }}>Live Tracking View</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleDownloadCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
          >
            <Download size={18} /> Export CSV
          </button>
          <button 
            onClick={handleDownloadExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#059669', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
          >
            <FileSpreadsheet size={18} /> Export Excel
          </button>
          <button 
            onClick={handleDownloadPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
          >
            <FileText size={18} /> Export PDF
          </button>
          <button 
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
          >
            <X size={18} /> Close
          </button>
        </div>
      </div>

      {trackingHistory.length === 0 ? (
        <p>No completions tracked yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <thead style={{ backgroundColor: '#f4f4f4' }}>
            <tr>
              <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Date</th>
              <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Level</th>
              <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Stage 1</th>
              <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Stage 2</th>
              <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Stage 3</th>
              <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Total Moves</th>
              <th style={{ borderBottom: '2px solid #ddd', padding: '12px' }}>Total Daily Time</th>
            </tr>
          </thead>
          <tbody>
            {trackingHistory.map((track, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{track.date}</td>
                <td style={{ padding: '12px' }}>Level {track.levelNumber}</td>
                <td style={{ padding: '12px' }}>
                  {renderStageCell(track.stage1, 1, track.levelNumber, track.date)}
                </td>
                <td style={{ padding: '12px' }}>
                  {renderStageCell(track.stage2, 2, track.levelNumber, track.date)}
                </td>
                <td style={{ padding: '12px' }}>
                  {renderStageCell(track.stage3, 3, track.levelNumber, track.date)}
                </td>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>
                  {getTotalMoves(track)}
                </td>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#059669' }}>
                  {formatDuration(getTotalTimeSec(track))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {fullscreenModal && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
          onClick={() => setFullscreenModal(null)}
        >
          <div style={{ position: 'absolute', top: '20px', left: '30px', color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
            {fullscreenModal.title}
          </div>
          <button 
            style={{ position: 'absolute', top: '20px', right: '30px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}
            onClick={() => setFullscreenModal(null)}
          >
            <X size={32} /> Close
          </button>
          <img src={fullscreenModal.url} style={{ maxWidth: '90%', maxHeight: '85%', borderRadius: '12px', border: '4px solid white', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}

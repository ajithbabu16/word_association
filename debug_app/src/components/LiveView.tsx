import React, { useState } from 'react';
import { Eye, X, Download, FileText, FileSpreadsheet, Clock, Image as ImageIcon } from 'lucide-react';
import { 
  exportCSV, 
  exportExcel, 
  exportPDF, 
  exportMainExcel,
  exportMainPDF,
  formatDuration, 
  getTotalMoves, 
  getTotalTimeSec,
  MainTrackingData
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
  activeMode?: 'daily' | 'main';
  trackingHistory: TrackingData[];
  mainTrackingHistory?: MainTrackingData[];
  onClose: () => void;
}

export function LiveView({
  activeMode = 'daily',
  trackingHistory,
  mainTrackingHistory = [],
  onClose
}: LiveViewProps) {
  const [fullscreenModal, setFullscreenModal] = useState<{ title: string; url: string } | null>(null);

  const handleDownloadCSV = () => exportCSV(trackingHistory);
  const handleDownloadExcel = () => {
    if (activeMode === 'main') {
      exportMainExcel(mainTrackingHistory);
    } else {
      exportExcel(trackingHistory);
    }
  };
  const handleDownloadPDF = () => {
    if (activeMode === 'main') {
      exportMainPDF(mainTrackingHistory);
    } else {
      exportPDF(trackingHistory);
    }
  };

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

  if (activeMode === 'main') {
    return (
      <div className="live-view-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#f8fafc', zIndex: 1000, overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>
              Main Puzzle Live Tracking Table
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              Per-level image formation tracking and visual report exports
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleDownloadExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
            >
              <FileSpreadsheet size={18} /> Export Excel (.xlsx)
            </button>
            <button 
              onClick={handleDownloadPDF}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
            >
              <FileText size={18} /> Export PDF (.pdf)
            </button>
            <button 
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', fontSize: '14px' }}
            >
              <X size={18} /> Close
            </button>
          </div>
        </div>

        {mainTrackingHistory.length === 0 ? (
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>No Main Puzzle levels played or tracked yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <thead style={{ backgroundColor: '#f1f5f9' }}>
              <tr>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '14px', fontSize: '13px', color: '#334155' }}>Level Number</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '14px', fontSize: '13px', color: '#334155' }}>Images Formed Count</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '14px', fontSize: '13px', color: '#334155' }}>Total Moves</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '14px', fontSize: '13px', color: '#334155' }}>Status</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '14px', fontSize: '13px', color: '#334155' }}>Start / Completion Time</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '14px', fontSize: '13px', color: '#334155' }}>Duration</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '14px', fontSize: '13px', color: '#334155' }}>Screenshots & Formations</th>
              </tr>
            </thead>
            <tbody>
              {mainTrackingHistory.map((track, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px', fontWeight: 800, color: '#7c3aed', fontSize: '15px' }}>
                    Level {track.levelNumber}
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                      {track.imagesFormedCount} / {track.totalCategories}
                    </span>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#1e293b' }}>
                    {track.totalMoves} moves
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700 }}>
                    <span style={{ color: track.status === 'Passed' ? '#059669' : track.status.includes('Failed') ? '#ef4444' : '#d97706' }}>
                      {track.status === 'Passed' ? '✅ Passed' : track.status.includes('Failed') ? '❌ Failed' : '⏳ In Progress'}
                    </span>
                  </td>
                  <td style={{ padding: '14px', fontSize: '12px', color: '#475569' }}>
                    {track.startTime ? `${track.startTime} ➔ ${track.completionTime || '...'}` : '-'}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#2563eb' }}>
                    {formatDuration(track.durationSec)}
                  </td>
                  <td style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {track.initialBoardScreenshot && (
                        <button 
                          onClick={() => setFullscreenModal({ title: `Level ${track.levelNumber} • Initial Board View`, url: track.initialBoardScreenshot! })}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#475569', color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <ImageIcon size={13} /> Initial Board
                        </button>
                      )}

                      {track.imageFormationScreenshots.length > 0 && (
                        <button 
                          onClick={() => setFullscreenModal({ title: `Level ${track.levelNumber} • Image Formation Screenshot 1 (${track.imageFormationScreenshots[0].categoryName})`, url: track.imageFormationScreenshots[0].screenshot })}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <ImageIcon size={13} /> {track.imageFormationScreenshots.length} Image Formations
                        </button>
                      )}

                      {track.finalCompletionScreenshot && (
                        <button 
                          onClick={() => setFullscreenModal({ title: `Level ${track.levelNumber} • Final Completion View`, url: track.finalCompletionScreenshot! })}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#059669', color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <ImageIcon size={13} /> Completion View
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {fullscreenModal && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 2000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
            onClick={() => setFullscreenModal(null)}
          >
            <div style={{ position: 'absolute', top: '24px', left: '32px', color: 'white', fontSize: '20px', fontWeight: 800 }}>
              {fullscreenModal.title}
            </div>
            <button 
              style={{ position: 'absolute', top: '24px', right: '32px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 700 }}
              onClick={() => setFullscreenModal(null)}
            >
              <X size={28} /> Close
            </button>
            <img src={fullscreenModal.url} style={{ maxWidth: '85%', maxHeight: '80%', borderRadius: '16px', border: '4px solid white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="live-view-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#f3f4f6', zIndex: 1000, overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#111' }}>Live Tracking View (Daily Puzzle)</h2>
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

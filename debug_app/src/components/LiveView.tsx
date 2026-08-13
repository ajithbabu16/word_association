import React, { useState } from 'react';
import { Eye, X, Download, FileText, FileSpreadsheet, Clock } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

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

// Format duration seconds to human-readable string
function formatDuration(sec: number | null | undefined): string {
  if (sec === undefined || sec === null) return '-';
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
}

function getStageStatusString(stage: StageRecord): string {
  if (stage.error) return `Error: ${stage.error}`;
  return stage.passed ? 'Passed' : 'Pending';
}

// Helper to determine exact aspect ratio (height / width) of captured screenshots
function getImageAspectRatio(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > 0 && img.height > 0) {
        resolve(img.height / img.width);
      } else {
        resolve(2.0); // Default device simulator aspect ratio
      }
    };
    img.onerror = () => resolve(2.0);
    img.src = dataUrl;
  });
}

export function LiveView({ trackingHistory, onClose }: LiveViewProps) {
  const [fullscreenModal, setFullscreenModal] = useState<{ title: string; url: string } | null>(null);

  // Helper to compute total moves across stages
  const getTotalMoves = (t: TrackingData) => {
    let total = 0;
    let hasValue = false;
    [t.stage1, t.stage2, t.stage3].forEach(s => {
      if (s.moves !== undefined && s.moves !== null) {
        total += s.moves;
        hasValue = true;
      }
    });
    return hasValue ? total : '-';
  };

  // Helper to compute total completion time in seconds across stages
  const getTotalTimeSec = (t: TrackingData): number | null => {
    let total = 0;
    let hasValue = false;
    [t.stage1, t.stage2, t.stage3].forEach(s => {
      if (s.durationSec !== undefined && s.durationSec !== null) {
        total += s.durationSec;
        hasValue = true;
      }
    });
    return hasValue ? total : null;
  };

  // Export CSV - tracking data with start times, end times, durations, and total time
  const handleDownloadCSV = () => {
    const headers = [
      'Date', 
      'Level', 
      'Stage 1 Status', 
      'Stage 1 Moves',
      'Stage 1 Start Time',
      'Stage 1 End Time',
      'Stage 1 Duration',
      'Stage 2 Status', 
      'Stage 2 Moves',
      'Stage 2 Start Time',
      'Stage 2 End Time',
      'Stage 2 Duration',
      'Stage 3 Status', 
      'Stage 3 Moves',
      'Stage 3 Start Time',
      'Stage 3 End Time',
      'Stage 3 Duration',
      'Total Moves',
      'Total Daily Time'
    ];
    const rows = trackingHistory.map(t => {
      const s1Moves = t.stage1.moves ?? '-';
      const s1Start = t.stage1.startTime ?? '-';
      const s1End = t.stage1.completionTime ?? '-';
      const s1Dur = formatDuration(t.stage1.durationSec);

      const s2Moves = t.stage2.moves ?? '-';
      const s2Start = t.stage2.startTime ?? '-';
      const s2End = t.stage2.completionTime ?? '-';
      const s2Dur = formatDuration(t.stage2.durationSec);

      const s3Moves = t.stage3.moves ?? '-';
      const s3Start = t.stage3.startTime ?? '-';
      const s3End = t.stage3.completionTime ?? '-';
      const s3Dur = formatDuration(t.stage3.durationSec);

      const totalMoves = getTotalMoves(t);
      const totalTime = formatDuration(getTotalTimeSec(t));

      const s1Status = getStageStatusString(t.stage1);
      const s2Status = getStageStatusString(t.stage2);
      const s3Status = getStageStatusString(t.stage3);

      return `"${t.date}",${t.levelNumber},"${s1Status}",${s1Moves},"${s1Start}","${s1End}","${s1Dur}","${s2Status}",${s2Moves},"${s2Start}","${s2End}","${s2Dur}","${s3Status}",${s3Moves},"${s3Start}","${s3End}","${s3Dur}",${totalMoves},"${totalTime}"`;
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'live_tracking.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Excel (.xlsx) - with full stage timing breakdown
  const handleDownloadExcel = () => {
    const data = trackingHistory.map(t => {
      const totalTimeSec = getTotalTimeSec(t);

      return {
        'Date': t.date,
        'Level': `Level ${t.levelNumber}`,
        'Stage 1 Status': getStageStatusString(t.stage1),
        'Stage 1 Moves': t.stage1.moves ?? '-',
        'Stage 1 Start Time': t.stage1.startTime ?? '-',
        'Stage 1 End Time': t.stage1.completionTime ?? '-',
        'Stage 1 Duration': formatDuration(t.stage1.durationSec),
        'Stage 2 Status': getStageStatusString(t.stage2),
        'Stage 2 Moves': t.stage2.moves ?? '-',
        'Stage 2 Start Time': t.stage2.startTime ?? '-',
        'Stage 2 End Time': t.stage2.completionTime ?? '-',
        'Stage 2 Duration': formatDuration(t.stage2.durationSec),
        'Stage 3 Status': getStageStatusString(t.stage3),
        'Stage 3 Moves': t.stage3.moves ?? '-',
        'Stage 3 Start Time': t.stage3.startTime ?? '-',
        'Stage 3 End Time': t.stage3.completionTime ?? '-',
        'Stage 3 Duration': formatDuration(t.stage3.durationSec),
        'Total Moves': getTotalMoves(t),
        'Total Daily Time (sec)': totalTimeSec ?? '-',
        'Total Daily Time': formatDuration(totalTimeSec)
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Live Tracking');
    XLSX.writeFile(workbook, 'live_tracking.xlsx');
  };

  // Export PDF - High quality, start/end timestamps & stage durations included
  const handleDownloadPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape layout (297mm x 210mm)
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2; // 281mm

    const colGap = 6;
    const colWidth = (contentWidth - colGap * 2) / 3; // ~89mm width per column

    for (let idx = 0; idx < trackingHistory.length; idx++) {
      const track = trackingHistory[idx];
      if (idx > 0) doc.addPage();

      let y = margin;

      const totalTimeStr = formatDuration(getTotalTimeSec(track));

      // Header info
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Level ${track.levelNumber} - Live Tracking Report`, margin, y + 4);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${track.date}  |  Total Moves: ${getTotalMoves(track)}  |  Total Time: ${totalTimeStr}`, margin + 120, y + 4);

      y += 6;
      doc.setDrawColor(210);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      const stages = [track.stage1, track.stage2, track.stage3];

      // Measure actual aspect ratio of captured images or use 2.0 (device simulator ratio)
      let sampleUrl = track.stage1.startScreenshot || track.stage1.screenshot || track.stage2.startScreenshot || track.stage2.screenshot;
      let aspectRatio = 2.0;
      if (sampleUrl) {
        aspectRatio = await getImageAspectRatio(sampleUrl);
      }

      // Available height per row (2 rows per page)
      const maxRowImgHeight = 70; // mm
      let imgHeight = colWidth * aspectRatio;

      let finalImgWidth = colWidth;
      let finalImgHeight = imgHeight;

      if (finalImgHeight > maxRowImgHeight) {
        finalImgHeight = maxRowImgHeight;
        finalImgWidth = finalImgHeight / aspectRatio;
      }

      // ROW 1: STARTING VIEWS
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('STARTING VIEWS (Initial Board Layouts)', margin, y + 3);
      y += 5;

      for (let sIdx = 0; sIdx < stages.length; sIdx++) {
        const stage = stages[sIdx];
        const colStartX = margin + sIdx * (colWidth + colGap);
        const xPos = colStartX + (colWidth - finalImgWidth) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const startClockStr = stage.startTime ? ` (Start: ${stage.startTime})` : ' (Start)';
        doc.text(`Stage ${sIdx + 1}${startClockStr}`, colStartX + 2, y + 3);

        if (stage.startScreenshot) {
          try {
            doc.addImage(stage.startScreenshot, 'JPEG', xPos, y + 5, finalImgWidth, finalImgHeight, undefined, 'FAST');
          } catch (e) {
            doc.setDrawColor(200);
            doc.rect(xPos, y + 5, finalImgWidth, finalImgHeight);
            doc.setFontSize(8);
            doc.text('Unavailable', xPos + 5, y + 5 + finalImgHeight / 2);
          }
        } else {
          doc.setDrawColor(200);
          doc.rect(xPos, y + 5, finalImgWidth, finalImgHeight);
          doc.setFontSize(8);
          doc.text('No start screenshot', xPos + 5, y + 5 + finalImgHeight / 2);
        }
      }

      y += finalImgHeight + 9;

      // ROW 2: COMPLETION VIEWS
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPLETION VIEWS (Solved Board Layouts)', margin, y + 3);
      y += 5;

      for (let sIdx = 0; sIdx < stages.length; sIdx++) {
        const stage = stages[sIdx];
        const colStartX = margin + sIdx * (colWidth + colGap);
        const xPos = colStartX + (colWidth - finalImgWidth) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const movesLabel = stage.moves !== undefined && stage.moves !== null ? ` • ${stage.moves} Moves` : '';
        const durationLabel = stage.durationSec !== undefined && stage.durationSec !== null ? ` • ${formatDuration(stage.durationSec)}` : '';
        const statusLabel = stage.error
          ? `Stage ${sIdx + 1} (Error: ${stage.error})`
          : stage.passed
          ? `Stage ${sIdx + 1} (Complete${movesLabel}${durationLabel})`
          : `Stage ${sIdx + 1} (Pending)`;
        
        doc.text(statusLabel, colStartX + 2, y + 3);

        if (stage.screenshot) {
          try {
            doc.addImage(stage.screenshot, 'JPEG', xPos, y + 5, finalImgWidth, finalImgHeight, undefined, 'FAST');
          } catch (e) {
            doc.setDrawColor(200);
            doc.rect(xPos, y + 5, finalImgWidth, finalImgHeight);
            doc.setFontSize(8);
            doc.text('Unavailable', xPos + 5, y + 5 + finalImgHeight / 2);
          }
        } else {
          doc.setDrawColor(200);
          doc.rect(xPos, y + 5, finalImgWidth, finalImgHeight);
          doc.setFontSize(8);
          doc.text('No completion screenshot', xPos + 5, y + 5 + finalImgHeight / 2);
        }
      }
    }

    doc.save('live_tracking_screenshots.pdf');
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

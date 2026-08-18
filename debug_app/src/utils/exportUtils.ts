import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { TrackingData, StageRecord } from '../components/LiveView';

export function formatDuration(sec: number | null | undefined): string {
  if (sec === undefined || sec === null) return '-';
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
}

export function getStageStatusString(stage: StageRecord): string {
  if (stage.error) return `Error: ${stage.error}`;
  return stage.passed ? 'Passed' : 'Pending';
}

export function getTotalMoves(t: TrackingData): number | string {
  let total = 0;
  let hasValue = false;
  [t.stage1, t.stage2, t.stage3].forEach(s => {
    if (s.moves !== undefined && s.moves !== null) {
      total += s.moves;
      hasValue = true;
    }
  });
  return hasValue ? total : '-';
}

export function getTotalTimeSec(t: TrackingData): number | null {
  let total = 0;
  let hasValue = false;
  [t.stage1, t.stage2, t.stage3].forEach(s => {
    if (s.durationSec !== undefined && s.durationSec !== null) {
      total += s.durationSec;
      hasValue = true;
    }
  });
  return hasValue ? total : null;
}

export function getImageAspectRatio(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > 0 && img.height > 0) {
        resolve(img.height / img.width);
      } else {
        resolve(2.0);
      }
    };
    img.onerror = () => resolve(2.0);
    img.src = dataUrl;
  });
}

// Export CSV
export function exportCSV(trackingHistory: TrackingData[]) {
  const headers = [
    'Date', 
    'Level', 
    'Stage 1 Status', 
    'Stage 1 Moves',
    'Stage 1 Start Time',
    'Stage 1 End Time',
    'Stage 1 Duration',
    'Stage 1 Missing Images',
    'Stage 2 Status', 
    'Stage 2 Moves',
    'Stage 2 Start Time',
    'Stage 2 End Time',
    'Stage 2 Duration',
    'Stage 2 Missing Images',
    'Stage 3 Status', 
    'Stage 3 Moves',
    'Stage 3 Start Time',
    'Stage 3 End Time',
    'Stage 3 Duration',
    'Stage 3 Missing Images',
    'Total Moves',
    'Total Daily Time'
  ];
  const rows = trackingHistory.map(t => {
    const s1Moves = t.stage1.moves ?? '-';
    const s1Start = t.stage1.startTime ?? '-';
    const s1End = t.stage1.completionTime ?? '-';
    const s1Dur = formatDuration(t.stage1.durationSec);
    const s1ErrImg = t.stage1.errorImages && t.stage1.errorImages.length > 0 ? t.stage1.errorImages.join('; ') : '-';

    const s2Moves = t.stage2.moves ?? '-';
    const s2Start = t.stage2.startTime ?? '-';
    const s2End = t.stage2.completionTime ?? '-';
    const s2Dur = formatDuration(t.stage2.durationSec);
    const s2ErrImg = t.stage2.errorImages && t.stage2.errorImages.length > 0 ? t.stage2.errorImages.join('; ') : '-';

    const s3Moves = t.stage3.moves ?? '-';
    const s3Start = t.stage3.startTime ?? '-';
    const s3End = t.stage3.completionTime ?? '-';
    const s3Dur = formatDuration(t.stage3.durationSec);
    const s3ErrImg = t.stage3.errorImages && t.stage3.errorImages.length > 0 ? t.stage3.errorImages.join('; ') : '-';

    const totalMoves = getTotalMoves(t);
    const totalTime = formatDuration(getTotalTimeSec(t));

    const s1Status = getStageStatusString(t.stage1);
    const s2Status = getStageStatusString(t.stage2);
    const s3Status = getStageStatusString(t.stage3);

    return `"${t.date}",${t.levelNumber},"${s1Status}",${s1Moves},"${s1Start}","${s1End}","${s1Dur}","${s1ErrImg}","${s2Status}",${s2Moves},"${s2Start}","${s2End}","${s2Dur}","${s2ErrImg}","${s3Status}",${s3Moves},"${s3Start}","${s3End}","${s3Dur}","${s3ErrImg}",${totalMoves},"${totalTime}"`;
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
}

// Export Excel (.xlsx)
export function exportExcel(trackingHistory: TrackingData[]) {
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
      'Stage 1 Missing Images': t.stage1.errorImages && t.stage1.errorImages.length > 0 ? t.stage1.errorImages.join('; ') : '-',
      'Stage 2 Status': getStageStatusString(t.stage2),
      'Stage 2 Moves': t.stage2.moves ?? '-',
      'Stage 2 Start Time': t.stage2.startTime ?? '-',
      'Stage 2 End Time': t.stage2.completionTime ?? '-',
      'Stage 2 Duration': formatDuration(t.stage2.durationSec),
      'Stage 2 Missing Images': t.stage2.errorImages && t.stage2.errorImages.length > 0 ? t.stage2.errorImages.join('; ') : '-',
      'Stage 3 Status': getStageStatusString(t.stage3),
      'Stage 3 Moves': t.stage3.moves ?? '-',
      'Stage 3 Start Time': t.stage3.startTime ?? '-',
      'Stage 3 End Time': t.stage3.completionTime ?? '-',
      'Stage 3 Duration': formatDuration(t.stage3.durationSec),
      'Stage 3 Missing Images': t.stage3.errorImages && t.stage3.errorImages.length > 0 ? t.stage3.errorImages.join('; ') : '-',
      'Total Moves': getTotalMoves(t),
      'Total Daily Time (sec)': totalTimeSec ?? '-',
      'Total Daily Time': formatDuration(totalTimeSec)
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Live Tracking');
  XLSX.writeFile(workbook, 'live_tracking.xlsx');
}

// Export PDF
export async function exportPDF(trackingHistory: TrackingData[]) {
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

    let sampleUrl = track.stage1.startScreenshot || track.stage1.screenshot || track.stage2.startScreenshot || track.stage2.screenshot;
    let aspectRatio = 2.0;
    if (sampleUrl) {
      aspectRatio = await getImageAspectRatio(sampleUrl);
    }

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

      if (stage.errorImages && stage.errorImages.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(220, 38, 38); // red color
        const missingText = `Missing Images: ${stage.errorImages.join(', ')}`;
        doc.text(missingText, xPos, y + 8 + finalImgHeight);
        doc.setTextColor(0, 0, 0); // reset color
      }
    }
  }

  doc.save('live_tracking_screenshots.pdf');
}

// Main Puzzle Tracking Interfaces & Exports
export interface MainImageFormationRecord {
  categoryName: string;
  screenshot: string;
  timestamp: string;
}

export interface MainTrackingData {
  levelNumber: number;
  imagesFormedCount: number;
  totalCategories: number;
  totalMoves: number;
  status: 'In Progress' | 'Passed' | 'Failed / Error';
  startTime: string | null;
  completionTime: string | null;
  durationSec: number | null;
  initialBoardScreenshot: string | null;
  imageFormationScreenshots: MainImageFormationRecord[];
  finalCompletionScreenshot: string | null;
  error?: string | null;
  errorImages?: string[];
}

export function exportMainExcel(mainTrackingHistory: MainTrackingData[]) {
  const summaryRows = mainTrackingHistory.map(t => ({
    'Level Number': t.levelNumber,
    'Images Formed': `${t.imagesFormedCount} / ${t.totalCategories}`,
    'Total Moves': t.totalMoves,
    'Status': t.status,
    'Start Time': t.startTime || '-',
    'Completion Time': t.completionTime || '-',
    'Duration': formatDuration(t.durationSec),
    'Missing Images': t.errorImages && t.errorImages.length > 0 ? t.errorImages.join('; ') : '-',
    'Error': t.error || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(summaryRows);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
    { wch: 30 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Main Puzzle Tracking');
  XLSX.writeFile(workbook, 'main_puzzle_live_tracking.xlsx');
}

export async function exportMainPDF(mainTrackingHistory: MainTrackingData[]) {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape layout (297mm x 210mm)
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 277mm

  for (let idx = 0; idx < mainTrackingHistory.length; idx++) {
    const track = mainTrackingHistory[idx];
    if (idx > 0) doc.addPage();

    let y = margin;

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Main Puzzle - Level ${track.levelNumber} Report`, margin, y + 4);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Status: ${track.status}  |  Moves: ${track.totalMoves}  |  Images Formed: ${track.imagesFormedCount}/${track.totalCategories}  |  Duration: ${formatDuration(track.durationSec)}`, margin, y + 10);

    if (track.errorImages && track.errorImages.length > 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`Missing Images: ${track.errorImages.join(', ')}`, margin, y + 15);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    y += 14;
    doc.setDrawColor(210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    const colWidth = (contentWidth - 10) / 2; // two columns with 10mm gap
    const leftColX = margin;
    const rightColX = margin + colWidth + 10;

    // 1. Initial Board Screenshot (Left Column)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Initial Board View (Level Start)', leftColX, y);
    
    // 2. Final Completion Screenshot (Right Column)
    doc.text('2. Final Level Completion View', rightColX, y);

    y += 4;
    let maxImgH = 0;

    if (track.initialBoardScreenshot) {
      try {
        const aspect = await getImageAspectRatio(track.initialBoardScreenshot);
        const imgH = Math.min(130, colWidth * aspect);
        const imgW = imgH / aspect;
        doc.addImage(track.initialBoardScreenshot, 'JPEG', leftColX, y, imgW, imgH, undefined, 'FAST');
        maxImgH = Math.max(maxImgH, imgH);
      } catch (e) {
      }
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('(No initial board screenshot)', leftColX, y + 4);
    }

    if (track.finalCompletionScreenshot) {
      try {
        const aspect = await getImageAspectRatio(track.finalCompletionScreenshot);
        const imgH = Math.min(130, colWidth * aspect);
        const imgW = imgH / aspect;
        doc.addImage(track.finalCompletionScreenshot, 'JPEG', rightColX, y, imgW, imgH, undefined, 'FAST');
        maxImgH = Math.max(maxImgH, imgH);
      } catch (e) {
      }
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('(Level in progress or no completion screenshot)', rightColX, y + 4);
    }
    
    y += maxImgH + 10;
  }

  doc.save('main_puzzle_live_tracking_report.pdf');
}

// Download all 3 formats (CSV, Excel, PDF) automatically with staggered delays for browser popup compliance
export async function exportAllReports(trackingHistory: TrackingData[]) {
  exportCSV(trackingHistory);
  await new Promise(r => setTimeout(r, 400));
  exportExcel(trackingHistory);
  await new Promise(r => setTimeout(r, 400));
  await exportPDF(trackingHistory);
}


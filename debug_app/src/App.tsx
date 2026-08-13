import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { PuzzleLevelDecoder } from './engine/PuzzleLevelDecoder';
import { PuzzleEngine } from './engine/PuzzleEngine';
import type { PuzzleSession, PuzzleRawLevel, PuzzleLevelDefinition } from './engine/PuzzleModels';
import { PuzzleBoard } from './components/PuzzleBoard';
import { DebugDashboard } from './components/DebugDashboard';
import { LiveView } from './components/LiveView';
import type { TrackingData, StageRecord } from './components/LiveView';
import { ErrorView } from './components/ErrorView';
import { PuzzleValidator } from './engine/PuzzleValidator';
import { AlertTriangle, Layers, Calendar } from 'lucide-react';
import { exportAllReports, MainTrackingData, MainImageFormationRecord } from './utils/exportUtils';
import html2canvas from 'html2canvas';

import { AutoSolveModal, AutoSolveMode } from './components/AutoSolveModal';
import { ModeSelectionModal } from './components/ModeSelectionModal';

const engine = new PuzzleEngine();
const decoder = new PuzzleLevelDecoder();
const LEVEL_1_DATE = '2026-06-26'; // The date of Level 1 in daily.json
const DEFAULT_TEST_DATE = '2026-06-26'; // Default to Level 1 on mount

// Helpers
function getDailyPuzzleStage(dailyLevels: PuzzleRawLevel[], targetLevelNum: number, stageNum: number): PuzzleRawLevel | null {
  if (!dailyLevels || dailyLevels.length === 0) return null;

  const getDailyLevelNum = (l: PuzzleRawLevel) => {
    if (typeof l.levelNumber === 'number' && l.levelNumber > 0) return l.levelNumber;
    if (typeof l.id === 'number' && l.id >= 600000) {
      return Math.floor((l.id - 600000) / 100);
    }
    return 1;
  };

  const getDailyStageNum = (l: PuzzleRawLevel) => {
    if (typeof l.stageNumber === 'number' && l.stageNumber > 0) return l.stageNumber;
    if (typeof l.id === 'number' && l.id >= 600000) {
      const stg = (l.id - 600000) % 100;
      if (stg >= 1 && stg <= 3) return stg;
    }
    return 1;
  };

  const maxLevel = Math.max(...dailyLevels.map(getDailyLevelNum), 1);
  const effectiveLevelNum = ((targetLevelNum - 1) % maxLevel) + 1;

  let rawLevels = dailyLevels.filter(l => getDailyLevelNum(l) === targetLevelNum);
  if (rawLevels.length === 0) {
    rawLevels = dailyLevels.filter(l => getDailyLevelNum(l) === effectiveLevelNum);
  }
  if (rawLevels.length === 0) {
    rawLevels = dailyLevels;
  }

  return rawLevels.find(l => getDailyStageNum(l) === stageNum) || rawLevels[0] || dailyLevels[0];
}

function getMainPuzzleLevel(mainLevels: PuzzleRawLevel[], targetLevelNum: number): PuzzleRawLevel | null {
  if (!mainLevels || mainLevels.length === 0) return null;

  // 1. Try matching by levelNumber attribute directly
  let level = mainLevels.find(l => l.levelNumber === targetLevelNum);
  if (level) return level;

  // 2. Try matching by id attribute directly
  level = mainLevels.find(l => l.id === targetLevelNum || l.id === (600000 + targetLevelNum));
  if (level) return level;

  // 3. Try matching by 1-based index (targetLevelNum - 1)
  const safeIndex = Math.max(0, Math.min(targetLevelNum - 1, mainLevels.length - 1));
  return mainLevels[safeIndex] || mainLevels[0];
}

function dateToLevelNumber(dateStr: string): number {
  const target = new Date(dateStr);
  const start = new Date(LEVEL_1_DATE);
  const diffTime = target.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function dateFromLevelNumber(levelNum: number): string {
  const date = new Date(LEVEL_1_DATE);
  date.setDate(date.getDate() + (levelNum - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createSession(level: PuzzleLevelDefinition): PuzzleSession {
  // Use first sequence to map cells to board
  const sequence = level.sequences[0];
  const totalSlots = level.size.rows * level.size.columns;
  const activeSlots = new Array(totalSlots).fill(null);
  const queue: string[] = [];

  const tilesById: any = {};
  level.cells.forEach(c => {
    tilesById[`cell-${c.cellIndex}`] = c;
  });

  sequence.data.forEach((cellIndex, i) => {
    const tileId = `cell-${cellIndex}`;
    if (i < activeSlots.length) {
      activeSlots[totalSlots - 1 - i] = tileId;
    } else {
      queue.push(tileId);
    }
  });

  return {
    level,
    activeSlots,
    tilesById,
    queue,
    lockedSlotIndexes: [],
    solvedRows: [],
    moveCount: 0,
    movesRemaining: null,
    timerRemainingMs: null,
    completed: false,
    failed: false,
    extraCategoryActive: false,
    extraCategoryComplete: false,
    hintRevealedTileIds: [],
    lastHintPreview: null,
  };
}

function StackedCategoryPill({ formed, total, isAnimating }: { formed: number; total: number; isAnimating: boolean }) {
  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: '#5d4f47',
        color: '#ffffff',
        padding: '3px 12px 3px 6px',
        borderRadius: '20px',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
        transform: isAnimating ? 'scale(1.25)' : 'scale(1)',
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        border: '1px solid #4a3e37',
        userSelect: 'none'
      }}
    >
      {/* 3D Stacked Layers Icon matching screenshot */}
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bottom Blue Layer */}
        <path d="M16 26L4 20L16 14L28 20L16 26Z" fill="#3880a6" />
        <path d="M4 20V22L16 28L28 22V20L16 26L4 20Z" fill="#2c6685" />

        {/* Middle Orange Layer */}
        <path d="M16 20L4 14L16 8L28 14L16 20Z" fill="#e07e43" />
        <path d="M4 14V16L16 22L28 16V14L16 20L4 14Z" fill="#b8612c" />

        {/* Top Green Layer */}
        <path d="M16 14L4 8L16 2L28 8L16 14Z" fill="#6ba34b" />
        <path d="M4 8V10L16 16L28 10V8L16 14L4 8Z" fill="#507c37" />
      </svg>
      <span style={{
        fontFamily: "'Fredoka', 'Outfit', system-ui, sans-serif",
        fontSize: '15px',
        fontWeight: 800,
        letterSpacing: '0.5px',
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)'
      }}>
        {formed}/{total}
      </span>
    </div>
  );
}

export default function App() {
  // Active Mode: 'daily' | 'main'
  const [activeMode, setActiveMode] = useState<'daily' | 'main'>('daily');
  const [showModeModal, setShowModeModal] = useState<boolean>(true);
  const [isPillAnimating, setIsPillAnimating] = useState<boolean>(false);

  // Daily Puzzle States
  const [currentDate, setCurrentDate] = useState(DEFAULT_TEST_DATE);
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-02');
  const [isRangeAutoSolving, setIsRangeAutoSolving] = useState(false);
  const [levelData, setLevelData] = useState<PuzzleRawLevel[]>([]);
  const [stageProgress, setStageProgress] = useState(1);
  const [trackingHistory, setTrackingHistory] = useState<TrackingData[]>([]);

  // Main Puzzle States
  const [mainLevelData, setMainLevelData] = useState<PuzzleRawLevel[]>([]);
  const [mainLevelNumber, setMainLevelNumber] = useState<number>(1);
  const [mainTrackingHistory, setMainTrackingHistory] = useState<MainTrackingData[]>([]);
  const [mainImagesFormed, setMainImagesFormed] = useState<number>(0);

  // Common Game States
  const [session, setSession] = useState<PuzzleSession | null>(null);
  const sessionRef = useRef<PuzzleSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);
  
  const [internalDict, setInternalDict] = useState<Set<string>>(new Set());
  const [stageError, setStageError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState<string | null>(null);

  // Automation States
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [autoSolveMode, setAutoSolveMode] = useState<AutoSolveMode>('normal');
  const [autoSolveSpeed, setAutoSolveSpeed] = useState<number>(1000);
  const [showAutoSolveModal, setShowAutoSolveModal] = useState(false);
  const [autoSwapAnim, setAutoSwapAnim] = useState<{ from: number, to: number } | null>(null);

  // Views & Refs
  const [showLiveView, setShowLiveView] = useState(false);
  const [showErrorView, setShowErrorView] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);

  // Main Puzzle Screenshot Refs
  const prevSolvedRowsCount = useRef<number>(0);
  const mainInitialScreenshot = useRef<string | null>(null);
  const mainImageFormationScreenshots = useRef<MainImageFormationRecord[]>([]);
  const mainStartTimeRef = useRef<string | null>(null);
  const mainStartTimestamp = useRef<number>(Date.now());
  const isCapturingScreenshot = useRef<boolean>(false);
  const isMergingRef = useRef<boolean>(false);

  // Initialize Web Worker for background timing
  useEffect(() => {
    const blobCode = `
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data.action === 'start') {
          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(function() {
            self.postMessage('tick');
          }, e.data.interval);
        } else if (e.data.action === 'stop') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
    `;
    const blob = new Blob([blobCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  // Sync worker state with auto-solve state
  useEffect(() => {
    if (workerRef.current) {
      if (isAutoSolving && session && !session.completed && !stageError && !isCapturingScreenshot.current) {
        workerRef.current.postMessage({ action: 'start', interval: autoSolveSpeed });
      } else {
        workerRef.current.postMessage({ action: 'stop' });
      }
    }
  }, [isAutoSolving, autoSolveSpeed, session?.completed, stageError]);

  // Fetch datasets on mount
  useEffect(() => {
    // Fetch daily.json
    fetch('/daily.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const levels = Array.isArray(data) ? data : (data.levels || []);
        if (levels.length > 0) {
          setLevelData(levels);
          setInternalDict(PuzzleValidator.buildInternalDictionary(levels));
        }
      })
      .catch(err => console.error('Failed to load daily.json:', err));

    // Fetch main.json
    fetch('/main.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const levels = Array.isArray(data) ? data : (data.levels || []);
        if (levels.length > 0) {
          setMainLevelData(levels);
        }
      })
      .catch(err => console.error('Failed to load main.json:', err));
  }, []);

  // Mode change handler
  const handleSelectMode = (mode: 'daily' | 'main') => {
    setActiveMode(mode);
    setIsAutoSolving(false);
    setIsRangeAutoSolving(false);
    setSession(null);
    setStageError(null);
  };

  // --- 1. DAILY PUZZLE LEVEL LOAD ---
  useEffect(() => {
    if (activeMode !== 'daily' || levelData.length === 0) return;

    const targetLevelNum = dateToLevelNumber(currentDate);
    const rawStage = getDailyPuzzleStage(levelData, targetLevelNum, stageProgress);

    if (rawStage) {
      const validation = PuzzleValidator.validateStage(rawStage, internalDict);
      if (validation.errors.length > 0) {
        setStageError(validation.errors.join("; "));
      } else {
        setStageError(null);
      }

      const wrapper = { defaults: { size: "6x4", difficulty: "easy" }, levels: [rawStage] };
      let decoded = decoder.decodeAssetSafe(wrapper, "daily")[0];
      if (!decoded) {
        decoded = decoder.decodeAssetSafe([rawStage], "daily")[0];
      }

      if (decoded) {
        const newSession = createSession(decoded);
        setSession(newSession);
      }

      // Capture Daily Puzzle start view after DOM render
      setTimeout(() => {
        if (captureRef.current) {
          html2canvas(captureRef.current).then(canvas => {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setTrackingHistory(prev => {
              const newHistory = [...prev];
              let currentRecord = newHistory.find(r => r.date === currentDate && r.levelNumber === targetLevelNum);
              if (!currentRecord) {
                currentRecord = {
                  date: currentDate,
                  levelNumber: targetLevelNum,
                  stage1: { passed: false, startScreenshot: dataUrl, screenshot: null, moves: null, startTime: new Date().toLocaleTimeString() },
                  stage2: { passed: false, startScreenshot: null, screenshot: null, moves: null },
                  stage3: { passed: false, startScreenshot: null, screenshot: null, moves: null },
                };
                newHistory.push(currentRecord);
              }
              return newHistory;
            });
          });
        }
      }, 300);
    }
  }, [activeMode, currentDate, stageProgress, levelData]);

  // --- 2. MAIN PUZZLE LEVEL LOAD ---
  useEffect(() => {
    if (activeMode !== 'main' || mainLevelData.length === 0) return;

    const rawLevel = getMainPuzzleLevel(mainLevelData, mainLevelNumber);

    if (rawLevel) {
      const levelToDecode = {
        ...rawLevel,
        size: rawLevel.size || "6x4",
        difficulty: rawLevel.difficulty || "easy",
        levelNumber: rawLevel.levelNumber || mainLevelNumber
      };

      const validation = PuzzleValidator.validateMainPuzzleLevel(levelToDecode);
      if (validation.errors.length > 0) {
        setStageError(validation.errors.join("; "));
      } else {
        setStageError(null);
      }

      const wrapper = { defaults: { size: "6x4", difficulty: "easy" }, levels: [levelToDecode] };
      let decoded = decoder.decodeAssetSafe(wrapper, "default")[0];
      if (!decoded) {
        decoded = decoder.decodeAssetSafe([levelToDecode], "default")[0];
      }

      if (decoded) {
        const newSession = createSession(decoded);
        setSession(newSession);
        setMainImagesFormed(0);
        prevSolvedRowsCount.current = 0;
        mainImageFormationScreenshots.current = [];
        mainStartTimeRef.current = new Date().toLocaleTimeString();
        mainStartTimestamp.current = Date.now();
      }

      // Capture Main Puzzle Initial Board View right after loading
      setTimeout(() => {
        if (captureRef.current) {
          html2canvas(captureRef.current).then(canvas => {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            mainInitialScreenshot.current = dataUrl;
          });
        }
      }, 300);
    } else {
      setStageError(`Main Puzzle Level ${mainLevelNumber} not found.`);
      setSession(null);
      setIsAutoSolving(false);
    }
  }, [activeMode, mainLevelNumber, mainLevelData]);

  // --- 3. MAIN PUZZLE PER-IMAGE FORMATION SCREENSHOT CAPTURE PIPELINE ---
  useEffect(() => {
    if (activeMode !== 'main' || !session) return;

    const currentSolvedCount = session.solvedRows.length;
    setMainImagesFormed(currentSolvedCount);

    if (currentSolvedCount > prevSolvedRowsCount.current) {
      const newlySolvedRows = session.solvedRows.slice(prevSolvedRowsCount.current);
      prevSolvedRowsCount.current = currentSolvedCount;

      setIsPillAnimating(true);
      setTimeout(() => setIsPillAnimating(false), 450);

      isCapturingScreenshot.current = true;

      // Pause auto-solve briefly to allow DOM banner animation to complete & take screenshot
      setTimeout(() => {
        if (captureRef.current) {
          html2canvas(captureRef.current).then(canvas => {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            newlySolvedRows.forEach(row => {
              const categoryName = (row.category || row.categoryKey || 'UNKNOWN_CATEGORY')
                .toUpperCase()
                .replace(/[^A-Z0-9_]/g, '_') + '_FORMATION';

              mainImageFormationScreenshots.current.push({
                categoryName,
                screenshot: dataUrl,
                timestamp: new Date().toLocaleTimeString()
              });
            });

            isCapturingScreenshot.current = false;
          });
        } else {
          isCapturingScreenshot.current = false;
        }
      }, 450);
    }

    // Check Main Puzzle Level Completion (all 12 categories solved)
    if (session.completed) {
      setTimeout(() => {
        if (captureRef.current) {
          html2canvas(captureRef.current).then(canvas => {
            const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const durationSec = Math.round((Date.now() - mainStartTimestamp.current) / 1000);

            setMainTrackingHistory(prev => {
              const updated = [...prev];
              const recordIndex = updated.findIndex(r => r.levelNumber === mainLevelNumber);
              const totalCats = session ? session.level.categories : 6;
              const record: MainTrackingData = {
                levelNumber: mainLevelNumber,
                imagesFormedCount: session.solvedRows.length,
                totalCategories: totalCats,
                totalMoves: session.moveCount,
                status: 'Passed',
                startTime: mainStartTimeRef.current,
                completionTime: new Date().toLocaleTimeString(),
                durationSec,
                initialBoardScreenshot: mainInitialScreenshot.current,
                imageFormationScreenshots: [...mainImageFormationScreenshots.current],
                finalCompletionScreenshot: finalDataUrl
              };

              if (recordIndex >= 0) {
                updated[recordIndex] = record;
              } else {
                updated.push(record);
              }
              return updated;
            });

            setShowOverlay(`🎉 Main Puzzle Level ${mainLevelNumber} Completed! Loading Level ${mainLevelNumber + 1}...`);

            setTimeout(() => {
              setShowOverlay(null);
              setMainLevelNumber(prev => prev + 1);
              setIsAutoSolving(true);
            }, 3500);
          });
        }
      }, 2500);
    }
  }, [activeMode, session?.solvedRows.length, session?.completed]);

  // --- 4. DAILY PUZZLE STAGE COMPLETION WATCHER ---
  useEffect(() => {
    if (activeMode !== 'daily' || !session?.completed) return;

    const endClock = new Date().toLocaleTimeString();
    const durationSec = 15; // default estimate or timer calculation

    if (captureRef.current) {
      html2canvas(captureRef.current).then(canvas => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const targetLevelNum = dateToLevelNumber(currentDate);

        setTrackingHistory(prev => {
          const newHistory = [...prev];
          let currentRecord = newHistory.find(r => r.date === currentDate && r.levelNumber === targetLevelNum);
          if (!currentRecord) {
            currentRecord = {
              date: currentDate,
              levelNumber: targetLevelNum,
              stage1: { passed: false, startScreenshot: null, screenshot: null, moves: null },
              stage2: { passed: false, startScreenshot: null, screenshot: null, moves: null },
              stage3: { passed: false, startScreenshot: null, screenshot: null, moves: null },
            };
            newHistory.push(currentRecord);
          } else {
            currentRecord = { ...currentRecord };
            const idx = newHistory.findIndex(r => r.date === currentDate && r.levelNumber === targetLevelNum);
            newHistory[idx] = currentRecord;
          }

          const movesCount = session.moveCount;

          if (stageProgress === 1) {
            currentRecord.stage1 = { ...currentRecord.stage1, passed: true, screenshot: dataUrl, moves: movesCount, completionTime: endClock, durationSec };
          } else if (stageProgress === 2) {
            currentRecord.stage2 = { ...currentRecord.stage2, passed: true, screenshot: dataUrl, moves: movesCount, completionTime: endClock, durationSec };
          } else if (stageProgress === 3) {
            currentRecord.stage3 = { ...currentRecord.stage3, passed: true, screenshot: dataUrl, moves: movesCount, completionTime: endClock, durationSec };
          }

          return newHistory;
        });

        if (stageProgress < 3) {
          setShowOverlay(`Stage ${stageProgress} Completed!`);
          setTimeout(() => {
            setShowOverlay(null);
            setStageProgress(prev => prev + 1);
          }, 1500);
        } else {
          const reachedEnd = isRangeAutoSolving && currentDate >= endDate;
          if (reachedEnd) {
            setShowOverlay(`🎉 End Date ${endDate} Reached! Downloading PDF, CSV & Excel reports...`);
            setIsAutoSolving(false);
            setIsRangeAutoSolving(false);
            setTimeout(() => {
              setShowOverlay(null);
              setTrackingHistory(latest => {
                exportAllReports(latest);
                return latest;
              });
            }, 2000);
          } else {
            setShowOverlay(`Daily Puzzle Completed! Loading next day...`);
            setTimeout(() => {
              setShowOverlay(null);
              const nextLevel = targetLevelNum + 1;
              setCurrentDate(dateFromLevelNumber(nextLevel));
              setStageProgress(1);
            }, 2000);
          }
        }
      });
    }
  }, [activeMode, session?.completed]);

  // --- 5. AUTOMATION SOLVE LOGIC (WEB WORKER DRIVEN) ---
  useEffect(() => {
    if (!workerRef.current) return;

    workerRef.current.onmessage = (e) => {
      if (e.data !== 'tick') return;
      if (!isAutoSolving || !session || session.completed || isMergingRef.current) {
        return;
      }

      const performSwap = (fromSlot: number, toSlot: number) => {
        if (document.hidden) {
          handleSwap(fromSlot, toSlot);
        } else {
          setAutoSwapAnim({ from: fromSlot, to: toSlot });
          setTimeout(() => {
            handleSwap(fromSlot, toSlot);
            setAutoSwapAnim(null);
          }, 600);
        }
      };

      const { rows, columns } = session.level.size;
      const active = session.activeSlots;
      const locked = session.lockedSlotIndexes;

      // Special Solver for Master Category (Extra Category)
      if (session.extraCategoryActive && !session.extraCategoryComplete) {
        for (let r = 0; r < rows; r++) {
          const col0Slot = r * columns;
          const col0TileId = active[col0Slot];
          const col0Tile = col0TileId ? session.tilesById[col0TileId] : null;
          
          const isMasterTile = (tile: any) => 
            tile && (tile.categoryKey === session.level.extraCategoryKey || tile.isExtraCategory);

          if (!isMasterTile(col0Tile)) {
            // Find the master tile in this row
            let masterSlotIndex = -1;
            for (let c = 1; c < columns; c++) {
              const slotIdx = r * columns + c;
              const tileId = active[slotIdx];
              const tile = tileId ? session.tilesById[tileId] : null;
              if (isMasterTile(tile)) {
                masterSlotIndex = slotIdx;
                break;
              }
            }
            
            if (masterSlotIndex !== -1) {
              console.log(`[AutoSolve] Master Category swap: Swapping row ${r} col 0 (slot ${col0Slot}) with master tile at slot ${masterSlotIndex}`);
              performSwap(col0Slot, masterSlotIndex);
              return;
            }
          }
        }
        
        setIsAutoSolving(false);
        return;
      }

      const unlockedSlots: number[] = [];
      for (let i = 0; i < active.length; i++) {
        if (active[i] && !locked.includes(i)) {
          unlockedSlots.push(i);
        }
      }

      if (unlockedSlots.length < 2) {
        setIsAutoSolving(false);
        return;
      }

      const unlockedRowIndexes: number[] = [];
      for (let r = 0; r < rows; r++) {
        if (!locked.includes(r * columns)) {
          unlockedRowIndexes.push(r);
        }
      }

      const targetRowIndex = unlockedRowIndexes.length > 0 
        ? unlockedRowIndexes[Math.floor(Math.random() * unlockedRowIndexes.length)] 
        : -1;

      if (autoSolveMode === 'instinct') {
        const isSmartMove = Math.random() < 0.70;
        const targetRowSlots = Array.from({ length: columns }, (_, c) => targetRowIndex * columns + c);
        const outsideSlots = unlockedSlots.filter(s => !targetRowSlots.includes(s));

        if (isSmartMove) {
          const tileData = unlockedSlots.map(slotIdx => {
            const tile = session.tilesById[active[slotIdx]!];
            return { slotIdx, word: (tile?.word || '').toLowerCase(), isPic: !!tile?.isPictureCategory };
          });
          const picSlots = tileData.filter(t => t.isPic).map(t => t.slotIdx);
          const candidateSet = (picSlots.length >= columns ? picSlots : unlockedSlots).slice(0, columns);

          const slotToFill = targetRowSlots.find(s => !candidateSet.includes(s));
          const tileToMove = candidateSet.find(s => !targetRowSlots.includes(s));

          if (slotToFill !== undefined && tileToMove !== undefined) {
            performSwap(tileToMove, slotToFill);
            return;
          }
        }

        if (targetRowSlots.length > 0 && outsideSlots.length > 0) {
          const slotA = targetRowSlots[Math.floor(Math.random() * targetRowSlots.length)];
          const slotB = outsideSlots[Math.floor(Math.random() * outsideSlots.length)];
          performSwap(slotA, slotB);
          return;
        }

      } else if (autoSolveMode === 'anchor') {
        const targetRowSlots = Array.from({ length: columns }, (_, c) => targetRowIndex * columns + c);
        const outsideSlots = unlockedSlots.filter(s => !targetRowSlots.includes(s));

        if (outsideSlots.length > 0 && targetRowSlots.length > 0) {
          const slotA = targetRowSlots[Math.floor(Math.random() * targetRowSlots.length)];
          const slotB = outsideSlots[Math.floor(Math.random() * outsideSlots.length)];
          performSwap(slotB, slotA);
          return;
        }

      } else if (autoSolveMode === 'neighbor') {
        const slotA = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];
        const row = Math.floor(slotA / columns);
        const col = slotA % columns;

        const neighborCols = [col - 1, col + 1].filter(c => c >= 0 && c < columns);
        let slotB = -1;

        for (const nc of neighborCols) {
          const nSlot = row * columns + nc;
          if (unlockedSlots.includes(nSlot)) {
            slotB = nSlot;
            break;
          }
        }

        if (slotB === -1) {
          slotB = unlockedSlots[(unlockedSlots.indexOf(slotA) + 1) % unlockedSlots.length];
        }

        performSwap(slotA, slotB);

      } else {
        // NORMAL SMART SOLVER
        const categoryCounts = new Map<string, number>();
        for (let i = 0; i < active.length; i++) {
          if (active[i] && !locked.includes(i)) {
            const cat = session.tilesById[active[i]!].categoryKey;
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
          }
        }

        let targetCategory: string | null = null;
        for (const [cat, count] of categoryCounts.entries()) {
          if (count >= columns) {
            targetCategory = cat;
            break;
          }
        }

        if (!targetCategory) {
          setIsAutoSolving(false);
          return;
        }

        let targetRowIndex = -1;
        let maxTilesInRow = -1;

        for (let r = 0; r < rows; r++) {
          const firstSlot = r * columns;
          if (locked.includes(firstSlot)) continue;
          
          let hasNull = false;
          let catCount = 0;
          for (let c = 0; c < columns; c++) {
            const tileId = active[r * columns + c];
            if (!tileId) {
              hasNull = true;
              break;
            }
            if (session.tilesById[tileId].categoryKey === targetCategory) {
              catCount++;
            }
          }

          if (!hasNull) {
            if (catCount > maxTilesInRow) {
              maxTilesInRow = catCount;
              targetRowIndex = r;
            }
          }
        }

        if (targetRowIndex === -1) {
          setIsAutoSolving(false);
          return;
        }

        let slotToFill = -1;
        for (let c = 0; c < columns; c++) {
          const idx = targetRowIndex * columns + c;
          const tileId = active[idx];
          if (tileId && session.tilesById[tileId].categoryKey !== targetCategory) {
            slotToFill = idx;
            break;
          }
        }

        if (slotToFill !== -1) {
          let tileToMoveSlot = -1;
          for (let i = 0; i < active.length; i++) {
            if (Math.floor(i / columns) === targetRowIndex) continue;
            
            const tileId = active[i];
            if (tileId && !locked.includes(i) && session.tilesById[tileId].categoryKey === targetCategory) {
              tileToMoveSlot = i;
              break;
            }
          }

          if (tileToMoveSlot !== -1) {
            performSwap(tileToMoveSlot, slotToFill);
          }
        } else {
          performSwap(targetRowIndex * columns, targetRowIndex * columns + 1);
        }
      }
    };
  }, [session, isAutoSolving, autoSolveMode, autoSolveSpeed]);

  // Delay (ms) the UI waits for image formation animation before triggering tile fall
  const MERGE_ANIM_MS = 850;

  const [spawnedSlotIndexes, setSpawnedSlotIndexes] = React.useState<number[]>([]);

  const handleSwap = (fromSlot: number, toSlot: number) => {
    if (!session) return;
    console.log("[handleSwap] Swapping from index", fromSlot, "to index", toSlot);
    const transition = engine.swap(session, fromSlot, toSlot);
    console.log("[handleSwap] Swap transition effects:", transition.effects);

    const hasMerge = transition.effects.some(e => e.type === 'picture_rows_merged');

    if (hasMerge) {
      console.log("[handleSwap] Detected picture category merge. Preparing to collapse after animation.");
      isMergingRef.current = true;
      // Step 1: Apply the merge immediately (picture card appears, empty slots visible)
      setSpawnedSlotIndexes([]);
      setSession(transition.session);

      // Step 2: After merge animation completes, trigger tile fall + queue drop
      setTimeout(() => {
        console.log("[handleSwap] Merge animation timeout fired. Initiating collapse...");
        const currentSession = sessionRef.current;
        if (!currentSession) {
          console.log("[handleSwap] Cannot collapse: session is null");
          isMergingRef.current = false;
          return;
        }
        console.log("[handleSwap] Collapsing session:", currentSession);
        const collapseTransition = engine.collapse(currentSession);
        console.log("[handleSwap] Collapse transition effects:", collapseTransition.effects);
        
        const refillEffect = collapseTransition.effects.find(e => e.type === 'board_refilled') as
          { type: 'board_refilled'; filledSlots: number[]; spawnedSlotIndexes: number[] } | undefined;
        const spawnedSlots = refillEffect?.spawnedSlotIndexes ?? [];
        
        console.log("[handleSwap] Setting spawned slot indexes to:", spawnedSlots);
        
        // Update both states synchronously in the same batch
        setSpawnedSlotIndexes(spawnedSlots);
        setSession(collapseTransition.session);
        isMergingRef.current = false;
      }, MERGE_ANIM_MS);
    } else {
      // Normal swap: apply immediately, clear spawned
      const refillEffect = transition.effects.find(e => e.type === 'board_refilled') as
        { type: 'board_refilled'; filledSlots: number[]; spawnedSlotIndexes: number[] } | undefined;
      setSpawnedSlotIndexes(refillEffect?.spawnedSlotIndexes ?? []);
      setSession(transition.session);
    }
  };

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    setStageProgress(1);
  };

  const handleMainLevelJump = (levelNum: number) => {
    setMainLevelNumber(levelNum);
    setIsAutoSolving(false);
  };

  const handleAutoSolveToggle = () => {
    if (isAutoSolving) {
      setIsAutoSolving(false);
    } else {
      setShowAutoSolveModal(true);
    }
  };

  const handleAutoSolveRange = () => {
    if (isRangeAutoSolving) {
      setIsRangeAutoSolving(false);
      setIsAutoSolving(false);
    } else {
      setIsRangeAutoSolving(true);
      setCurrentDate(startDate);
      setStageProgress(1);
      setIsAutoSolving(true);
    }
  };

  const handleStartAutoSolve = (mode: AutoSolveMode, speed: number) => {
    setAutoSolveMode(mode);
    setAutoSolveSpeed(speed);
    setIsAutoSolving(true);
  };

  return (
    <>
      {/* Top Navbar Header */}
      <div style={{ width: '100%', padding: '12px 20px', backgroundColor: '#1e293b', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setShowModeModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: activeMode === 'main' ? '#7c3aed' : '#2563eb',
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            {activeMode === 'main' ? <Layers size={16} /> : <Calendar size={16} />}
            Mode: {activeMode === 'main' ? 'Main Puzzle (MP)' : 'Daily Puzzle (DP)'} 🔄
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="button" onClick={() => setShowLiveView(true)} style={{ backgroundColor: '#059669', color: 'white', border: 'none', fontWeight: 'bold' }}>
            Live View Table
          </button>
          <button className="button" onClick={() => setShowErrorView(true)} style={{ backgroundColor: '#d97706', color: 'white', border: 'none', fontWeight: 'bold' }}>
            Puzzle Error View
          </button>
        </div>
      </div>

      <div className="app-container">
        <div className="device-simulator" ref={captureRef}>
          {/* SIMULATOR HEADER */}
          <div className="header">
            {activeMode === 'daily' ? (
              <>
                <div className="debug-controls" style={{ width: '120px' }}>
                  {stageProgress < 3 && (
                    <button 
                      className="button" 
                      onClick={() => setStageProgress(stageProgress + 1)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      Skip to Stage {stageProgress + 1}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div>Stages:</div>
                    <div className="stage-indicator">
                      <div className={`stage-dot ${stageProgress >= 1 ? 'active' : ''}`}>1</div>
                      <div className={`stage-dot ${stageProgress >= 2 ? 'active' : ''}`}>2</div>
                      <div className={`stage-dot ${stageProgress >= 3 ? 'active' : ''}`}>3</div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                    backgroundColor: '#111827',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    marginTop: '4px',
                    letterSpacing: '0.3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                  }}>
                    Level {dateToLevelNumber(currentDate)} • {currentDate}
                  </div>
                </div>
              </>
            ) : (
              /* MAIN PUZZLE SIMULATOR HEADER (NO DATE, NO STAGE DOTS, NO STAGE SKIP) */
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#7c3aed',
                    backgroundColor: '#f5f3ff',
                    padding: '5px 12px',
                    borderRadius: '10px',
                    border: '1px solid #ddd6fe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Layers size={18} /> Level {mainLevelNumber}
                  </div>

                  {/* STACKED CATEGORY PROGRESS PILL BADGE */}
                  <StackedCategoryPill 
                    formed={mainImagesFormed} 
                    total={session ? session.level.categories : 6} 
                    isAnimating={isPillAnimating}
                  />
                </div>

                <button 
                  onClick={() => handleMainLevelJump(mainLevelNumber + 1)}
                  style={{
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)'
                  }}
                >
                  Skip to Next Level ➔
                </button>
              </div>
            )}
          </div>

          {stageError ? (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '2px solid #ef4444',
              borderRadius: '12px',
              padding: '24px 16px',
              margin: '20px auto',
              width: '90%',
              boxSizing: 'border-box',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#dc2626' }}>
                <AlertTriangle size={44} />
              </div>
              <h3 style={{ color: '#991b1b', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>
                Puzzle Validation Error
              </h3>
              <p style={{ color: '#b91c1c', fontSize: '13px', margin: '0 0 16px 0', lineHeight: '1.5', wordBreak: 'break-word' }}>
                {stageError}
              </p>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#7f1d1d', backgroundColor: '#fee2e2', padding: '8px 12px', borderRadius: '6px' }}>
                ⚠️ Automation Halted • Invalid Puzzle Data
              </div>
            </div>
          ) : session ? (
            <PuzzleBoard session={session} onSwap={handleSwap} autoSwapAnim={autoSwapAnim} spawnedSlotIndexes={spawnedSlotIndexes} />
          ) : null}

          {showOverlay && (
            <div className="stage-overlay">
              <h2>{showOverlay}</h2>
              <p>{activeMode === 'main' ? `Main Level: ${mainLevelNumber}` : `Level: ${dateToLevelNumber(currentDate)} | Date: ${currentDate}`}</p>
            </div>
          )}
        </div>

        <DebugDashboard
          activeMode={activeMode}
          currentDate={currentDate}
          onDateChange={handleDateChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onAutoSolveRange={handleAutoSolveRange}
          isRangeAutoSolving={isRangeAutoSolving}
          session={session}
          onAutoSolveToggle={handleAutoSolveToggle}
          isAutoSolving={isAutoSolving}
          autoSolveMode={autoSolveMode}
          mainLevelNumber={mainLevelNumber}
          onMainLevelJump={handleMainLevelJump}
          mainImagesFormed={mainImagesFormed}
          totalCategories={session ? session.level.categories : 6}
          onOpenAutoSolveModal={() => setShowAutoSolveModal(true)}
        />

        <AutoSolveModal
          isOpen={showAutoSolveModal}
          onClose={() => setShowAutoSolveModal(false)}
          onStart={handleStartAutoSolve}
          currentMode={autoSolveMode}
          currentSpeed={autoSolveSpeed}
        />

        <ModeSelectionModal
          isOpen={showModeModal}
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
          onClose={() => setShowModeModal(false)}
        />

        {showLiveView && (
          <LiveView 
            activeMode={activeMode}
            trackingHistory={trackingHistory} 
            mainTrackingHistory={mainTrackingHistory}
            onClose={() => setShowLiveView(false)} 
          />
        )}

        {showErrorView && (
          <ErrorView 
            activeMode={activeMode}
            levelData={levelData} 
            mainLevelData={mainLevelData}
            onClose={() => setShowErrorView(false)} 
          />
        )}
      </div>
    </>
  );
}

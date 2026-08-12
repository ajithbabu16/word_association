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
import html2canvas from 'html2canvas';

import { AutoSolveModal, AutoSolveMode } from './components/AutoSolveModal';

const engine = new PuzzleEngine();
const decoder = new PuzzleLevelDecoder();
const LEVEL_1_DATE = '2026-06-26'; // The date of Level 1 in daily.json
const DEFAULT_TEST_DATE = '2026-09-01'; // The date to load when app opens

// Helpers
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
  const activeSlots = new Array(level.size.rows * level.size.columns).fill(null);
  const queue: string[] = [];

  const tilesById: any = {};
  level.cells.forEach(c => {
    tilesById[`cell-${c.cellIndex}`] = c;
  });

  sequence.data.forEach((cellIndex, i) => {
    const tileId = `cell-${cellIndex}`;
    if (i < activeSlots.length) {
      activeSlots[i] = tileId;
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

export default function App() {
  const [currentDate, setCurrentDate] = useState(DEFAULT_TEST_DATE);
  const [levelData, setLevelData] = useState<PuzzleRawLevel[]>([]);
  const [session, setSession] = useState<PuzzleSession | null>(null);

  const [stageProgress, setStageProgress] = useState(1);
  const [showOverlay, setShowOverlay] = useState<string | null>(null);
  
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [autoSolveMode, setAutoSolveMode] = useState<AutoSolveMode>('normal');
  const [autoSolveSpeed, setAutoSolveSpeed] = useState<number>(1000);
  const [showAutoSolveModal, setShowAutoSolveModal] = useState(false);

  const [autoSwapAnim, setAutoSwapAnim] = useState<{ from: number, to: number } | null>(null);
  
  const [trackingHistory, setTrackingHistory] = useState<TrackingData[]>([]);
  const [showLiveView, setShowLiveView] = useState(false);
  const [showErrorView, setShowErrorView] = useState(false);
  
  const captureRef = useRef<HTMLDivElement>(null);

  // Fetch daily.json on mount
  useEffect(() => {
    fetch('/daily.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.levels) {
          setLevelData(data.levels);
        }
      })
      .catch(err => console.error('Failed to load daily.json:', err));
  }, []);

  // Load correct level when date/stage/data changes
  useEffect(() => {
    if (levelData.length === 0) return;

    const targetLevelNum = dateToLevelNumber(currentDate);
    // Find the level matching levelNumber and stageNumber
    // Note: If daily.json doesn't strictly have levelNumber, we assume they are sequential
    const rawLevels = levelData.filter(l => l.levelNumber === targetLevelNum);
    const rawStage = rawLevels.find(l => l.stageNumber === stageProgress);

    if (rawStage) {
      // Determine grid size based on stage
      let stageSize = "4x4"; // 4 rows * 4 cols
      if (stageProgress === 2) stageSize = "5x4";  // 5 rows * 4 cols
      if (stageProgress === 3) stageSize = "6x4"; // 6 rows * 4 cols

      const decodedLevels = decoder.decodeAssetSafe(
        {
          kind: "daily",
          defaults: { difficulty: "easy", size: stageSize },
          levels: [rawStage]
        },
        "daily"
      );
      if (decodedLevels.length > 0) {
        setSession(createSession(decodedLevels[0]));
      }
    } else {
      console.warn(`No level found for ${currentDate} stage ${stageProgress}`);
      if (isAutoSolving) setIsAutoSolving(false);
    }
  }, [currentDate, levelData, stageProgress]);

  const stageStartTimeRef = useRef<number>(Date.now());
  const stageStartClockRef = useRef<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // Track stage start time when currentDate or stageProgress changes
  useEffect(() => {
    stageStartTimeRef.current = Date.now();
    stageStartClockRef.current = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [stageProgress, currentDate]);

  // Capture initial starting screenshot when a new stage loads
  useEffect(() => {
    if (!session || session.moveCount > 0 || session.completed) return;

    const timer = setTimeout(async () => {
      if (!captureRef.current) return;
      try {
        const canvas = await html2canvas(captureRef.current, { backgroundColor: '#f2f2f2', scale: 2 });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
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
            const index = newHistory.findIndex(r => r.date === currentDate && r.levelNumber === targetLevelNum);
            newHistory[index] = currentRecord;
          }

          const startClock = stageStartClockRef.current;

          if (stageProgress === 1 && !currentRecord.stage1.startScreenshot) {
            currentRecord.stage1 = { ...currentRecord.stage1, startScreenshot: dataUrl, startTime: startClock };
          } else if (stageProgress === 2 && !currentRecord.stage2.startScreenshot) {
            currentRecord.stage2 = { ...currentRecord.stage2, startScreenshot: dataUrl, startTime: startClock };
          } else if (stageProgress === 3 && !currentRecord.stage3.startScreenshot) {
            currentRecord.stage3 = { ...currentRecord.stage3, startScreenshot: dataUrl, startTime: startClock };
          }

          return newHistory;
        });
      } catch (err) {
        console.error("Failed to capture start screenshot:", err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [session?.level.identity.stageNumber, session?.level.identity.levelNumber, currentDate]);

  // Handle stage completion & auto play
  useEffect(() => {
    if (!session?.completed) return;

    // Wait 2 seconds (2000ms) after stage completion before capturing screenshot and proceeding
    const completionTimer = setTimeout(async () => {
      let dataUrl: string | null = null;
      if (captureRef.current) {
        try {
          const canvas = await html2canvas(captureRef.current, { backgroundColor: '#f2f2f2', scale: 2 });
          dataUrl = canvas.toDataURL('image/jpeg', 0.80);
        } catch (err) {
          console.error("Failed to capture screenshot:", err);
        }
      }

      const targetLevelNum = dateToLevelNumber(currentDate);
      const endTime = Date.now();
      const endClock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const durationSec = Math.max(1, Math.round((endTime - stageStartTimeRef.current) / 1000));
      const startClock = stageStartClockRef.current;

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
          // Clone it so we don't mutate state directly
          currentRecord = { ...currentRecord };
          const index = newHistory.findIndex(r => r.date === currentDate && r.levelNumber === targetLevelNum);
          newHistory[index] = currentRecord;
        }

        const movesCount = session.moveCount;

        if (stageProgress === 1) {
          currentRecord.stage1 = { 
            ...currentRecord.stage1, 
            passed: true, 
            screenshot: dataUrl, 
            moves: movesCount,
            startTime: currentRecord.stage1.startTime || startClock,
            completionTime: endClock,
            durationSec
          };
        } else if (stageProgress === 2) {
          currentRecord.stage2 = { 
            ...currentRecord.stage2, 
            passed: true, 
            screenshot: dataUrl, 
            moves: movesCount,
            startTime: currentRecord.stage2.startTime || startClock,
            completionTime: endClock,
            durationSec
          };
        } else if (stageProgress === 3) {
          currentRecord.stage3 = { 
            ...currentRecord.stage3, 
            passed: true, 
            screenshot: dataUrl, 
            moves: movesCount,
            startTime: currentRecord.stage3.startTime || startClock,
            completionTime: endClock,
            durationSec
          };
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
        setShowOverlay(`Daily Puzzle Completed! Loading next day...`);
        setTimeout(() => {
          setShowOverlay(null);
          const nextLevel = targetLevelNum + 1;
          setCurrentDate(dateFromLevelNumber(nextLevel));
          setStageProgress(1); // Reset to stage 1
        }, 2000);
      }
    }, 2000);

    return () => clearTimeout(completionTimer);
  }, [session?.completed]);

  // Automation Solve Logic
  useEffect(() => {
    if (!isAutoSolving || !session || session.completed) {
      return;
    }

    const timeout = setTimeout(() => {
      const { rows, columns } = session.level.size;
      const active = session.activeSlots;
      const locked = session.lockedSlotIndexes;

      if (autoSolveMode === 'random') {
        // --- RANDOM MODE (PLAYER SIMULATION) ---
        // Pick 2 random available (unlocked & non-null) slots on the board
        const unlockedSlots: number[] = [];
        for (let i = 0; i < active.length; i++) {
          if (active[i] && !locked.includes(i)) {
            unlockedSlots.push(i);
          }
        }

        if (unlockedSlots.length < 2) {
          console.warn("Auto-solver (Random): Not enough unlocked slots to swap!");
          setIsAutoSolving(false);
          return;
        }

        const idxA = Math.floor(Math.random() * unlockedSlots.length);
        let idxB = Math.floor(Math.random() * unlockedSlots.length);
        while (idxB === idxA && unlockedSlots.length > 1) {
          idxB = Math.floor(Math.random() * unlockedSlots.length);
        }

        const slotA = unlockedSlots[idxA];
        const slotB = unlockedSlots[idxB];

        setAutoSwapAnim({ from: slotA, to: slotB });
        setTimeout(() => {
          handleSwap(slotA, slotB);
          setAutoSwapAnim(null);
        }, Math.min(350, autoSolveSpeed / 2));

      } else {
        // --- NORMAL MODE (SMART SOLVER) ---
        // 1. Find all available tiles and their categories
        const categoryCounts = new Map<string, number>();
        for (let i = 0; i < active.length; i++) {
          if (active[i] && !locked.includes(i)) {
            const cat = session.tilesById[active[i]!].categoryKey;
            categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
          }
        }

        // 2. Find a category that has at least `columns` tiles available on the board
        let targetCategory: string | null = null;
        for (const [cat, count] of categoryCounts.entries()) {
          if (count >= columns) {
            targetCategory = cat;
            break;
          }
        }

        if (!targetCategory) {
          console.warn("Auto-solver: No category has enough tiles on the board!");
          setIsAutoSolving(false);
          return;
        }

        // 3. Pick a target row to assemble this category
        let targetRowIndex = -1;
        let maxTilesInRow = -1;

        for (let r = 0; r < rows; r++) {
          const firstSlot = r * columns;
          if (locked.includes(firstSlot)) continue; // row is locked
          
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
          console.warn("Auto-solver: No fully populated unlocked row found!");
          setIsAutoSolving(false);
          return;
        }

        // 4. In the target row, find a slot that DOES NOT have the target category
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
          // 5. Find a tile OF the target category that is NOT in the target row
          let tileToMoveSlot = -1;
          for (let i = 0; i < active.length; i++) {
            if (Math.floor(i / columns) === targetRowIndex) continue; // skip target row
            
            const tileId = active[i];
            if (tileId && !locked.includes(i) && session.tilesById[tileId].categoryKey === targetCategory) {
              tileToMoveSlot = i;
              break;
            }
          }

          if (tileToMoveSlot !== -1) {
            setAutoSwapAnim({ from: tileToMoveSlot, to: slotToFill });
            setTimeout(() => {
              handleSwap(tileToMoveSlot, slotToFill);
              setAutoSwapAnim(null);
            }, Math.min(350, autoSolveSpeed / 2));
          }
        } else {
          // Dummy swap to trigger evaluation
          setAutoSwapAnim({ from: targetRowIndex * columns, to: targetRowIndex * columns + 1 });
          setTimeout(() => {
            handleSwap(targetRowIndex * columns, targetRowIndex * columns + 1);
            setAutoSwapAnim(null);
          }, Math.min(350, autoSolveSpeed / 2));
        }
      }

    }, autoSolveSpeed);

    return () => clearTimeout(timeout);
  }, [session, isAutoSolving, autoSolveMode, autoSolveSpeed]);

  const handleSwap = (fromSlot: number, toSlot: number) => {
    if (!session) return;
    const transition = engine.swap(session, fromSlot, toSlot);
    setSession(transition.session);
  };

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    setStageProgress(1);
  };

  const handleAutoSolveToggle = () => {
    if (isAutoSolving) {
      setIsAutoSolving(false);
    } else {
      setShowAutoSolveModal(true);
    }
  };

  const handleStartAutoSolve = (mode: AutoSolveMode, speed: number) => {
    setAutoSolveMode(mode);
    setAutoSolveSpeed(speed);
    setIsAutoSolving(true);
  };

  return (
    <>
      <div style={{ width: '100%', padding: '10px', backgroundColor: '#333', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        <button className="button" onClick={() => setShowLiveView(true)}>
          Live View
        </button>
        <button className="button" onClick={() => setShowErrorView(true)} style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none' }}>
          Puzzle Error View
        </button>
      </div>

      <div className="app-container">
        <div className="device-simulator" ref={captureRef}>
        <div className="header">
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
        </div>

        {session && (
          <PuzzleBoard session={session} onSwap={handleSwap} autoSwapAnim={autoSwapAnim} />
        )}

        {showOverlay && (
          <div className="stage-overlay">
            <h2>{showOverlay}</h2>
            <p>Level: {dateToLevelNumber(currentDate)} | Date: {currentDate}</p>
          </div>
        )}
      </div>

      <DebugDashboard
        currentDate={currentDate}
        onDateChange={handleDateChange}
        session={session}
        onAutoSolveToggle={handleAutoSolveToggle}
        isAutoSolving={isAutoSolving}
        autoSolveMode={autoSolveMode}
      />

      <AutoSolveModal
        isOpen={showAutoSolveModal}
        onClose={() => setShowAutoSolveModal(false)}
        onStart={handleStartAutoSolve}
        currentMode={autoSolveMode}
        currentSpeed={autoSolveSpeed}
      />

      {showLiveView && (
        <LiveView trackingHistory={trackingHistory} onClose={() => setShowLiveView(false)} />
      )}

      {showErrorView && (
        <ErrorView levelData={levelData} onClose={() => setShowErrorView(false)} />
      )}
      </div>
    </>
  );
}


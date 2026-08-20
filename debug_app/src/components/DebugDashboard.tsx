import React, { useState } from 'react';
import type { PuzzleSession } from '../engine/PuzzleModels';

interface DebugDashboardProps {
  activeMode?: 'daily' | 'main' | 'special';
  currentDate: string;
  onDateChange: (newDate: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (newDate: string) => void;
  onEndDateChange: (newDate: string) => void;
  onAutoSolveRange: () => void;
  isRangeAutoSolving: boolean;
  session: PuzzleSession | null;
  onAutoSolveToggle: () => void;
  isAutoSolving: boolean;
  autoSolveMode?: 'normal' | 'instinct' | 'anchor' | 'neighbor' | 'semantic' | 'pattern' | 'backtrack' | 'human' | 'random';
  // Main Puzzle specific props
  mainLevelNumber?: number;
  onMainLevelJump?: (levelNum: number) => void;
  mainImagesFormed?: number;
  totalCategories?: number;
  onOpenAutoSolveModal?: () => void;
}

export function DebugDashboard({
  activeMode = 'daily',
  currentDate,
  onDateChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onAutoSolveRange,
  isRangeAutoSolving,
  session,
  onAutoSolveToggle,
  isAutoSolving,
  autoSolveMode = 'instinct',
  mainLevelNumber = 1,
  onMainLevelJump,
  mainImagesFormed = 0,
  totalCategories = session ? session.level.categories : 6,
  onOpenAutoSolveModal
}: DebugDashboardProps) {
  const [dateInput, setDateInput] = useState(currentDate);
  const [levelJumpInput, setLevelJumpInput] = useState(String(mainLevelNumber));

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDateChange(dateInput);
  };

  const handleLevelJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(levelJumpInput, 10);
    if (!isNaN(num) && num >= 1 && onMainLevelJump) {
      onMainLevelJump(num);
    }
  };

  const getModeLabel = () => {
    switch (autoSolveMode) {
      case 'instinct': return 'Human Instinct';
      case 'anchor': return 'Anchor & Fill';
      case 'neighbor': return 'Neighbor Shuffle';
      case 'semantic': return 'Semantic AI';
      case 'pattern': return 'Pattern AI';
      case 'backtrack': return 'Backtrack AI';
      case 'human': return 'Random Half';
      case 'random': return 'Pure Random';
      default: return 'Normal';
    }
  };

  if (activeMode === 'main' || activeMode === 'special') {
    const isSpecial = activeMode === 'special';
    return (
      <div className="debug-dashboard">
        <div className="dashboard-section" style={{ borderLeft: `4px solid ${isSpecial ? '#db2777' : '#7c3aed'}` }}>
          <h3 style={{ color: isSpecial ? '#db2777' : '#6d28d9' }}>{isSpecial ? 'Special' : 'Main'} Puzzle Level Controller</h3>
          <form onSubmit={handleLevelJumpSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', width: '80px', color: '#4b5563' }}>Load Level:</label>
            <input 
              type="number" 
              min={1}
              value={levelJumpInput} 
              onChange={(e) => setLevelJumpInput(e.target.value)}
              className="input-field"
              placeholder="e.g. 1"
              style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
            />
            <button type="submit" className="button" style={{ backgroundColor: isSpecial ? '#db2777' : '#7c3aed', color: 'white', padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
              Load
            </button>
          </form>
        </div>

        <div className="dashboard-section">
          <h3>{isSpecial ? 'Special' : 'Main'} Level Info Panel</h3>
          {session ? (
            <>
              <div className="stat-row">
                <span className="stat-label">Level Number:</span>
                <span className="stat-value" style={{ fontWeight: 800, color: isSpecial ? '#db2777' : '#7c3aed' }}>Level {session.level.identity.levelNumber || mainLevelNumber}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Images Formed Count:</span>
                <span className="stat-value" style={{ fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
                  {mainImagesFormed} / {totalCategories}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Total Moves:</span>
                <span className="stat-value">{session.moveCount}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Level Status:</span>
                <span className="stat-value">
                  {session.completed ? '✅ Passed' : session.failed ? '❌ Failed / Error' : '⏳ In Progress'}
                </span>
              </div>
            </>
          ) : (
            <div className="stat-row"><span className="stat-label">No level session loaded</span></div>
          )}
        </div>

        <div className="dashboard-section">
          <h3>Automation ({isSpecial ? 'Special' : 'Main'} Puzzle)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className={`button ${isAutoSolving ? 'danger' : ''}`} 
              onClick={onAutoSolveToggle}
              style={{ width: '100%', padding: '10px', backgroundColor: isAutoSolving ? '#ef4444' : isSpecial ? '#db2777' : '#7c3aed', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              {isAutoSolving 
                ? `🛑 Stop Automation (${getModeLabel()})` 
                : `⚡ Auto Solve Level (${getModeLabel()})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="debug-dashboard">
      <div className="dashboard-section">
        <h3>Calendar Hack & Range Controller</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <form onSubmit={handleDateSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', width: '75px', color: '#4b5563' }}>Load Day:</label>
            <input 
              type="date" 
              value={dateInput} 
              onChange={(e) => setDateInput(e.target.value)}
              className="input-field"
              style={{ flex: 1, padding: '6px' }}
            />
            <button type="submit" className="button" style={{ padding: '6px 12px' }}>Load</button>
          </form>

          <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '4px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', width: '75px', color: '#1e293b' }}>Start Date:</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => onStartDateChange(e.target.value)}
                className="input-field"
                style={{ flex: 1, padding: '6px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', width: '75px', color: '#1e293b' }}>End Date:</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => onEndDateChange(e.target.value)}
                className="input-field"
                style={{ flex: 1, padding: '6px' }}
              />
            </div>

            <button 
              onClick={onAutoSolveRange}
              style={{ 
                width: '100%', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                border: 'none', 
                backgroundColor: isRangeAutoSolving ? '#ef4444' : '#2563eb', 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: '14px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: isRangeAutoSolving ? '0 4px 6px rgba(239, 68, 68, 0.3)' : '0 4px 6px rgba(37, 99, 235, 0.3)',
                marginTop: '4px',
                transition: 'all 0.2s ease'
              }}
            >
              {isRangeAutoSolving 
                ? '🛑 Stop Range Auto-Solve' 
                : '⚡ Auto Solve Range'}
            </button>
            {isRangeAutoSolving && (
              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, textAlign: 'center' }}>
                Solving from {startDate} to {endDate}...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Level Info</h3>
        {session ? (
          <>
            <div className="stat-row">
              <span className="stat-label">Level Number:</span>
              <span className="stat-value">{session.level.identity.levelNumber}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Stage Number:</span>
              <span className="stat-value">{session.level.identity.stageNumber}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Moves:</span>
              <span className="stat-value">{session.moveCount}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Status:</span>
              <span className="stat-value">
                {session.completed ? '✅ Completed' : session.failed ? '❌ Failed' : '⏳ In Progress'}
              </span>
            </div>
          </>
        ) : (
          <div className="stat-row"><span className="stat-label">No session loaded</span></div>
        )}
      </div>

      <div className="dashboard-section">
        <h3>Automation</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            className={`button ${isAutoSolving ? 'danger' : ''}`} 
            onClick={onAutoSolveToggle}
            style={{ width: '100%' }}
          >
            {isAutoSolving 
              ? `Stop Automation (${getModeLabel()})` 
              : 'Single Stage Automation Solve'}
          </button>
        </div>
      </div>
    </div>
  );
}

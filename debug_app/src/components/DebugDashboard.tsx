import React, { useState } from 'react';
import type { PuzzleSession } from '../engine/PuzzleModels';

interface DebugDashboardProps {
  currentDate: string;
  onDateChange: (newDate: string) => void;
  session: PuzzleSession | null;
  onAutoSolveToggle: () => void;
  isAutoSolving: boolean;
  autoSolveMode?: 'normal' | 'instinct' | 'anchor' | 'neighbor' | 'semantic' | 'pattern' | 'backtrack' | 'human' | 'random';
}

export function DebugDashboard({
  currentDate,
  onDateChange,
  session,
  onAutoSolveToggle,
  isAutoSolving,
  autoSolveMode = 'instinct'
}: DebugDashboardProps) {
  const [dateInput, setDateInput] = useState(currentDate);

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDateChange(dateInput);
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

  return (
    <div className="debug-dashboard">
      <div className="dashboard-section">
        <h3>Calendar Hack</h3>
        <form onSubmit={handleDateSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="date" 
            value={dateInput} 
            onChange={(e) => setDateInput(e.target.value)}
            className="input-field"
            style={{ flex: 1 }}
          />
          <button type="submit" className="button">Load</button>
        </form>
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
        <button 
          className={`button ${isAutoSolving ? 'danger' : ''}`} 
          onClick={onAutoSolveToggle}
          style={{ width: '100%' }}
        >
          {isAutoSolving 
            ? `Stop Automation (${getModeLabel()})` 
            : 'Automation Solve'}
        </button>
      </div>
    </div>
  );
}

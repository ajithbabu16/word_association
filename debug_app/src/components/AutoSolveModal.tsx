import React, { useState } from 'react';

export type AutoSolveMode = 'normal' | 'random';

interface AutoSolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (mode: AutoSolveMode, speed: number) => void;
  currentMode: AutoSolveMode;
  currentSpeed: number;
}

export function AutoSolveModal({
  isOpen,
  onClose,
  onStart,
  currentMode = 'normal',
  currentSpeed = 1000
}: AutoSolveModalProps) {
  const [selectedMode, setSelectedMode] = useState<AutoSolveMode>(currentMode);
  const [selectedSpeed, setSelectedSpeed] = useState<number>(currentSpeed);

  if (!isOpen) return null;

  const handleStart = () => {
    onStart(selectedMode, selectedSpeed);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Auto Solve Configuration</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="option-section">
            <label className="section-label">Select Solving Logic</label>
            <div className="mode-options">
              <div 
                className={`mode-card ${selectedMode === 'normal' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('normal')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🎯</span>
                  <span className="mode-title">Normal (Smart Solver)</span>
                </div>
                <p className="mode-desc">
                  Uses underlying answer data to group matching category tiles directly into target rows. Fast and efficient.
                </p>
              </div>

              <div 
                className={`mode-card ${selectedMode === 'random' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('random')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🎲</span>
                  <span className="mode-title">Random (Player Simulation)</span>
                </div>
                <p className="mode-desc">
                  Simulates a real player who does not know the answer key. Makes random swaps on unlocked tiles and lets the game engine evaluate matches naturally.
                </p>
              </div>
            </div>
          </div>

          <div className="option-section">
            <label className="section-label">Move Delay / Speed</label>
            <div className="speed-options">
              <button 
                type="button"
                className={`speed-btn ${selectedSpeed === 500 ? 'active' : ''}`}
                onClick={() => setSelectedSpeed(500)}
              >
                ⚡ Fast (0.5s)
              </button>
              <button 
                type="button"
                className={`speed-btn ${selectedSpeed === 1000 ? 'active' : ''}`}
                onClick={() => setSelectedSpeed(1000)}
              >
                ⏱️ Normal (1.0s)
              </button>
              <button 
                type="button"
                className={`speed-btn ${selectedSpeed === 1500 ? 'active' : ''}`}
                onClick={() => setSelectedSpeed(1500)}
              >
                🐢 Slow (1.5s)
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" onClick={handleStart}>
            Start Auto Solve
          </button>
        </div>
      </div>
    </div>
  );
}

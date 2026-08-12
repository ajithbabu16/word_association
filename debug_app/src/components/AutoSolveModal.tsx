import React, { useState } from 'react';

export type AutoSolveMode = 
  | 'normal' 
  | 'instinct' 
  | 'anchor' 
  | 'neighbor' 
  | 'semantic' 
  | 'pattern' 
  | 'backtrack' 
  | 'human' 
  | 'random';

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
  currentMode = 'instinct',
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Auto Solve Configuration</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="option-section">
            <label className="section-label">Select Solving Logic</label>
            <div className="mode-options">
              {/* Normal Cheat */}
              <div 
                className={`mode-card ${selectedMode === 'normal' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('normal')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🎯</span>
                  <span className="mode-title">Normal (Smart Answer Key)</span>
                </div>
                <p className="mode-desc">
                  Uses ground-truth answer keys to group matching tiles into target rows directly (4-8 moves).
                </p>
              </div>

              {/* 1. Human Instinct Mode */}
              <div 
                className={`mode-card ${selectedMode === 'instinct' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('instinct')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🎭</span>
                  <span className="mode-title">1. Human Instinct (70% Smart + 30% Random)</span>
                </div>
                <p className="mode-desc">
                  Simulates human gameplay: 70% smart intuition moves mixed with 30% random exploration moves (~10-20 moves).
                </p>
              </div>

              {/* 2. Anchor & Fill Mode */}
              <div 
                className={`mode-card ${selectedMode === 'anchor' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('anchor')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">⚓</span>
                  <span className="mode-title">2. Anchor & Fill (Target Pursuit)</span>
                </div>
                <p className="mode-desc">
                  Picks a random anchor tile, places it in a target row, and brings candidate tiles into that row until it locks (~12-25 moves).
                </p>
              </div>

              {/* 3. Adjacent Neighbor Shuffle */}
              <div 
                className={`mode-card ${selectedMode === 'neighbor' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('neighbor')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🔀</span>
                  <span className="mode-title">3. Adjacent Neighbor Shuffle (Visual Scan)</span>
                </div>
                <p className="mode-desc">
                  Only swaps adjacent neighboring tiles in horizontal rows to create smooth visual scanning animations (~15-30 moves).
                </p>
              </div>

              {/* Semantic AI */}
              <div 
                className={`mode-card ${selectedMode === 'semantic' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('semantic')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🧠</span>
                  <span className="mode-title">Semantic AI (Word Embeddings)</span>
                </div>
                <p className="mode-desc">
                  Calculates word meaning similarity using natural language clustering blindly (4-10 moves).
                </p>
              </div>

              {/* Pattern Clustering */}
              <div 
                className={`mode-card ${selectedMode === 'pattern' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('pattern')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🔍</span>
                  <span className="mode-title">Pattern & Tile Clustering</span>
                </div>
                <p className="mode-desc">
                  Groups picture vs text tiles, word length, prefixes/suffixes, and compound word pairings (12-25 moves).
                </p>
              </div>

              {/* Backtracking Search Tree */}
              <div 
                className={`mode-card ${selectedMode === 'backtrack' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('backtrack')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🌲</span>
                  <span className="mode-title">Backtracking Search Tree</span>
                </div>
                <p className="mode-desc">
                  Systematically tests tile combinations in random target rows without repeating failed attempts (15-30 moves).
                </p>
              </div>

              {/* Random Half */}
              <div 
                className={`mode-card ${selectedMode === 'human' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('human')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">👤</span>
                  <span className="mode-title">Random Half (Human Simulation)</span>
                </div>
                <p className="mode-desc">
                  Simulates a real player without knowing answers, targeting random horizontal rows (~20-45 moves).
                </p>
              </div>

              {/* Pure Random */}
              <div 
                className={`mode-card ${selectedMode === 'random' ? 'selected' : ''}`}
                onClick={() => setSelectedMode('random')}
              >
                <div className="mode-card-header">
                  <span className="mode-icon">🎲</span>
                  <span className="mode-title">Pure Random (Chaos)</span>
                </div>
                <p className="mode-desc">
                  Random tile swaps across horizontal rows without answer knowledge. Highly unpredictable.
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

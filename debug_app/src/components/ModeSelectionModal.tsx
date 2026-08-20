import React from 'react';
import { Calendar, Layers, CheckCircle2, Sparkles, Play } from 'lucide-react';

interface ModeSelectionModalProps {
  isOpen: boolean;
  activeMode: 'daily' | 'main' | 'prefab' | 'special' | 'testcase';
  onSelectMode: (mode: 'daily' | 'main' | 'prefab' | 'special' | 'testcase') => void;
  onClose?: () => void;
}

export function ModeSelectionModal({
  isOpen,
  activeMode,
  onSelectMode,
  onClose
}: ModeSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            marginBottom: '16px'
          }}>
            <Sparkles size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
            Select Active Mode
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Choose how you would like to test and play Word Association
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
          {/* Daily Puzzle Mode Option */}
          <div 
            onClick={() => onSelectMode('daily')}
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: `2px solid ${activeMode === 'daily' ? '#2563eb' : '#e2e8f0'}`,
              backgroundColor: activeMode === 'daily' ? '#f0f6ff' : '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              position: 'relative'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: activeMode === 'daily' ? '#2563eb' : '#f1f5f9',
              color: activeMode === 'daily' ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Calendar size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Daily Puzzle (DP) Mode
                </h3>
                {activeMode === 'daily' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>
                    <CheckCircle2 size={18} /> Active
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                • 3 progressive stages per calendar day<br />
                • Calendar Hack date picker & range solver<br />
                • Stage tracking & skip controls
              </p>
            </div>
          </div>

          {/* Main Puzzle Mode Option */}
          <div 
            onClick={() => onSelectMode('main')}
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: `2px solid ${activeMode === 'main' ? '#7c3aed' : '#e2e8f0'}`,
              backgroundColor: activeMode === 'main' ? '#f5f3ff' : '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              position: 'relative'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: activeMode === 'main' ? '#7c3aed' : '#f1f5f9',
              color: activeMode === 'main' ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Layers size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Main Puzzle (MP) Mode
                </h3>
                {activeMode === 'main' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#7c3aed' }}>
                    <CheckCircle2 size={18} /> Active
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                • Standalone Main Puzzle levels (12 categories / level)<br />
                • Direct Level Jump controller & level info panel<br />
                • Sequential screenshot capture per image formation & PDF/Excel exports
              </p>
            </div>
          </div>

          {/* Special Puzzle Mode Option */}
          <div 
            onClick={() => onSelectMode('special')}
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: `2px solid ${activeMode === 'special' ? '#db2777' : '#e2e8f0'}`,
              backgroundColor: activeMode === 'special' ? '#fdf2f8' : '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              position: 'relative'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: activeMode === 'special' ? '#db2777' : '#f1f5f9',
              color: activeMode === 'special' ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Special Puzzle (SP) Mode
                </h3>
                {activeMode === 'special' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#db2777' }}>
                    <CheckCircle2 size={18} /> Active
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                • Special / Bonus Puzzle levels<br />
                • Mirrors Main Puzzle Automation behavior<br />
                • Uses special_levels.json
              </p>
            </div>
          </div>

          {/* Prefab Creation Mode Option */}
          <div 
            onClick={() => onSelectMode('prefab')}
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: `2px solid ${activeMode === 'prefab' ? '#10b981' : '#e2e8f0'}`,
              backgroundColor: activeMode === 'prefab' ? '#ecfdf5' : '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              position: 'relative'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: activeMode === 'prefab' ? '#10b981' : '#f1f5f9',
              color: activeMode === 'prefab' ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Prefab Creation (PC) Mode
                </h3>
                {activeMode === 'prefab' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#10b981' }}>
                    <CheckCircle2 size={18} /> Active
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                • Upload PSD/Adobe files to extract assets<br />
                • Automated Cocos Prefab & Scene generation<br />
                • Asset pipeline integration
              </p>
            </div>
          </div>

          {/* Test Case Mode Option */}
          <div 
            onClick={() => onSelectMode('testcase')}
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: `2px solid ${activeMode === 'testcase' ? '#8b5cf6' : '#e2e8f0'}`,
              backgroundColor: activeMode === 'testcase' ? '#f5f3ff' : '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              position: 'relative'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: activeMode === 'testcase' ? '#8b5cf6' : '#f1f5f9',
              color: activeMode === 'testcase' ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Qubit Gen Automation Mode
                </h3>
                {activeMode === 'testcase' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>
                    <CheckCircle2 size={18} /> Active
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                • Upload Presentation Slides (PDF/PPTX)<br />
                • Automated Qubit generation using Gemini AI<br />
                • Export Qubits directly to Excel
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {onClose && (
            <button 
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          )}
          <button 
            onClick={() => {
              onSelectMode(activeMode);
              if (onClose) onClose();
            }}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: activeMode === 'main' ? '#7c3aed' : '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Play size={18} /> Continue with {activeMode === 'main' ? 'Main Puzzle' : activeMode === 'special' ? 'Special Puzzle' : activeMode === 'prefab' ? 'Prefab Creation' : activeMode === 'testcase' ? 'Qubit Gen Automation' : 'Daily Puzzle'} Mode
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PuzzleCellDefinition, PuzzleSession } from '../engine/PuzzleModels';

interface TileProps {
  id: string;
  index: number;
  tileData: PuzzleCellDefinition | null;
  isLocked: boolean;
  color?: string;
  isPicture?: boolean;
  columns?: number;
  isOverTarget?: boolean;
  autoTransform?: { x: number; y: number };
  fallOffsetY?: number;
  session?: PuzzleSession;
  mergeState?: 'none' | 'left' | 'middle' | 'right' | 'full';
}

// ─── Image resolution helper ───────────────────────────────────────────────────
function resolveImageCandidates(category?: string, word?: string): string[] {
  const candidates: string[] = [];
  const toTitle = (s: string) =>
    s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  if (category) {
    const c = category.trim();
    candidates.push(`/puzzle_image/${toTitle(c)}.png`);
    candidates.push(`/puzzle_image/${c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}.png`);
    candidates.push(`/puzzle_image/${c.toLowerCase()}.png`);
    candidates.push(`/puzzle_image/${c}.png`);
  }
  if (word) {
    const w = word.trim();
    candidates.push(`/puzzle_image/${toTitle(w)}.png`);
    candidates.push(`/puzzle_image/${w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()}.png`);
    candidates.push(`/puzzle_image/${w.toLowerCase()}.png`);
    candidates.push(`/puzzle_image/${w}.png`);
  }
  return [...new Set(candidates)];
}

// ─── Picture Card ─────────────────────────────────────────────────────────────
function FormedPictureCard({ word, category, isWhiteMode }: { word: string; category?: string; isWhiteMode?: boolean }) {
  const candidates = React.useMemo(() => resolveImageCandidates(category, word), [category, word]);
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null);
  const [failedAll, setFailedAll] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) {
        if (alive) {
          setFailedAll(true);
          const event = new CustomEvent('image-error', { detail: candidates[0]?.split('/').pop() });
          window.dispatchEvent(event);
        }
        return;
      }
      const img = new Image();
      img.onload = () => { if (alive) { setLoadedSrc(img.src); setFailedAll(false); } };
      img.onerror = () => { idx++; tryNext(); };
      img.src = candidates[idx];
    };
    tryNext();
    return () => { alive = false; };
  }, [candidates]);

  if (failedAll) {
    return (
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        backgroundColor: isWhiteMode ? 'transparent' : '#1a1a1a', color: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        borderRadius: '8px', padding: '4px', boxSizing: 'border-box',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: 4,
          width: 14, height: 14, borderRadius: '50%',
          backgroundColor: '#ef4444', color: '#fff',
          fontSize: 9, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>!</div>
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', color: '#fff' }}>
          {category || word}
        </span>
        <span style={{ fontSize: 7, color: '#ef4444', fontWeight: 700, marginTop: 2 }}>
          NO IMAGE
        </span>
        <span style={{ fontSize: 6, color: '#aaa', marginTop: 2, textAlign: 'center', wordBreak: 'break-all' }}>
          {candidates[0]?.split('/').pop()}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2, padding: '4px 4px 2px', boxSizing: 'border-box',
      backgroundColor: isWhiteMode ? 'transparent' : '#1e293b',
      borderRadius: '8px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {loadedSrc ? (
        <img
          src={loadedSrc}
          alt={category || word}
          style={{
            width: 32,
            height: 32,
            objectFit: 'contain',
            borderRadius: '4px',
            filter: isWhiteMode ? 'brightness(0) invert(1)' : undefined,
            flexShrink: 0,
          }}
        />
      ) : (
        <span style={{ fontSize: 16, flexShrink: 0 }}>🖼️</span>
      )}
      <span style={{
        fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.3px',
        color: isWhiteMode ? '#ffffff' : '#e2e8f0',
        lineHeight: 1.1,
        textAlign: 'center',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {word}
      </span>
    </div>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────
export function Tile({
  id, index, tileData, isLocked, color, isPicture,
  columns = 4, isOverTarget, autoTransform, fallOffsetY = 0,
  session, mergeState
}: TileProps) {
  const {
    attributes, listeners,
    setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id,
    disabled: isLocked || !tileData,
  });

  // ── Fall animation state machine ──────────────────────────────────────────
  const [visualY, setVisualY] = React.useState(0);
  const [isFalling, setIsFalling] = React.useState(false);
  const startTimerRef = React.useRef<any>(null);
  const endTimerRef = React.useRef<any>(null);

  React.useLayoutEffect(() => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);

    if (fallOffsetY !== 0) {
      setIsFalling(true);
      setVisualY(fallOffsetY); // snap to start offset synchronously

      // Frame 1 paint: wait 30ms so browser registers the start offset, then trigger transition
      startTimerRef.current = setTimeout(() => {
        setVisualY(0);
      }, 30);

      // Animation duration is 650ms, clear state after 750ms total
      endTimerRef.current = setTimeout(() => {
        setIsFalling(false);
      }, 750);
    } else {
      setIsFalling(false);
      setVisualY(0);
    }

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, [fallOffsetY, id]);

  const isFormedCard = tileData?.isFormedPictureCard === true;
  const isMergingOut = tileData?.isMergingOut === true;

  // Calculate merge translation offset if this card is collapsing into a picture card
  let activeAutoTransform = autoTransform;
  if (isMergingOut && session) {
    const solvedRow = session.solvedRows.find(r => r.presentation === "merged" && r.tileIds.includes(id));
    if (solvedRow && solvedRow.anchorSlotIndex !== undefined) {
      const anchorCol = solvedRow.anchorSlotIndex % columns;
      const anchorRow = Math.floor(solvedRow.anchorSlotIndex / columns);
      const currentCol = index % columns;
      const currentRow = Math.floor(index / columns);
      activeAutoTransform = {
        x: anchorCol - currentCol,
        y: anchorRow - currentRow,
      };
    }
  }

  // ── Build transform and transition styles ──────────────────────────────────
  let transformStr: string;
  let transitionStr: string;

  if (isFalling) {
    transformStr = `translateY(${visualY}px)`;
    transitionStr = visualY === fallOffsetY
      ? 'none'
      : 'transform 0.4s ease-out';
  } else if (activeAutoTransform) {
    transformStr = `translate(calc(${activeAutoTransform.x} * (100% + 8px)), calc(${activeAutoTransform.y} * (${ROW_HEIGHT}px + ${ROW_GAP}px)))`;
    transitionStr = 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1)';
  } else if (isDragging) {
    transformStr = CSS.Transform.toString(transform) ?? '';
    transitionStr = 'none';
  } else {
    transformStr = '';
    transitionStr = '';
  }

  const isMasterCompleteTile = session?.extraCategoryComplete === true && (index % columns === 0);

  const style: React.CSSProperties = {
    transform: transformStr,
    transition: transitionStr,
    position: 'relative',
    width: '100%',
    height: '100%',
    zIndex: (isDragging || activeAutoTransform || visualY !== 0) ? 100 : (isMasterCompleteTile ? 5 : 1),
    gridColumn: (index % columns) + 1,
    gridRow: Math.floor(index / columns) + 1,
  };

  const innerStyle: React.CSSProperties = {
    opacity: isDragging ? 0.75 : undefined,
    backgroundColor: isMasterCompleteTile ? 'transparent' : (color || undefined),
    boxShadow: isMasterCompleteTile ? 'none' : undefined,
    border: isMasterCompleteTile ? 'none' : (isOverTarget && !isDragging ? '2px dashed var(--accent-color)' : undefined),
    color: (isMasterCompleteTile || (mergeState && mergeState !== 'none')) ? '#ffffff' : undefined,
    boxSizing: 'border-box',
    // Only apply opacity transition for non-merging states; merging-out CSS class handles its own
    transition: isMergingOut ? undefined : 'opacity 0.15s ease',
  };

  if (mergeState === 'left') {
    innerStyle.borderRadius = '12px 0 0 12px';
    innerStyle.borderRight = '1px solid rgba(255, 255, 255, 0.4)';
    innerStyle.width = 'calc(100% + 8px)';
    innerStyle.marginRight = '-8px';
    innerStyle.zIndex = 2; // Keep borders visible
  } else if (mergeState === 'middle') {
    innerStyle.borderRadius = '0';
    innerStyle.borderRight = '1px solid rgba(255, 255, 255, 0.4)';
    innerStyle.width = 'calc(100% + 16px)';
    innerStyle.marginLeft = '-8px';
    innerStyle.marginRight = '-8px';
    innerStyle.zIndex = 2;
  } else if (mergeState === 'right') {
    innerStyle.borderRadius = '0 12px 12px 0';
    innerStyle.width = 'calc(100% + 8px)';
    innerStyle.marginLeft = '-8px';
    innerStyle.zIndex = 1;
  } else if (mergeState === 'full') {
    innerStyle.borderRadius = '12px';
  }

  const classNames = ['tile'];
  if (isLocked) classNames.push('locked');
  if (isFormedCard) classNames.push('picture');
  if (isMergingOut) classNames.push('merging-out');
  if (isDragging) classNames.push('dragging');

  return (
    <div
      className="tile-wrapper"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div style={innerStyle} className={classNames.join(' ')}>
        {tileData ? (
          isFormedCard ? (
            <FormedPictureCard word={tileData.word} category={tileData.category} isWhiteMode={isMasterCompleteTile} />
          ) : (
            tileData.word
          )
        ) : ''}
      </div>
    </div>
  );
}

// ─── Constants exported for PuzzleBoard to use ────────────────────────────────
export const ROW_HEIGHT = 70;
export const ROW_GAP = 24;

import React from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { PuzzleSession } from '../engine/PuzzleModels';
import { Tile } from './Tile';

interface PuzzleBoardProps {
  session: PuzzleSession;
  onSwap: (fromIndex: number, toIndex: number) => void;
  autoSwapAnim?: { from: number; to: number } | null;
  spawnedSlotIndexes?: number[]; // slots that just dropped from the queue
}

const CATEGORY_COLORS = [
  'var(--cat-1)',
  'var(--cat-2)',
  'var(--cat-3)',
  'var(--cat-4)',
  'var(--cat-5)',
  'var(--cat-6)',
];

const ROW_HEIGHT  = 70;   // px — must match .tile height in App.css
const ROW_GAP     = 24;   // px — must match .puzzle-grid row-gap in App.css
const CELL_STRIDE = ROW_HEIGHT + ROW_GAP; // 94px per row

export function PuzzleBoard({ session, onSwap, autoSwapAnim, spawnedSlotIndexes }: PuzzleBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const [overId, setOverId] = React.useState<string | null>(null);

  // ─── Track the two slots involved in the most-recent user drag ────────────
  const lastSwapRef = React.useRef<Set<string>>(new Set());

  const handleDragEnd = (event: DragEndEvent) => {
    setOverId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const fromIndex = session.activeSlots.indexOf(active.id as string);
      const toIndex   = session.activeSlots.indexOf(over.id as string);

      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        const toTile = session.tilesById[over.id as string];
        if (toTile?.isFormedPictureCard && !session.extraCategoryActive) {
          return; // prevent dropping onto a locked formed picture card
        }

        lastSwapRef.current = new Set([active.id as string, over.id as string]);
        onSwap(fromIndex, toIndex);
      }
    }
  };

  const { rows, columns } = session.level.size;

  // Build items array: slot → tileId (or empty placeholder)
  const items = session.activeSlots.map((id, index) => id ? id : `empty-${index}`);

  // ─── Snapshot: previous slot positions keyed by tileId ────────────────────
  // prevSlotsRef holds positions FROM THE LAST RENDER.
  // We read it DURING render (before useLayoutEffect updates it).
  const prevSlotsRef = React.useRef<Map<string, number>>(new Map());
  const isFirstRenderRef = React.useRef(true);

  if (isFirstRenderRef.current) {
    // First render: pre-populate so tiles don't fall on initial load
    isFirstRenderRef.current = false;
    session.activeSlots.forEach((id, i) => { if (id) prevSlotsRef.current.set(id, i); });
  }

  // Set of spawned slot indexes (queue tiles that just appeared)
  const spawnedSet = React.useMemo(
    () => new Set(spawnedSlotIndexes ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(spawnedSlotIndexes ?? []).join(',')]
  );

  // ─── Compute per-tile fall offsets ────────────────────────────────────────
  // IMPORTANT: We read prevSlotsRef.current (the OLD snapshot) during the current render.
  // This is safe because useLayoutEffect runs AFTER render and updates it.
  // We use a renderCounter as a dep to force re-computation every render.
  const renderCounterRef = React.useRef(0);
  renderCounterRef.current += 1;

  const fallOffsets = React.useMemo(() => {
    const prev    = prevSlotsRef.current;
    const swapped = lastSwapRef.current;
    const offsets = new Map<string, number>();

    items.forEach((tileId, newIndex) => {
      if (tileId.startsWith('empty')) return;
      if (swapped.has(tileId)) return;  // dragged tiles skip fall anim

      const prevIndex = prev.get(tileId);

      if (prevIndex === undefined) {
        // Brand-new tile (from queue) — animate falling in from above HUD
        if (spawnedSet.has(newIndex)) {
          const currentRow = Math.floor(newIndex / columns);
          offsets.set(tileId, -((currentRow + 1) * CELL_STRIDE));
        }
      } else if (prevIndex !== newIndex) {
        // Existing tile that shifted slot (gravity fall or bubble up)
        const prevRow = Math.floor(prevIndex / columns);
        const newRow  = Math.floor(newIndex  / columns);
        const rowDiff = newRow - prevRow;
        if (rowDiff !== 0) {
          // Tile moved vertically — start it at its previous absolute position and animate
          offsets.set(tileId, -(rowDiff * CELL_STRIDE));
        }
      }
    });

    return offsets;
  // renderCounterRef.current changes every render — forces memo to recompute so it
  // always reads the freshest prevSlotsRef before useLayoutEffect overwrites it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderCounterRef.current]);

  // ─── Update snapshot AFTER each render ────────────────────────────────────
  React.useLayoutEffect(() => {
    const nextMap = new Map<string, number>();
    items.forEach((tileId, index) => {
      if (!tileId.startsWith('empty')) nextMap.set(tileId, index);
    });
    prevSlotsRef.current = nextMap;
    lastSwapRef.current = new Set(); // clear after every render
  });

  // ─── Slot colour helper ────────────────────────────────────────────────────
  const getSlotStatus = (index: number) => {
    const solvedRow = session.solvedRows.find(row => {
      if (row.isPictureCategory) {
        // Picture categories do not color slots as they are playable tiles that move
        return false;
      }
      return row.slotIndexes.includes(index);
    });
    if (solvedRow) return { color: CATEGORY_COLORS[solvedRow.order % CATEGORY_COLORS.length] };
    return { color: undefined };
  };

  return (
    <div className="puzzle-board">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={(e) => {
          const overTileId = e.over?.id ? (e.over.id as string) : null;
          if (overTileId && !overTileId.startsWith('empty')) {
            const tile = session.tilesById[overTileId];
            if (tile?.isFormedPictureCard && !session.extraCategoryActive) {
              setOverId(null);
              return;
            }
          }
          setOverId(overTileId);
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setOverId(null)}
      >
        <SortableContext items={items} strategy={() => null}>
          <div
            className="puzzle-grid"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, ${ROW_HEIGHT}px)`,
            }}
          >
            {/* Red column overlay — master category */}
            {session.level.extraCategory && session.extraCategoryActive && (
              <div
                className="master-category-column"
                style={{
                  gridColumn: '1 / span 1',
                  gridRow: `1 / span ${rows}`,
                  border: '3px solid #dc2626',
                  borderRadius: '10px',
                  backgroundColor: session.extraCategoryComplete
                    ? 'rgba(220, 38, 38, 0.85)'
                    : 'rgba(220, 38, 38, 0.08)',
                  position: 'relative',
                  zIndex: 2,
                  pointerEvents: 'none',
                  transition: 'background-color 0.6s ease',
                  boxShadow: '0 0 16px rgba(220, 38, 38, 0.4)',
                }}
              >
                {/* Master Category Title Tab */}
                <div
                  className="category-banner"
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '12px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                  }}
                >
                  {session.level.extraCategory.toUpperCase()}
                </div>
                {/* Complete Fill Element */}
                {session.extraCategoryComplete && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#dc2626',
                      borderRadius: '8px',
                      animation: 'verticalWipe 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                      zIndex: -1,
                    }}
                  />
                )}
              </div>
            )}

            {/* Row banners for locked text categories */}
            {session.solvedRows
              .filter(row => !row.isPictureCategory)
              .map(row => {
                const rowIdx = Math.floor(row.slotIndexes[0] / columns) + 1;
                const color  = CATEGORY_COLORS[row.order % CATEGORY_COLORS.length];
                const gridColumnStr = session.extraCategoryActive
                  ? `2 / span ${columns - 1}`
                  : `1 / span ${columns}`;
                return (
                  <div
                    key={`bg-${row.order}`}
                    className="row-background"
                    style={{ gridColumn: gridColumnStr, gridRow: rowIdx, backgroundColor: color }}
                  >
                    <div className="category-banner" style={{ backgroundColor: color, color: '#ffffff' }}>
                      {row.category.toUpperCase()}
                    </div>
                  </div>
                );
              })}

            {/* Tiles */}
            {items.map((tileId, index) => {
              const tileData  = tileId.startsWith('empty') ? null : session.tilesById[tileId];
              const isLocked  = session.lockedSlotIndexes.includes(index) || 
                                (!!tileData?.isFormedPictureCard && !session.extraCategoryActive);
              const { color } = getSlotStatus(index);
              const isPicture = session.solvedRows.some(
                row => row.anchorSlotIndex === index && row.isPictureCategory
              );
              const fallOffsetY = fallOffsets.get(tileId) ?? 0;

              let autoTransform: { x: number; y: number } | undefined;
              if (autoSwapAnim) {
                if (index === autoSwapAnim.from) {
                  autoTransform = {
                    x: (autoSwapAnim.to % columns) - (index % columns),
                    y: Math.floor(autoSwapAnim.to / columns) - Math.floor(index / columns),
                  };
                } else if (index === autoSwapAnim.to) {
                  autoTransform = {
                    x: (autoSwapAnim.from % columns) - (index % columns),
                    y: Math.floor(autoSwapAnim.from / columns) - Math.floor(index / columns),
                  };
                }
              }

              return (
                <Tile
                  key={tileId}
                  id={tileId}
                  index={index}
                  tileData={tileData}
                  isLocked={isLocked}
                  color={color}
                  isPicture={isPicture}
                  columns={columns}
                  isOverTarget={overId === tileId}
                  autoTransform={autoTransform}
                  fallOffsetY={fallOffsetY}
                  session={session}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

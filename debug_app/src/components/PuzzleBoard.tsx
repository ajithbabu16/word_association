import React, { useState } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSwappingStrategy } from '@dnd-kit/sortable';
import type { PuzzleSession } from '../engine/PuzzleModels';
import { Tile } from './Tile';

interface PuzzleBoardProps {
  session: PuzzleSession;
  onSwap: (fromIndex: number, toIndex: number) => void;
  autoSwapAnim?: { from: number; to: number } | null;
}

const CATEGORY_COLORS = [
  'var(--cat-1)',
  'var(--cat-2)',
  'var(--cat-3)',
  'var(--cat-4)',
  'var(--cat-5)',
  'var(--cat-6)',
];

export function PuzzleBoard({ session, onSwap, autoSwapAnim }: PuzzleBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );

  const [overId, setOverId] = useState<string | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    setOverId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Find indexes based on the activeSlots array order
      const fromIndex = session.activeSlots.indexOf(active.id as string);
      const toIndex = session.activeSlots.indexOf(over.id as string);
      
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        onSwap(fromIndex, toIndex);
      }
    }
  };

  const { rows, columns } = session.level.size;
  
  // The items array must contain unique string IDs for SortableContext
  const items = session.activeSlots.map((id, index) => id ? id : `empty-${index}`);

  const getSlotStatus = (index: number) => {
    const solvedRow = session.solvedRows.find(row => row.slotIndexes.includes(index));
    if (solvedRow) {
      return {
        color: CATEGORY_COLORS[solvedRow.order % CATEGORY_COLORS.length]
      };
    }
    return { color: undefined };
  };

  return (
    <div className="board-container">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={(e) => setOverId(e.over?.id ? (e.over.id as string) : null)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setOverId(null)}
      >
        <SortableContext items={items} strategy={() => null}>
          <div 
            className="puzzle-grid" 
            style={{ 
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, 70px)`
            }}
          >
            {/* Render row backgrounds behind tiles */}
            {session.solvedRows.map(row => {
              const rowIdx = Math.floor(row.slotIndexes[0] / columns) + 1;
              const color = CATEGORY_COLORS[row.order % CATEGORY_COLORS.length];
              return (
                <div 
                  key={`bg-${row.order}`}
                  className="row-background"
                  style={{
                    gridColumn: `1 / span ${columns}`,
                    gridRow: rowIdx,
                    backgroundColor: color
                  }}
                >
                  <div className="category-banner" style={{ backgroundColor: color }}>
                    {row.category}
                  </div>
                </div>
              );
            })}
            
            {items.map((tileId, index) => {
              const tileData = tileId.startsWith('empty') ? null : session.tilesById[tileId];
              const isLocked = session.lockedSlotIndexes.includes(index);
              const { color } = getSlotStatus(index);
              const isPicture = session.solvedRows.some(row => row.anchorSlotIndex === index && row.isPictureCategory);

              let autoTransform;
              if (autoSwapAnim) {
                if (index === autoSwapAnim.from) {
                  const toCol = autoSwapAnim.to % columns;
                  const toRow = Math.floor(autoSwapAnim.to / columns);
                  const fromCol = index % columns;
                  const fromRow = Math.floor(index / columns);
                  autoTransform = { x: toCol - fromCol, y: toRow - fromRow };
                } else if (index === autoSwapAnim.to) {
                  const toCol = autoSwapAnim.from % columns;
                  const toRow = Math.floor(autoSwapAnim.from / columns);
                  const fromCol = index % columns;
                  const fromRow = Math.floor(index / columns);
                  autoTransform = { x: toCol - fromCol, y: toRow - fromRow };
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
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

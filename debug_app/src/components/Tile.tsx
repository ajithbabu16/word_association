import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PuzzleCellDefinition } from '../engine/PuzzleModels';

interface TileProps {
  id: string;
  index: number;
  tileData: PuzzleCellDefinition | null;
  isLocked: boolean;
  color?: string;
  isPicture?: boolean;
  columns?: number;
  isOverTarget?: boolean;
  autoTransform?: { x: number, y: number };
}

export function Tile({ id, index, tileData, isLocked, color, isPicture, columns = 4, isOverTarget, autoTransform }: TileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !tileData,
  });

  const style: React.CSSProperties = {
    transform: autoTransform ? `translate(calc(${autoTransform.x} * 100% + ${autoTransform.x} * 8px), calc(${autoTransform.y} * 100% + ${autoTransform.y} * 24px))` : CSS.Transform.toString(transform),
    transition: autoTransform ? 'transform 0.4s ease' : transition,
    position: 'relative',
    width: '100%',
    height: '100%',
    zIndex: (isDragging || autoTransform) ? 100 : 1,
    gridColumn: (index % columns) + 1,
    gridRow: Math.floor(index / columns) + 1,
  };

  const tileInnerStyle: React.CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    backgroundColor: color ? color : undefined,
    border: isOverTarget && !isDragging ? '2px dashed var(--accent-color)' : undefined,
    boxSizing: 'border-box'
  } as React.CSSProperties;

  const classNames = ['tile'];
  if (isLocked) classNames.push('locked');
  if (isPicture) classNames.push('picture');
  if (isDragging) classNames.push('dragging');

  return (
    <div 
      className="tile-wrapper"
      ref={setNodeRef} 
      style={style}
      {...attributes}
      {...listeners}
    >
      <div
        style={tileInnerStyle}
        className={classNames.join(' ')}
      >
        {tileData ? (isPicture ? `🖼️ ${tileData.word}` : tileData.word) : ''}
      </div>
    </div>
  );
}

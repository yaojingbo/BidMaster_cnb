'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type ResizableSplitProps = {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey: string;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
};

export function ResizableSplit({
  left,
  right,
  storageKey,
  defaultLeftWidth = 520,
  minLeftWidth = 300,
  maxLeftWidth = 960,
  className,
}: ResizableSplitProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    const value = Number(saved);
    if (Number.isFinite(value)) {
      setLeftWidth(Math.min(Math.max(value, minLeftWidth), maxLeftWidth));
    }
  }, [maxLeftWidth, minLeftWidth, storageKey]);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nextWidth = Math.min(
        Math.max(event.clientX - rect.left, minLeftWidth),
        Math.min(maxLeftWidth, rect.width - minLeftWidth)
      );
      setLeftWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setDragging(false);
      window.localStorage.setItem(storageKey, String(Math.round(leftWidth)));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, leftWidth, maxLeftWidth, minLeftWidth, storageKey]);

  return (
    <div className={cn('grid grid-cols-1 gap-8 xl:block', className)} ref={containerRef}>
      <div
        className="hidden xl:grid xl:items-start xl:gap-0"
        style={{ gridTemplateColumns: `${leftWidth}px 1rem minmax(0, 1fr)` }}
      >
        <div className="min-w-0">{left}</div>
        <button
          type="button"
          aria-label="拖动调整左右栏宽度"
          className={cn(
            'group flex h-full min-h-[520px] cursor-col-resize items-stretch justify-center outline-none',
            dragging && 'cursor-col-resize'
          )}
          onPointerDown={event => {
            event.preventDefault();
            setDragging(true);
          }}
        >
          <span className="my-1 w-px rounded-full bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
        </button>
        <div className="min-w-0">{right}</div>
      </div>
      <div className="grid grid-cols-1 gap-8 xl:hidden">
        <div>{left}</div>
        <div>{right}</div>
      </div>
    </div>
  );
}

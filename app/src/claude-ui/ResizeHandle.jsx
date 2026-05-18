import { useRef, useState } from 'react';

/**
 * A 5px draggable handle for resizing side or stacked panels.
 *
 * Props:
 *   direction: 'horizontal' | 'vertical' (default 'horizontal')
 *              — horizontal handle for side-by-side panels (col-resize cursor,
 *                emits dx); vertical handle for top/bottom-stacked panels
 *                (row-resize cursor, emits dy).
 *   side: 'left' | 'right' | 'top' | 'bottom' — which edge of the parent the
 *         handle sits on (so we can pull the 5px hit-area into the parent's
 *         border for reliable grabbing).
 *   onResize(deltaPx) — per-tick delta on the appropriate axis. Caller clamps.
 *
 * Drag uses Pointer Events with capture, so once the down fires the cursor
 * stays "locked" to the handle even as the panel underneath resizes.
 */
export function ResizeHandle({ direction = 'horizontal', side = 'right', onResize }) {
  const ref = useRef(null);
  const dragRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isVertical = direction === 'vertical';

  function onDown(e) {
    e.preventDefault(); e.stopPropagation();
    try { ref.current?.setPointerCapture(e.pointerId); } catch {}
    const start = isVertical ? e.clientY : e.clientX;
    dragRef.current = { pointerId: e.pointerId, last: start };
    setDragging(true);
  }
  function onMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const cur = isVertical ? e.clientY : e.clientX;
    const delta = cur - d.last;
    if (delta !== 0) {
      d.last = cur;
      onResize?.(delta);
    }
  }
  function onUp(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
    setDragging(false);
  }

  const sizeStyle = isVertical
    ? { height: 5, width: '100%', cursor: 'row-resize',
        marginTop:    side === 'top'    ? -3 : 0,
        marginBottom: side === 'bottom' ? -3 : 0 }
    : { width: 5, height: '100%', cursor: 'col-resize',
        marginLeft:  side === 'left'  ? -3 : 0,
        marginRight: side === 'right' ? -3 : 0 };

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sizeStyle,
        background: dragging || hover ? '#6c63ff' : 'transparent',
        flexShrink: 0,
        zIndex: 100,
        transition: 'background 0.15s ease',
      }}
    />
  );
}

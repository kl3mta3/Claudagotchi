import { useRef, useState } from 'react';

/**
 * A 5px draggable vertical handle for resizing side panels.
 *
 * Props:
 *   side: 'left' | 'right'  — which edge of the parent panel the handle sits on
 *   onResize(deltaPx)       — called continuously with the cumulative cursor delta
 *
 * Drag uses Pointer Events with capture, so once the down fires the cursor
 * stays "locked" to the handle even as the panel underneath resizes. Caller
 * is responsible for clamping the resulting width.
 */
export function ResizeHandle({ side = 'right', onResize }) {
  const ref = useRef(null);
  const dragRef = useRef(null);     // { startX, pointerId }
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  function onDown(e) {
    e.preventDefault(); e.stopPropagation();
    try { ref.current?.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { startX: e.clientX, pointerId: e.pointerId, lastX: e.clientX };
    setDragging(true);
  }
  function onMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    // Emit per-tick delta (not cumulative) so the caller can simply add it.
    const delta = e.clientX - d.lastX;
    if (delta !== 0) {
      d.lastX = e.clientX;
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
        width: 5,
        cursor: 'col-resize',
        background: dragging || hover ? '#6c63ff' : 'transparent',
        flexShrink: 0,
        // Pull the handle to overlap the panel edge slightly so the entire 5px
        // strip remains hittable even when adjacent containers have borders.
        marginLeft:  side === 'left'  ? -3 : 0,
        marginRight: side === 'right' ? -3 : 0,
        zIndex: 100,
        transition: 'background 0.15s ease',
      }}
    />
  );
}

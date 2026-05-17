import { useEffect, useState } from 'react';

// Module-level cache so the same image is only loaded once even when it
// renders in the chip AND inline in the chat. Cleared on app reload.
const cache = new Map(); // path → dataUrl | 'pending' | 'error'

export const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg',
]);

export function isImagePath(p) {
  if (!p) return false;
  const ext = String(p).split('.').pop()?.toLowerCase();
  return IMAGE_EXTS.has(ext);
}

/**
 * ImagePreview — loads a local image via IPC (as a base64 data URL) and
 * renders it. Works in both dev (http://) and packaged (file://) without
 * tripping Electron's webSecurity.
 *
 * Props:
 *   path        absolute filesystem path
 *   maxWidth    px ceiling (default 240)
 *   maxHeight   px ceiling (default 240)
 *   onError     optional callback when load fails
 */
export function ImagePreview({ path, maxWidth = 240, maxHeight = 240, onError, style }) {
  const [state, setState] = useState(() => cache.get(path) || null);

  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    const cached = cache.get(path);
    if (typeof cached === 'string' && cached.startsWith('data:')) {
      setState(cached); return;
    }
    if (cached === 'pending') return;
    cache.set(path, 'pending');
    (async () => {
      const result = await window.claudigotchi?.readImageDataUrl?.(path);
      if (cancelled) return;
      if (result?.ok && result.dataUrl) {
        cache.set(path, result.dataUrl);
        setState(result.dataUrl);
      } else {
        cache.set(path, 'error');
        setState('error');
        onError?.(result?.error || 'failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, [path]);

  if (state === 'error') {
    return <div style={{ ...S.err, ...style }}>image failed to load</div>;
  }
  if (!state) {
    return <div style={{ ...S.skeleton, ...style, maxWidth, maxHeight }} />;
  }
  return (
    <img
      src={state}
      alt={path?.split(/[\\/]/).pop() || ''}
      style={{ maxWidth, maxHeight, borderRadius: 6, display: 'block', objectFit: 'contain', ...style }}
    />
  );
}

const S = {
  skeleton: { background: '#15151b', border: '1px solid #1f1f28', borderRadius: 6, minWidth: 48, minHeight: 48 },
  err:      { padding: '6px 10px', background: '#3a1a1a', color: '#ff8d8d', borderRadius: 6, fontSize: 10 },
};

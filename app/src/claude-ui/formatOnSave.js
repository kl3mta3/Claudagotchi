/**
 * formatOnSave — Prettier-based formatter invoked from the editor's Save
 * button. Loaded lazily (~150 KB of plugins) so it doesn't bloat startup.
 *
 * Returns the formatted text, or the original on any failure. Never throws;
 * a malformed file should still be saved as-is rather than be lost.
 */

// Cache the loaded prettier module + per-parser plugins so subsequent saves
// don't re-import.
let prettierMod = null;
const plugins = {};

async function loadPrettier() {
  if (prettierMod) return prettierMod;
  // Use the standalone build (works in renderer context / browser-like).
  prettierMod = await import('prettier/standalone');
  return prettierMod;
}

async function loadPlugin(parser) {
  if (plugins[parser]) return plugins[parser];
  switch (parser) {
    case 'babel':
    case 'babel-flow':
    case 'json':
      plugins[parser] = [
        (await import('prettier/plugins/babel')).default,
        (await import('prettier/plugins/estree')).default,
      ];
      return plugins[parser];
    case 'typescript':
      plugins[parser] = [
        (await import('prettier/plugins/typescript')).default,
        (await import('prettier/plugins/estree')).default,
      ];
      return plugins[parser];
    case 'html':
      plugins[parser] = [(await import('prettier/plugins/html')).default];
      return plugins[parser];
    case 'css':
    case 'scss':
    case 'less':
      plugins[parser] = [(await import('prettier/plugins/postcss')).default];
      return plugins[parser];
    case 'markdown':
      plugins[parser] = [(await import('prettier/plugins/markdown')).default];
      return plugins[parser];
    case 'yaml':
      plugins[parser] = [(await import('prettier/plugins/yaml')).default];
      return plugins[parser];
  }
  return null;
}

function parserFor(ext) {
  switch ((ext || '').toLowerCase()) {
    case 'js': case 'jsx': case 'mjs': case 'cjs': return 'babel';
    case 'ts':                                      return 'typescript';
    case 'tsx':                                     return 'typescript';
    case 'json': case 'jsonc':                      return 'json';
    case 'html': case 'htm':                        return 'html';
    case 'css': case 'scss': case 'less':           return 'css';
    case 'md': case 'markdown':                     return 'markdown';
    case 'yml': case 'yaml':                        return 'yaml';
    default: return null;
  }
}

/**
 * Run Prettier on the buffer. Returns the formatted text, or the original
 * text if there's no parser for the extension OR if Prettier throws.
 */
export async function formatBufferIfPossible(text, ext) {
  const parser = parserFor(ext);
  if (!parser) return text;
  try {
    const prettier = await loadPrettier();
    const plugs = await loadPlugin(parser);
    if (!plugs) return text;
    return await prettier.format(text, {
      parser,
      plugins: plugs,
      // Sensible defaults; users can override later via a .prettierrc lookup.
      printWidth: 100,
      tabWidth: 2,
      singleQuote: true,
      trailingComma: 'es5',
      semi: true,
    });
  } catch (e) {
    // Malformed code → don't lose the user's text. Log to console for debug.
    console.warn('[format-on-save] failed:', e?.message || e);
    return text;
  }
}

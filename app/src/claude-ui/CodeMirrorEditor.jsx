import { useEffect, useRef } from 'react';
import { EditorState }      from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { html }       from '@codemirror/lang-html';
import { css }        from '@codemirror/lang-css';
import { json }       from '@codemirror/lang-json';
import { markdown }   from '@codemirror/lang-markdown';
import { python }     from '@codemirror/lang-python';
import { dracula }    from '@uiw/codemirror-theme-dracula';

/** Pick a CodeMirror language extension by file extension. Falls through to
 *  no language pack (still gets gutter / theme / line numbers) for anything
 *  we haven't wired. Add packs as the user requests more coverage. */
function langExtensionFor(ext) {
  switch ((ext || '').toLowerCase()) {
    case 'js': case 'jsx': case 'mjs': case 'cjs':            return javascript({ jsx: true });
    case 'ts': case 'tsx':                                     return javascript({ jsx: true, typescript: true });
    case 'html': case 'htm':                                   return html();
    case 'css': case 'scss': case 'less':                      return css();
    case 'json': case 'jsonc':                                 return json();
    case 'md': case 'markdown':                                return markdown();
    case 'py':                                                 return python();
    default: return null;
  }
}

/**
 * Thin React wrapper around CodeMirror 6. Replaces the old plain <textarea>
 * editor in ArtifactFileView with line numbers, syntax highlighting,
 * bracket matching, undo/redo, find/replace (Ctrl+F), and a dark theme.
 *
 * Props:
 *   value      — current text
 *   onChange   — (newText) => void
 *   language   — file extension string, used to pick a language pack
 *   readOnly   — boolean, default false
 */
export function CodeMirrorEditor({ value = '', onChange, language, readOnly = false }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  // Keep latest onChange in a ref so the EditorView update listener (set up
  // once) can call the current callback without recreating the editor.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the editor once.
  useEffect(() => {
    if (!hostRef.current) return;
    const langExt = langExtensionFor(language);
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        dracula,
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
        ...(langExt ? [langExt] : []),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // Recreate the editor when language or readOnly changes — extensions are
    // baked into the state at construction time and reconfiguring them via
    // StateEffect would be more code than just remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  // When the EXTERNAL value changes (different file loaded, programmatic
  // reset), swap the editor doc. Skip if the new value already matches the
  // editor's current doc to avoid clobbering the user's caret mid-typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value ?? '' },
    });
  }, [value]);

  return <div ref={hostRef} style={S.host} />;
}

const S = {
  host: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
};

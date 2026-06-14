import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, search } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { bracketMatching, indentOnInput } from "@codemirror/language";

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "'Fira Mono', 'Cascadia Code', 'Consolas', monospace",
    backgroundColor: "#1e1e1e",
  },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { padding: "8px 0", caretColor: "#aeafad" },
  ".cm-gutters": {
    backgroundColor: "#1e1e1e",
    borderRight: "1px solid #3c3c3c",
    color: "#4a4a4a",
    minWidth: "36px",
  },
  ".cm-lineNumbers .cm-gutterElement": { paddingLeft: "8px", paddingRight: "8px" },
  ".cm-activeLine": { backgroundColor: "#2a2a2a" },
  ".cm-activeLineGutter": { backgroundColor: "#252525" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#264f78 !important" },
  ".cm-searchMatch": { backgroundColor: "#613315", outline: "1px solid #f6b73c" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#f6b73c33" },
  ".cm-panels": { backgroundColor: "#252526", borderTop: "1px solid #3c3c3c" },
  ".cm-panel": { padding: "6px 8px" },
  ".cm-panel input": {
    backgroundColor: "#3c3c3c",
    border: "1px solid #555",
    borderRadius: "3px",
    color: "#d4d4d4",
    padding: "2px 6px",
    fontSize: "12px",
  },
  ".cm-panel button": {
    backgroundColor: "#0e639c",
    color: "white",
    border: "none",
    borderRadius: "3px",
    padding: "2px 8px",
    fontSize: "12px",
    cursor: "pointer",
    marginLeft: "4px",
  },
  ".cm-panel label": { color: "#aaa", fontSize: "12px", marginLeft: "6px" },
  ".cm-tooltip": { backgroundColor: "#252526", border: "1px solid #3c3c3c" },
  ".cm-tooltip-autocomplete ul li": { color: "#d4d4d4" },
});

export default function JsonEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const startState = EditorState.create({
      doc: value || "",
      extensions: [
        oneDark,
        theme,
        json(),
        history(),
        lineNumbers(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        indentOnInput(),
        search({ top: false }),
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state: startState, parent: containerRef.current });
    viewRef.current = view;

    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  // Sync external value changes (e.g. loading from collection)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value || "" },
      });
    }
  }, [value]);

  const handleBeautify = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const raw = view.state.doc.toString();
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      view.dispatch({
        changes: { from: 0, to: raw.length, insert: pretty },
      });
    } catch {
      // not valid JSON — do nothing
    }
  }, []);

  const handleMinify = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const raw = view.state.doc.toString();
    try {
      const mini = JSON.stringify(JSON.parse(raw));
      view.dispatch({
        changes: { from: 0, to: raw.length, insert: mini },
      });
    } catch {
      // not valid JSON — do nothing
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        <button
          onClick={handleBeautify}
          className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition-colors"
        >
          Beautify
        </button>
        <button
          onClick={handleMinify}
          className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition-colors"
        >
          Minify
        </button>
        <span className="text-gray-700 text-xs">|</span>
        <span className="text-[10px] text-gray-600">⌘F — Find &amp; Replace</span>
        <span className="text-[10px] text-gray-600">Tab — indent</span>
      </div>
      {/* Editor */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}

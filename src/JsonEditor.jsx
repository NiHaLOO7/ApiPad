import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import {
  searchKeymap, search,
  SearchQuery, setSearchQuery, getSearchQuery,
  findNext, findPrevious,
  replaceNext as cmReplaceNext, replaceAll as cmReplaceAll,
  closeSearchPanel,
} from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { bracketMatching, indentOnInput } from "@codemirror/language";

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily: "'Cascadia Code', 'Fira Mono', 'Consolas', monospace",
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
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#f6b73c44" },
  ".cm-panels.cm-panels-top": {
    position: "absolute",
    top: "0",
    right: "0",
    left: "auto",
    zIndex: "100",
    pointerEvents: "none",
    backgroundColor: "transparent",
    border: "none",
    padding: "0",
  },
  ".cm-tooltip": {
    backgroundColor: "#252526",
    border: "1px solid #454545",
    borderRadius: "4px",
  },
});

// ─── SVG icons ───────────────────────────────────────────────
const SVG = {
  prevMatch: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V4M4 8l4-4 4 4"/></svg>`,
  nextMatch: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v8M4 8l4 4 4-4"/></svg>`,
  close:     `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
  chevron:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>`,
  replaceOne:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  replaceAll:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="M3 20h9"/><circle cx="20" cy="20" r="1" fill="currentColor"/></svg>`,
};

// ─── Panel factory ────────────────────────────────────────────
function makeSearchPanelCreator(readOnly) {
  return function(view) {
    // helpers
    function el(tag, css, props) {
      const e = document.createElement(tag);
      if (css) e.style.cssText = css;
      if (props) Object.assign(e, props);
      return e;
    }

    function mkIconToggle(html, title) {
      const b = el("button",
        `background:none;border:1px solid transparent;border-radius:3px;
         color:#858585;cursor:pointer;height:20px;padding:0 3px;min-width:22px;
         display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;`,
        { type: "button", title, innerHTML: html });
      let on = false;
      const refresh = () => {
        b.style.background   = on ? "#0e639c44" : "none";
        b.style.borderColor  = on ? "#0e639c"   : "transparent";
        b.style.color        = on ? "#d4d4d4"   : "#858585";
      };
      b.setOn  = (v) => { on = v; refresh(); };
      b.isOn   = () => on;
      b.onmouseenter = () => { if (!on) b.style.background = "#3c3c3c"; };
      b.onmouseleave = () => { if (!on) b.style.background = "none"; };
      return b;
    }

    function mkNavBtn(html, title, onclick) {
      const b = el("button",
        `background:none;border:none;border-radius:3px;color:#858585;
         cursor:pointer;width:22px;height:22px;padding:0;
         display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;`,
        { type: "button", title, innerHTML: html });
      if (onclick) b.onclick = onclick;
      b.onmouseenter = () => { b.style.background = "#3c3c3c"; b.style.color = "#d4d4d4"; };
      b.onmouseleave = () => { b.style.background = "none";    b.style.color = "#858585"; };
      return b;
    }

    function mkInput(placeholder, name) {
      return el("input",
        `flex:1;background:transparent;border:none;outline:none;
         color:#d4d4d4;font-size:12px;padding:0 6px;height:100%;
         font-family:system-ui;min-width:0;`,
        { type: "text", placeholder, name });
    }

    function wrapBox() {
      return el("div",
        `display:flex;align-items:center;flex:1;height:24px;
         background:#3c3c3c;border:1px solid transparent;border-radius:2px;
         min-width:120px;overflow:hidden;`);
    }

    // ── state ──
    let replaceOpen = false;

    // ── root — grid: [chevron] [input-area] [nav+close] ──
    // input-area column is the same width for both rows via CSS grid
    const dom = el("div",
      `pointer-events:auto;
       display:grid;
       grid-template-columns:20px 1fr auto;
       align-items:center;
       gap:3px;
       padding:4px 5px;
       margin:6px;
       background:#252526;
       border:1px solid #454545;
       border-radius:6px;
       box-shadow:0 3px 18px rgba(0,0,0,.65);
       width:360px;
       font-family:system-ui,sans-serif;`);

    // Col A: chevron (row 1) / spacer (row 2)
    const chevronBtn = mkNavBtn(SVG.chevron, "Toggle Replace");
    chevronBtn.style.cssText += "transition:transform .15s;width:20px;height:20px;";
    if (readOnly) {
      chevronBtn.style.visibility = "hidden";
      chevronBtn.style.pointerEvents = "none";
    } else {
      chevronBtn.onclick = () => {
        replaceOpen = !replaceOpen;
        chevronBtn.style.transform = replaceOpen ? "rotate(90deg)" : "";
        replaceRow.style.display = replaceOpen ? "contents" : "none";
      };
    }

    // Col B row1: find input
    const fWrap = wrapBox();
    fWrap.style.cssText += "height:22px;";
    const findInput = mkInput("Find", "search");
    findInput.onfocus = () => { fWrap.style.borderColor = "#0e639c"; };
    findInput.onblur  = () => { fWrap.style.borderColor = "transparent"; };

    const countEl = el("span",
      `color:#858585;font-size:11px;white-space:nowrap;padding:0 4px 0 2px;flex-shrink:0;`);
    const caseBtn = mkIconToggle(`<span style="font-weight:700;font-size:11px">Aa</span>`, "Match Case (Alt+C)");
    const wordBtn = mkIconToggle(`<span style="font-size:11px;font-weight:700;text-decoration:underline">ab</span>`, "Match Whole Word (Alt+W)");
    const reBtn   = mkIconToggle(`<span style="font-size:12px;font-family:'Cascadia Code','Consolas',monospace;font-weight:700">.*</span>`, "Use Regular Expression (Alt+R)");
    const iconsWrap = el("div", "display:flex;align-items:center;gap:1px;padding:0 2px 0 0;flex-shrink:0;");
    iconsWrap.append(caseBtn, wordBtn, reBtn);
    fWrap.append(findInput, countEl, iconsWrap);

    // Col C row1: prev + next + close
    const navWrap = el("div", "display:flex;align-items:center;gap:1px;");
    const prevBtn  = mkNavBtn(SVG.prevMatch, "Previous Match (Shift+Enter)", () => findPrevious(view));
    const nextBtn  = mkNavBtn(SVG.nextMatch, "Next Match (Enter)",           () => findNext(view));
    const closeBtn = mkNavBtn(SVG.close,     "Close (Escape)",               () => closeSearchPanel(view));
    navWrap.append(prevBtn, nextBtn, closeBtn);

    // Row 1 cells into grid
    dom.append(chevronBtn, fWrap, navWrap);

    // ── Replace row — 3 separate grid cells, hidden via a class ──
    if (!readOnly) {
      const chevSpacer = el("div", "");
      const rWrap = wrapBox();
      rWrap.style.cssText += "height:22px;";
      const rInput = mkInput("Replace", "replace");
      rInput.onfocus = () => { rWrap.style.borderColor = "#0e639c"; };
      rInput.onblur  = () => { rWrap.style.borderColor = "transparent"; };
      rWrap.append(rInput);

      const replBtns = el("div", "display:flex;align-items:center;gap:1px;");
      const r1Btn = mkNavBtn(SVG.replaceOne, "Replace (Enter)",  () => cmReplaceNext(view));
      const rABtn = mkNavBtn(SVG.replaceAll, "Replace All",      () => cmReplaceAll(view));
      replBtns.append(r1Btn, rABtn);

      // Hide all 3 cells together; chevronBtn.onclick toggles them
      const replaceCells = [chevSpacer, rWrap, replBtns];
      replaceCells.forEach(c => { c.style.display = "none"; });
      dom._replaceCells = replaceCells;

      // override chevron click to show/hide cells
      chevronBtn.onclick = () => {
        replaceOpen = !replaceOpen;
        chevronBtn.style.transform = replaceOpen ? "rotate(90deg)" : "";
        replaceCells.forEach(c => { c.style.display = replaceOpen ? "" : "none"; });
      };

      dom.append(...replaceCells);

      rInput.addEventListener("input", commit);
      rInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter")  { e.preventDefault(); cmReplaceNext(view); }
        if (e.key === "Escape") { e.preventDefault(); closeSearchPanel(view); }
      });
      dom._rInput = rInput;
    }

    // ── commit query ──
    function commit() {
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({
        search:        findInput.value,
        replace:       dom._rInput ? dom._rInput.value : "",
        caseSensitive: caseBtn.isOn(),
        regexp:        reBtn.isOn(),
        wholeWord:     wordBtn.isOn(),
      })) });
    }

    findInput.addEventListener("input", commit);
    caseBtn.addEventListener("click", () => { caseBtn.setOn(!caseBtn.isOn()); commit(); });
    wordBtn.addEventListener("click", () => { wordBtn.setOn(!wordBtn.isOn()); commit(); });
    reBtn.addEventListener("click",   () => { reBtn.setOn(!reBtn.isOn());     commit(); });

    findInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); e.shiftKey ? findPrevious(view) : findNext(view); }
      if (e.key === "Escape") { e.preventDefault(); closeSearchPanel(view); }
    });

    // ── count display ──
    function updateCount(state) {
      const q = getSearchQuery(state);
      if (!q.search) { countEl.textContent = ""; findInput.style.color = "#d4d4d4"; return; }
      try {
        let total = 0;
        const cursor = q.getCursor(state.doc);
        while (!cursor.next().done) total++;
        if (total === 0) {
          countEl.textContent = "No results";
          countEl.style.color = "#e06c75";
          findInput.style.color = "#e06c75";
        } else {
          countEl.textContent = `${total} result${total === 1 ? "" : "s"}`;
          countEl.style.color = "#858585";
          findInput.style.color = "#d4d4d4";
        }
      } catch {
        countEl.textContent = "Invalid";
        countEl.style.color = "#e06c75";
        findInput.style.color = "#e06c75";
      }
    }

    return {
      dom,
      top: true,
      mount() {
        const q = getSearchQuery(view.state);
        findInput.value = q.search || "";
        if (dom._rInput) dom._rInput.value = q.replace || "";
        caseBtn.setOn(q.caseSensitive || false);
        reBtn.setOn(q.regexp    || false);
        wordBtn.setOn(q.wholeWord || false);
        findInput.focus();
        findInput.select();
        updateCount(view.state);
      },
      update(upd) { updateCount(upd.state); },
    };
  };
}

// ─────────────────────────────────────────────────────────────

function buildExtensions(onChangeCb, readOnly) {
  const exts = [
    oneDark,
    baseTheme,
    json(),
    history(),
    lineNumbers(),
    drawSelection(),
    highlightActiveLine(),
    bracketMatching(),
    indentOnInput(),
    search({ createPanel: makeSearchPanelCreator(readOnly) }),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.lineWrapping,
  ];
  if (readOnly) {
    exts.push(EditorState.readOnly.of(true));
  } else if (onChangeCb) {
    exts.push(EditorView.updateListener.of(u => { if (u.docChanged) onChangeCb(u.state.doc.toString()); }));
  }
  return exts;
}

export default function JsonEditor({ value, onChange, readOnly = false, showToolbar = true }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: value || "",
        extensions: buildExtensions(readOnly ? null : v => onChangeRef.current?.(v), readOnly),
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const curr = view.state.doc.toString();
    if (curr !== (value || "")) {
      view.dispatch({ changes: { from: 0, to: curr.length, insert: value || "" } });
    }
  }, [value]);

  const beautify = useCallback(() => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const raw = view.state.doc.toString();
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      view.dispatch({ changes: { from: 0, to: raw.length, insert: pretty } });
    } catch {}
  }, [readOnly]);

  const minify = useCallback(() => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const raw = view.state.doc.toString();
    try {
      const mini = JSON.stringify(JSON.parse(raw));
      view.dispatch({ changes: { from: 0, to: raw.length, insert: mini } });
    } catch {}
  }, [readOnly]);

  return (
    <div className="flex flex-col h-full">
      {showToolbar && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
          {!readOnly && (
            <>
              <button onClick={beautify} title="Beautify JSON" className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition-colors">Beautify</button>
              <button onClick={minify} title="Minify JSON" className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition-colors">Minify</button>
              <span className="text-[#3c3c3c] text-sm select-none">|</span>
            </>
          )}
          <span className="text-[10px] text-gray-600 select-none">
            {readOnly ? "⌘F — Find" : "⌘F — Find & Replace · Tab — indent"}
          </span>
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-hidden relative" />
    </div>
  );
}

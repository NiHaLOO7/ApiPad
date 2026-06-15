import { useState, useRef, useEffect, useCallback } from "react";
import JsonEditor from "./JsonEditor";
import "./App.css";

function useDrag({ onDelta, direction }) {
  const dragging = useRef(false);
  const last = useRef(0);

  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    last.current = direction === "horizontal" ? e.clientX : e.clientY;
    e.preventDefault();

    const onMove = (ev) => {
      if (!dragging.current) return;
      const curr = direction === "horizontal" ? ev.clientX : ev.clientY;
      onDelta(curr - last.current);
      last.current = curr;
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onDelta, direction]);

  return onMouseDown;
}

// Tauri plugins — loaded lazily so the app doesn't crash outside Tauri
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let _tauriFetch = null;
async function tauriFetch(url, options) {
  if (!_tauriFetch) {
    const mod = await import("@tauri-apps/plugin-http");
    _tauriFetch = mod.fetch;
  }
  return _tauriFetch(url, options);
}

async function saveJsonToFile(data, defaultName) {
  const json = JSON.stringify(data, null, 2);
  if (!isTauri()) {
    // browser fallback
    const uri = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    const a = document.createElement("a");
    a.href = uri; a.download = defaultName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    return;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({ defaultPath: defaultName, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (path) await writeTextFile(path, json);
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const METHOD_COLORS = {
  GET: "text-green-400",
  POST: "text-yellow-400",
  PUT: "text-blue-400",
  PATCH: "text-purple-400",
  DELETE: "text-red-400",
  HEAD: "text-cyan-400",
  OPTIONS: "text-gray-400",
};

const AUTH_TYPES = ["No Auth", "Basic Auth", "Bearer Token", "API Key", "OAuth 2.0"];

const DEFAULT_AUTH = {
  type: "No Auth",
  username: "", password: "", showPassword: false,
  bearerToken: "",
  apiKeyName: "", apiKeyValue: "", apiKeyIn: "Header",
  oauthToken: "", oauthPrefix: "Bearer",
};

const EMPTY_REQUEST = {
  method: "GET",
  url: "",
  headers: [],
  params: [],
  body: "",
  auth: DEFAULT_AUTH,
};

function formatJson(str) {
  try { return JSON.stringify(JSON.parse(str), null, 2); }
  catch { return str; }
}

function StatusBadge({ code }) {
  if (!code) return null;
  const color = code >= 200 && code < 300 ? "text-green-400"
    : code >= 300 && code < 400 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono font-bold ${color}`}>{code}</span>;
}

const inputCls = "bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#555] w-full";
const labelCls = "text-xs text-gray-500 mb-1 block";

function Divider({ layout, onDelta }) {
  const onMouseDown = useDrag({ onDelta, direction: layout === "horizontal" ? "horizontal" : "vertical" });
  return (
    <div
      onMouseDown={onMouseDown}
      className={[
        "shrink-0 bg-[#3c3c3c] hover:bg-[#0e639c] transition-colors group relative",
        layout === "horizontal"
          ? "w-[3px] cursor-col-resize"
          : "h-[3px] cursor-row-resize",
      ].join(" ")}
    >
      {/* center grip dots */}
      <div className={[
        "absolute flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
        layout === "horizontal"
          ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex-col"
          : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex-row",
      ].join(" ")}>
        {[0,1,2].map(i => <span key={i} className="w-0.5 h-0.5 rounded-full bg-white" />)}
      </div>
    </div>
  );
}

function AuthPanel({ auth, setAuth }) {
  const set = (key, val) => setAuth(prev => ({ ...prev, [key]: val }));
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Auth Type</label>
        <select value={auth.type} onChange={e => set("type", e.target.value)}
          className="bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#555] w-full text-[#d4d4d4] cursor-pointer">
          {AUTH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {auth.type === "No Auth" && <p className="text-xs text-gray-600 italic">No authentication will be added.</p>}
      {auth.type === "Basic Auth" && <>
        <div><label className={labelCls}>Username</label><input value={auth.username} onChange={e => set("username", e.target.value)} className={inputCls} placeholder="username" spellCheck={false} /></div>
        <div>
          <label className={labelCls}>Password</label>
          <input type={auth.showPassword ? "text" : "password"} value={auth.password} onChange={e => set("password", e.target.value)} className={inputCls} placeholder="password" spellCheck={false} />
          <button onClick={() => set("showPassword", !auth.showPassword)} className="text-[10px] text-gray-600 hover:text-gray-400 mt-1">{auth.showPassword ? "Hide" : "Show"} password</button>
        </div>
        <p className="text-[10px] text-gray-600">Encoded as <span className="font-mono text-gray-500">Authorization: Basic &lt;base64&gt;</span></p>
      </>}
      {auth.type === "Bearer Token" && <div>
        <label className={labelCls}>Token</label>
        <input value={auth.bearerToken} onChange={e => set("bearerToken", e.target.value)} className={inputCls} placeholder="eyJhbGci..." spellCheck={false} />
        <p className="text-[10px] text-gray-600 mt-1">Sent as <span className="font-mono text-gray-500">Authorization: Bearer &lt;token&gt;</span></p>
      </div>}
      {auth.type === "API Key" && <>
        <div><label className={labelCls}>Key</label><input value={auth.apiKeyName} onChange={e => set("apiKeyName", e.target.value)} className={inputCls} placeholder="X-API-Key" spellCheck={false} /></div>
        <div><label className={labelCls}>Value</label><input value={auth.apiKeyValue} onChange={e => set("apiKeyValue", e.target.value)} className={inputCls} placeholder="your-api-key" spellCheck={false} /></div>
        <div>
          <label className={labelCls}>Add to</label>
          <div className="flex gap-3">
            {["Header", "Query Params"].map(opt => (
              <label key={opt} className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                <input type="radio" name="apiKeyIn" value={opt} checked={auth.apiKeyIn === opt} onChange={() => set("apiKeyIn", opt)} className="accent-[#0e639c]" />{opt}
              </label>
            ))}
          </div>
        </div>
      </>}
      {auth.type === "OAuth 2.0" && <>
        <div><label className={labelCls}>Access Token</label><input value={auth.oauthToken} onChange={e => set("oauthToken", e.target.value)} className={inputCls} placeholder="Paste access token" spellCheck={false} /></div>
        <div><label className={labelCls}>Header Prefix</label><input value={auth.oauthPrefix} onChange={e => set("oauthPrefix", e.target.value)} className={inputCls} placeholder="Bearer" spellCheck={false} /></div>
        <p className="text-[10px] text-gray-600">Sent as <span className="font-mono text-gray-500">Authorization: &lt;prefix&gt; &lt;token&gt;</span></p>
      </>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function NameModal({ title, placeholder, initial, onClose, onConfirm }) {
  const [val, setVal] = useState(initial || "");
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (val.trim()) { onConfirm(val.trim()); onClose(); } }}>
        <input autoFocus value={val} onChange={e => setVal(e.target.value)} className={inputCls} placeholder={placeholder} spellCheck={false} />
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
          <button type="submit" className="bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs font-semibold px-4 py-1.5 rounded">Confirm</button>
        </div>
      </form>
    </Modal>
  );
}

function SaveModal({ collections, onClose, onSave }) {
  const [name, setName] = useState("New Request");
  const [colId, setColId] = useState(collections[0]?.id || "");
  return (
    <Modal title="Save Request to Collection" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (name.trim() && colId) { onSave(name.trim(), colId); onClose(); } }} className="space-y-3">
        <div>
          <label className={labelCls}>Request Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} className={inputCls} spellCheck={false} />
        </div>
        <div>
          <label className={labelCls}>Collection</label>
          {collections.length === 0
            ? <p className="text-xs text-gray-600 italic">No collections yet. Create one first from the sidebar.</p>
            : <select value={colId} onChange={e => setColId(e.target.value)}
                className="bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#555] w-full text-[#d4d4d4] cursor-pointer">
                {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
          }
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
          <button type="submit" disabled={!colId} className="bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 text-white text-xs font-semibold px-4 py-1.5 rounded">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function ExportModal({ collections, onClose }) {
  const [selected, setSelected] = useState(new Set(collections.map(c => c.id)));

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(prev =>
    prev.size === collections.length ? new Set() : new Set(collections.map(c => c.id))
  );

  const handleExport = async () => {
    const toExport = collections.filter(c => selected.has(c.id));
    if (!toExport.length) return;
    const defaultName = toExport.length === 1
      ? `${toExport[0].name.replace(/\s+/g, "_")}.json`
      : "apipad_collections.json";
    await saveJsonToFile({ apipad_version: "1.0", collections: toExport }, defaultName);
    onClose();
  };

  return (
    <Modal title="Export Collections" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Select collections to export</span>
          <button onClick={toggleAll} className="text-[10px] text-[#0e639c] hover:text-[#1177bb]">
            {selected.size === collections.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {collections.map(col => (
            <label key={col.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#2a2d2e] cursor-pointer">
              <input type="checkbox" checked={selected.has(col.id)} onChange={() => toggle(col.id)} className="accent-[#0e639c] shrink-0" />
              <span className="flex-1 text-xs text-gray-300 truncate">{col.name}</span>
              <span className="text-[10px] text-gray-600 shrink-0">{col.requests.length} req</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end pt-1 border-t border-[#3c3c3c]">
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
          <button onClick={handleExport} disabled={!selected.size}
            className="bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 text-white text-xs font-semibold px-4 py-1.5 rounded transition-colors">
            Export {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/users/1");
  const [bodyTab, setBodyTab] = useState("params");
  const [body, setBody] = useState("");
  const [headers, setHeaders] = useState([{ key: "", value: "" }]);
  const [params, setParams] = useState([{ key: "", value: "" }]);
  const [auth, setAuth] = useState(DEFAULT_AUTH);

  const [response, setResponse] = useState(null);
  const [responseHeaders, setResponseHeaders] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [statusCode, setStatusCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [responseTab, setResponseTab] = useState("body");

  const [history, setHistory] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("collections");
  const [layout, setLayout] = useState("horizontal"); // "horizontal" | "vertical"
  const [splitPct, setSplitPct] = useState(45); // request pane size %
  const splitContainerRef = useRef(null);

  const [collections, setCollections] = useState(() => {
    try { return JSON.parse(localStorage.getItem("apipad_collections") || "[]"); }
    catch { return []; }
  });
  const [expandedCols, setExpandedCols] = useState({});

  const [modal, setModal] = useState(null); // { type: 'newCol' | 'renameCol' | 'renameReq' | 'saveReq' | 'export' }
  const [showExport, setShowExport] = useState(false);

  const importRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("apipad_collections", JSON.stringify(collections));
  }, [collections]);

  const buildAuthHeaders = (h) => {
    const out = { ...h };
    if (auth.type === "Basic Auth" && auth.username)
      out["Authorization"] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
    else if (auth.type === "Bearer Token" && auth.bearerToken)
      out["Authorization"] = `Bearer ${auth.bearerToken}`;
    else if (auth.type === "API Key" && auth.apiKeyName && auth.apiKeyIn === "Header")
      out[auth.apiKeyName] = auth.apiKeyValue;
    else if (auth.type === "OAuth 2.0" && auth.oauthToken)
      out["Authorization"] = `${(auth.oauthPrefix || "Bearer").trim()} ${auth.oauthToken}`;
    return out;
  };

  const buildAuthParams = (p) => {
    if (auth.type === "API Key" && auth.apiKeyName && auth.apiKeyIn === "Query Params")
      return [...p, { key: auth.apiKeyName, value: auth.apiKeyValue }];
    return p;
  };

  const handleSend = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(null); setResponse(null);
    setResponseHeaders(null); setStatusCode(null); setResponseTime(null);
    const start = performance.now();
    try {
      let reqHeaders = {};
      headers.forEach(({ key, value }) => { if (key.trim()) reqHeaders[key.trim()] = value; });
      reqHeaders = buildAuthHeaders(reqHeaders);

      let finalUrl = url;
      const qParams = buildAuthParams(params.filter(p => p.key.trim()));
      if (qParams.length) {
        const qs = new URLSearchParams(qParams.reduce((a, { key, value }) => ({ ...a, [key]: value }), {})).toString();
        finalUrl = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
      }

      if (!["GET", "HEAD", "OPTIONS"].includes(method) && body.trim()) {
        if (!reqHeaders["Content-Type"]) reqHeaders["Content-Type"] = "application/json";
      }

      const options = {
        method,
        headers: reqHeaders,
        ...((!["GET", "HEAD", "OPTIONS"].includes(method) && body.trim()) ? { body } : {}),
      };

      let text, resHeaders = {};
      const res = isTauri()
        ? await tauriFetch(finalUrl, options)
        : await window.fetch(finalUrl, options);
      text = await res.text();
      setStatusCode(res.status);
      res.headers.forEach((val, key) => { resHeaders[key] = val; });

      setResponseTime(Math.round(performance.now() - start));
      setResponse(formatJson(text));
      setResponseHeaders(resHeaders);
      const entry = { id: Date.now(), method, url: finalUrl };
      setHistory(prev => [entry, ...prev.slice(0, 49)]);
      setActiveHistoryId(entry.id);
    } catch (err) {
      console.error("Request error:", err);
      setError(err?.message || err?.toString() || "Request failed");
      setResponseTime(Math.round(performance.now() - start));
    } finally {
      setLoading(false);
    }
  };

  const loadRequest = (req) => {
    setMethod(req.method || "GET");
    setUrl(req.url || "");
    setHeaders(req.headers?.length ? [...req.headers, { key: "", value: "" }] : [{ key: "", value: "" }]);
    setParams(req.params?.length ? [...req.params, { key: "", value: "" }] : [{ key: "", value: "" }]);
    setBody(req.body || "");
    setAuth({ ...DEFAULT_AUTH, ...(req.auth || {}) });
    setResponse(null); setResponseHeaders(null); setStatusCode(null); setError(null);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend();
  };

  const updateRow = (setter) => (i, field, val) => {
    setter(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      if (i === prev.length - 1 && val.trim()) next.push({ key: "", value: "" });
      return next;
    });
  };
  const updateHeader = updateRow(setHeaders);
  const updateParam = updateRow(setParams);

  // Collection CRUD
  const createCollection = (name) => {
    const col = { id: crypto.randomUUID(), name, requests: [] };
    setCollections(prev => [...prev, col]);
    setExpandedCols(prev => ({ ...prev, [col.id]: true }));
  };

  const renameCollection = (colId, name) => {
    setCollections(prev => prev.map(c => c.id === colId ? { ...c, name } : c));
  };

  const deleteCollection = (colId) => {
    if (!window.confirm("Delete this collection and all its requests?")) return;
    setCollections(prev => prev.filter(c => c.id !== colId));
  };

  const saveRequestToCollection = (name, colId) => {
    const req = {
      id: crypto.randomUUID(),
      name,
      method,
      url,
      headers: headers.filter(h => h.key.trim()),
      params: params.filter(p => p.key.trim()),
      body,
      auth: { ...auth, showPassword: false },
    };
    setCollections(prev => prev.map(c => c.id === colId ? { ...c, requests: [...c.requests, req] } : c));
    setExpandedCols(prev => ({ ...prev, [colId]: true }));
  };

  const renameRequest = (colId, reqId, name) => {
    setCollections(prev => prev.map(c => c.id === colId
      ? { ...c, requests: c.requests.map(r => r.id === reqId ? { ...r, name } : r) }
      : c));
  };

  const deleteRequest = (colId, reqId) => {
    setCollections(prev => prev.map(c => c.id === colId
      ? { ...c, requests: c.requests.filter(r => r.id !== reqId) }
      : c));
  };

  const openExport = () => {
    if (!collections.length) return;
    setShowExport(true);
  };

  // Import
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);

        // ApiPad format (single or multiple collections)
        if (data.apipad_version) {
          const cols = Array.isArray(data.collections) ? data.collections
            : data.collection ? [data.collection] : [];
          const imported = cols.map(c => ({ ...c, id: crypto.randomUUID() }));
          setCollections(prev => [...prev, ...imported]);
          const expanded = {};
          imported.forEach(c => { expanded[c.id] = true; });
          setExpandedCols(prev => ({ ...prev, ...expanded }));
          return;
        }

        // Postman v2 / v2.1
        if (data.info && Array.isArray(data.item)) {
          const mapPostmanItems = (items) => items
            .filter(i => i.request) // skip folders for now
            .map(item => {
              const req = item.request || {};
              const rawUrl = typeof req.url === "string" ? req.url : req.url?.raw || "";
              return {
                id: crypto.randomUUID(),
                name: item.name || "Unnamed",
                method: req.method || "GET",
                url: rawUrl,
                headers: (req.header || []).map(h => ({ key: h.key, value: h.value })),
                params: (typeof req.url === "object" ? req.url?.query || [] : [])
                  .map(q => ({ key: q.key, value: q.value || "" })),
                body: req.body?.raw || "",
                auth: DEFAULT_AUTH,
              };
            });
          const col = {
            id: crypto.randomUUID(),
            name: data.info.name || file.name.replace(".json", ""),
            requests: mapPostmanItems(data.item),
          };
          setCollections(prev => [...prev, col]);
          setExpandedCols(prev => ({ ...prev, [col.id]: true }));
        }
      } catch {
        alert("Invalid file. Expected ApiPad or Postman JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleCol = (colId) => setExpandedCols(prev => ({ ...prev, [colId]: !prev[colId] }));

  const authActive = auth.type !== "No Auth";

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-[#d4d4d4] font-sans select-none" onKeyDown={handleKeyDown}>

      {/* MODALS */}
      {modal?.type === "newCol" && (
        <NameModal title="New Collection" placeholder="e.g. User Service APIs" onClose={() => setModal(null)} onConfirm={createCollection} />
      )}
      {modal?.type === "renameCol" && (
        <NameModal title="Rename Collection" placeholder="Collection name" initial={modal.name} onClose={() => setModal(null)} onConfirm={name => renameCollection(modal.colId, name)} />
      )}
      {modal?.type === "renameReq" && (
        <NameModal title="Rename Request" placeholder="Request name" initial={modal.name} onClose={() => setModal(null)} onConfirm={name => renameRequest(modal.colId, modal.reqId, name)} />
      )}
      {modal?.type === "saveReq" && (
        <SaveModal collections={collections} onClose={() => setModal(null)} onSave={saveRequestToCollection} />
      )}
      {showExport && (
        <ExportModal collections={collections} onClose={() => setShowExport(false)} />
      )}

      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

      {/* SIDEBAR */}
      <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-[#3c3c3c] flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">ApiPad</span>
        </div>

        {/* Sidebar tabs */}
        <div className="flex border-b border-[#3c3c3c] shrink-0">
          {["collections", "history"].map(tab => (
            <button key={tab} onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-2 text-[11px] font-medium capitalize transition-colors ${sidebarTab === tab ? "text-white border-b-2 border-[#0e639c]" : "text-gray-500 hover:text-gray-300"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Collections */}
        {sidebarTab === "collections" && (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c] shrink-0">
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Collections</span>
              <div className="flex items-center gap-1">
                <button onClick={() => importRef.current?.click()} className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-[#3c3c3c] transition-colors">Import</button>
                <button onClick={openExport} disabled={!collections.length} className="text-[10px] text-gray-500 hover:text-gray-300 disabled:opacity-40 px-1.5 py-0.5 rounded hover:bg-[#3c3c3c] transition-colors">Export</button>
                <button onClick={() => setModal({ type: "newCol" })} title="New Collection"
                  className="text-gray-400 hover:text-white text-sm px-1.5 py-0.5 rounded hover:bg-[#3c3c3c] transition-colors font-light">+</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {collections.length === 0 && (
                <div className="px-4 py-10 text-center space-y-2">
                  <p className="text-xs text-gray-600">No collections yet.</p>
                  <button onClick={() => setModal({ type: "newCol" })}
                    className="text-xs text-[#0e639c] hover:text-[#1177bb] transition-colors">
                    + New Collection
                  </button>
                </div>
              )}

              {collections.map(col => (
                <div key={col.id}>
                  {/* Collection row */}
                  <div className="group flex items-center gap-1 px-2 py-1.5 hover:bg-[#2a2d2e] cursor-pointer" onClick={() => toggleCol(col.id)}>
                    <span className="text-gray-600 text-[9px] w-3 shrink-0">{expandedCols[col.id] ? "▼" : "▶"}</span>
                    <span className="flex-1 text-xs text-gray-200 font-medium truncate">{col.name}</span>
                    <span className="text-[10px] text-gray-600 shrink-0">{col.requests.length}</span>
                    <button onClick={e => { e.stopPropagation(); setModal({ type: "renameCol", colId: col.id, name: col.name }); }} title="Rename" className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 text-[10px] px-1 transition-opacity">✎</button>
                    <button onClick={e => { e.stopPropagation(); deleteCollection(col.id); }} title="Delete" className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-sm px-1 transition-opacity leading-none">×</button>
                  </div>

                  {/* Requests inside collection */}
                  {expandedCols[col.id] && (
                    <>
                      {col.requests.length === 0 && (
                        <div className="pl-7 pr-3 py-1.5 text-[10px] text-gray-600 italic">No requests yet.</div>
                      )}
                      {col.requests.map(req => (
                        <div key={req.id} onClick={() => loadRequest(req)}
                          className="group flex items-center gap-2 pl-6 pr-2 py-1.5 cursor-pointer hover:bg-[#2a2d2e]">
                          <span className={`font-bold text-[10px] w-10 shrink-0 ${METHOD_COLORS[req.method] || "text-gray-400"}`}>{req.method}</span>
                          <span className="flex-1 text-xs text-gray-400 truncate">{req.name}</span>
                          <button onClick={e => { e.stopPropagation(); setModal({ type: "renameReq", colId: col.id, reqId: req.id, name: req.name }); }} title="Rename" className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 text-[10px] px-0.5 transition-opacity">✎</button>
                          <button onClick={e => { e.stopPropagation(); deleteRequest(col.id, req.id); }} title="Delete" className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-sm px-0.5 transition-opacity leading-none">×</button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* History */}
        {sidebarTab === "history" && (
          <>
            <div className="flex-1 overflow-y-auto">
              {history.length === 0 && (
                <div className="px-4 py-10 text-center text-xs text-gray-600">No requests sent yet.</div>
              )}
              {history.map(item => (
                <div key={item.id} onClick={() => { loadRequest(item); setActiveHistoryId(item.id); }}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs mx-1 mb-0.5 rounded truncate ${activeHistoryId === item.id ? "bg-[#37373d]" : "hover:bg-[#2a2d2e]"}`}>
                  <span className={`font-bold w-12 shrink-0 ${METHOD_COLORS[item.method] || "text-gray-400"}`}>{item.method}</span>
                  <span className="truncate text-gray-400">{item.url.replace(/^https?:\/\//, "")}</span>
                </div>
              ))}
            </div>
            {history.length > 0 && (
              <div className="p-3 border-t border-[#3c3c3c] shrink-0">
                <button onClick={() => { setHistory([]); setActiveHistoryId(null); }} className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors">Clear History</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MAIN PANEL */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOP BAR */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#1e1e1e] border-b border-[#3c3c3c]">
          <select value={method} onChange={e => setMethod(e.target.value)}
            className={`bg-[#2d2d2d] border border-[#3c3c3c] rounded px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-[#555] cursor-pointer shrink-0 ${METHOD_COLORS[method]}`}>
            {HTTP_METHODS.map(m => <option key={m} value={m} className="text-white">{m}</option>)}
          </select>

          <input type="text" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            className="flex-1 bg-[#2d2d2d] border border-[#3c3c3c] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#555] font-mono"
            placeholder="Enter URL and press Enter or ⌘↵" spellCheck={false} />

          <button onClick={() => setModal({ type: "saveReq" })} disabled={!url.trim()}
            className="bg-[#2d2d2d] border border-[#3c3c3c] hover:border-[#555] disabled:opacity-40 disabled:cursor-not-allowed text-gray-400 hover:text-gray-200 text-sm px-3 py-1.5 rounded transition-colors shrink-0">
            Save
          </button>

          <button onClick={handleSend} disabled={loading || !url.trim()}
            className="bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-1.5 rounded transition-colors shrink-0">
            {loading ? "Sending…" : "Send"}
          </button>

          {/* Layout toggle */}
          <div className="flex shrink-0 border border-[#3c3c3c] rounded overflow-hidden">
            <button
              onClick={() => { setLayout("horizontal"); setSplitPct(45); }}
              title="Side by side"
              className={`px-2 py-1.5 text-xs transition-colors ${layout === "horizontal" ? "bg-[#3c3c3c] text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {/* horizontal split icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="6" height="14" rx="1" opacity="0.7"/>
                <rect x="8" y="0" width="6" height="14" rx="1" opacity="0.7"/>
              </svg>
            </button>
            <button
              onClick={() => { setLayout("vertical"); setSplitPct(45); }}
              title="Top / Bottom"
              className={`px-2 py-1.5 text-xs transition-colors ${layout === "vertical" ? "bg-[#3c3c3c] text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {/* vertical split icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="14" height="6" rx="1" opacity="0.7"/>
                <rect x="0" y="8" width="14" height="6" rx="1" opacity="0.7"/>
              </svg>
            </button>
          </div>
        </div>

        {/* SPLIT PANE */}
        <div
          ref={splitContainerRef}
          className={`flex-1 overflow-hidden ${layout === "horizontal" ? "flex flex-row" : "flex flex-col"}`}
        >
          {/* REQUEST PANE */}
          <div
            className="flex flex-col overflow-hidden shrink-0"
            style={layout === "horizontal"
              ? { width: `${splitPct}%` }
              : { height: `${splitPct}%` }
            }
          >
            <div className="flex border-b border-[#3c3c3c] bg-[#252526]">
              {["params", "headers", "body", "auth"].map(tab => (
                <button key={tab} onClick={() => setBodyTab(tab)}
                  className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${bodyTab === tab ? "text-white border-b-2 border-[#0e639c]" : "text-gray-500 hover:text-gray-300"}`}>
                  {tab}
                  {tab === "params" && params.filter(p => p.key.trim()).length > 0 && <span className="ml-1 text-[10px] bg-[#3c3c3c] px-1 rounded">{params.filter(p => p.key.trim()).length}</span>}
                  {tab === "headers" && headers.filter(h => h.key.trim()).length > 0 && <span className="ml-1 text-[10px] bg-[#3c3c3c] px-1 rounded">{headers.filter(h => h.key.trim()).length}</span>}
                  {tab === "auth" && authActive && <span className="ml-1 text-[10px] text-yellow-500">●</span>}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-3">
              {bodyTab === "body" && (
                <div className="-m-3 h-[calc(100%+24px)]">
                  <JsonEditor value={body} onChange={setBody} />
                </div>
              )}
              {bodyTab === "headers" && (
                <div className="space-y-1">
                  <div className="grid gap-2 mb-1" style={{gridTemplateColumns: "1fr 1fr 20px"}}>
                    <span className="text-xs text-gray-500 uppercase font-semibold">Key</span>
                    <span className="text-xs text-gray-500 uppercase font-semibold">Value</span>
                    <span />
                  </div>
                  {headers.map((h, i) => (
                    <div key={i} className="grid gap-2 items-center group" style={{gridTemplateColumns: "1fr 1fr 20px"}}>
                      <input value={h.key} onChange={e => updateHeader(i, "key", e.target.value)} className="bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#555]" placeholder="Content-Type" spellCheck={false} />
                      <input value={h.value} onChange={e => updateHeader(i, "value", e.target.value)} className="bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#555]" placeholder="application/json" spellCheck={false} />
                      <button onClick={() => setHeaders(prev => prev.length === 1 ? [{ key: "", value: "" }] : prev.filter((_, idx) => idx !== i))} className="text-gray-700 hover:text-red-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                  <button onClick={() => setHeaders(prev => [...prev, { key: "", value: "" }])} className="mt-1 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">+ Add Header</button>
                </div>
              )}
              {bodyTab === "params" && (
                <div className="space-y-1">
                  <div className="grid gap-2 mb-1" style={{gridTemplateColumns: "1fr 1fr 20px"}}>
                    <span className="text-xs text-gray-500 uppercase font-semibold">Key</span>
                    <span className="text-xs text-gray-500 uppercase font-semibold">Value</span>
                    <span />
                  </div>
                  {params.map((p, i) => (
                    <div key={i} className="grid gap-2 items-center group" style={{gridTemplateColumns: "1fr 1fr 20px"}}>
                      <input value={p.key} onChange={e => updateParam(i, "key", e.target.value)} className="bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#555]" placeholder="page" spellCheck={false} />
                      <input value={p.value} onChange={e => updateParam(i, "value", e.target.value)} className="bg-[#2d2d2d] border border-[#3c3c3c] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#555]" placeholder="1" spellCheck={false} />
                      <button onClick={() => setParams(prev => prev.length === 1 ? [{ key: "", value: "" }] : prev.filter((_, idx) => idx !== i))} className="text-gray-700 hover:text-red-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                  <button onClick={() => setParams(prev => [...prev, { key: "", value: "" }])} className="mt-1 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">+ Add Param</button>
                </div>
              )}
              {bodyTab === "auth" && <AuthPanel auth={auth} setAuth={setAuth} />}
            </div>
          </div>

          {/* DIVIDER */}
          <Divider
            layout={layout}
            onDelta={delta => {
              const el = splitContainerRef.current;
              if (!el) return;
              const total = layout === "horizontal" ? el.offsetWidth : el.offsetHeight;
              const newPct = Math.min(80, Math.max(20, splitPct + (delta / total) * 100));
              setSplitPct(newPct);
            }}
          />

          {/* RESPONSE PANE */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
              <div className="flex">
                {["body", "headers"].map(tab => (
                  <button key={tab} onClick={() => setResponseTab(tab)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${responseTab === tab ? "text-white border-b-2 border-[#0e639c]" : "text-gray-500 hover:text-gray-300"}`}>
                    {tab}
                    {tab === "headers" && responseHeaders && <span className="ml-1 text-[10px] bg-[#3c3c3c] px-1 rounded">{Object.keys(responseHeaders).length}</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                {statusCode && <StatusBadge code={statusCode} />}
                {responseTime !== null && <span>{responseTime} ms</span>}
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-[#181818]">
              {loading && <div className="flex items-center justify-center h-full text-gray-600 text-sm">Sending request…</div>}
              {!loading && error && <div className="text-red-400 font-mono text-sm p-3 m-3 bg-[#1e1e1e] rounded border border-[#3c3c3c]">{error}</div>}
              {!loading && !error && response === null && <div className="flex items-center justify-center h-full text-gray-700 text-sm">Send a request to see the response</div>}
              {!loading && !error && response !== null && responseTab === "body" && (
                <JsonEditor value={response} readOnly={true} showToolbar={true} />
              )}
              {!loading && !error && responseTab === "headers" && (
                responseHeaders === null
                  ? <div className="flex items-center justify-center h-full text-gray-700 text-sm">Send a request to see response headers</div>
                  : <div className="overflow-auto p-3 space-y-1">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <span className="text-xs text-gray-500 uppercase font-semibold">Key</span>
                        <span className="text-xs text-gray-500 uppercase font-semibold">Value</span>
                      </div>
                      {Object.entries(responseHeaders).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-2 gap-2 py-1 border-b border-[#2a2a2a]">
                          <span className="text-xs font-mono text-[#9cdcfe] truncate">{k}</span>
                          <span className="text-xs font-mono text-[#ce9178] break-all">{v}</span>
                        </div>
                      ))}
                    </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

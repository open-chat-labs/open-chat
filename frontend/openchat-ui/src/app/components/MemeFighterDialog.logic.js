// Logic for MemeFighterDialog.svelte — carried over from lib/MemeFighterDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Meme Fighter (composer + → Meme Fighter). ≥960px: templates beside a preview + numbered fields (options 2a).
// Narrower: two steps, pick → write, Back in the header (2b). "Add to message" renders the meme to a PNG and calls
// onAttach({ src, template }); the host adds it to the composer's photo tray. Template art is placeholder until wired.
// Placeholder templates: gradient "art" per panel, text boxes in % of the image. Real art comes from Meme Fighter.
const G = (a, b, ang) => "linear-gradient(" + (ang || 150) + "deg," + a + "," + b + ")";
const TPLS = [
  { id: "distracted", name: "Distracted", vibes: ["lol"], ar: 1.5, cols: 1, cells: [G("#d8b48a", "#5b7a96")], boxes: [[12, 60, 34, 22], [46, 40, 26, 18], [73, 46, 25, 28]] },
  { id: "approve", name: "Nope / Yep", vibes: ["happy", "lol"], ar: 1, cols: 2, cells: [G("#f2b45a", "#c2562f"), "#f4f1ea", G("#f2b45a", "#7a3a1f"), "#f4f1ea"], boxes: [[52, 4, 46, 42], [52, 54, 46, 42]] },
  { id: "panik", name: "Panik, kalm, panik", vibes: ["anxiety"], ar: 0.9, cols: 2, cells: ["#f4f1ea", G("#e8c3a0", "#a87454"), "#f4f1ea", G("#e8c3a0", "#a87454"), "#f4f1ea", G("#e8c3a0", "#7d4a2f")], boxes: [[3, 3, 44, 28], [3, 36, 44, 28], [3, 69, 44, 28]] },
  { id: "buttons", name: "Two buttons", vibes: ["anxiety"], ar: 0.8, cols: 1, cells: [G("#e04646", "#f3d36b", 180)], boxes: [[10, 8, 36, 16], [54, 4, 36, 16], [10, 72, 80, 22]] },
  { id: "brain", name: "Expanding brain", vibes: ["fresh", "lol"], ar: 0.8, cols: 2, cells: ["#f4f1ea", G("#6aa7ff", "#1b2a6b"), "#f4f1ea", G("#8cc8ff", "#2b4ab5"), "#f4f1ea", G("#b5e0ff", "#4a6fd6"), "#f4f1ea", G("#ffffff", "#7fb2ff")], boxes: [[3, 2, 45, 21], [3, 27, 45, 21], [3, 52, 45, 21], [3, 77, 45, 21]] },
  { id: "butterfly", name: "Is this a…?", vibes: ["fresh"], ar: 1.2, cols: 1, cells: [G("#86a8c8", "#e3c9a0")], boxes: [[56, 4, 40, 18], [4, 66, 44, 20], [52, 80, 44, 16]] },
  { id: "mind", name: "Change my mind", vibes: ["angry"], ar: 1.4, cols: 1, cells: [G("#9bbf7a", "#3d5a2f")], boxes: [[40, 52, 52, 30]] },
  { id: "fine", name: "This is fine", vibes: ["anxiety", "angry"], ar: 1.6, cols: 1, cells: [G("#ff9a3d", "#8a2b14")], boxes: [[6, 4, 88, 20], [6, 76, 88, 20]] },
];
const VIBES = [["fresh", "🌱", "Fresh"], ["happy", "😁", "Happy"], ["anxiety", "😬", "Anxiety"], ["lol", "🤣", "LOL"], ["angry", "😡", "Angry"]];
const ON = { bg: "color-mix(in oklch,var(--accent,#FF5672) 16%,transparent)", ring: "color-mix(in oklch,var(--accent,#FF5672) 55%,transparent)", ink: "var(--accent-bright,#FF8298)" };
const OFF = { bg: "var(--overlay-1,rgba(255,255,255,.05))", ring: "transparent", ink: "var(--ink-2,#C9C9D4)" };
const colsCss = n => n === 1 ? "minmax(0,1fr)" : "repeat(" + n + ",minmax(0,1fr))";

// largest size where whole words fit the box width and all lines fit its height (same rule for preview and PNG)
function fitBox(x, t, b, s, W) {
  const H = W / t.ar, bw = b[2] / 100 * W * 0.94, bh = b[3] / 100 * H * 0.92;
  const words = s.split(/\s+/).filter(Boolean);
  const wrap = size => { x.font = size + "px Anton, Impact, sans-serif"; const out = []; let line = ""; words.forEach(w => { const tl = line ? line + " " + w : w; if (x.measureText(tl).width > bw && line) { out.push(line); line = w; } else line = tl; }); out.push(line); return out; };
  let size = Math.min(bh * 0.7, 110), lines = wrap(size);
  while (size > 10) { lines = wrap(size); const widest = Math.max.apply(null, lines.map(l => x.measureText(l).width)); if (lines.length * size * 1.05 <= bh && widest <= bw) break; size -= 1; }
  return { size, lines };
}
let MEASURE = null;
const measureCtx = () => MEASURE || (MEASURE = document.createElement("canvas").getContext("2d"));

// canvas render of a template + texts → PNG data URL
function renderMeme(t, texts) {
  const W = 900, H = Math.round(W / t.ar), c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), rows = Math.ceil(t.cells.length / t.cols), cw = W / t.cols, ch = H / rows;
  x.fillStyle = "#111"; x.fillRect(0, 0, W, H);
  t.cells.forEach((cell, i) => {
    const cx = (i % t.cols) * cw, cy = Math.floor(i / t.cols) * ch;
    const m = cell.match(/#[0-9a-f]{6}/gi);
    if (m && m.length > 1) { const g = x.createLinearGradient(cx, cy, cx + cw, cy + ch); g.addColorStop(0, m[0]); g.addColorStop(1, m[1]); x.fillStyle = g; } else x.fillStyle = cell;
    x.fillRect(cx + 1, cy + 1, cw - 2, ch - 2);
  });
  x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round"; x.fillStyle = "#fff"; x.strokeStyle = "#000";
  t.boxes.forEach((b, i) => {
    const s = (texts[i] || "").trim().toUpperCase(); if (!s) return;
    const f = fitBox(x, t, b, s, W);
    const bx = b[0] / 100 * W, by = b[1] / 100 * H, bw = b[2] / 100 * W, bh = b[3] / 100 * H;
    x.font = f.size + "px Anton, Impact, sans-serif"; x.lineWidth = Math.max(3, f.size / 9);
    const lh = f.size * 1.05, top = by + bh / 2 - (f.lines.length - 1) * lh / 2;
    f.lines.forEach((l, k) => { x.strokeText(l, bx + bw / 2, top + k * lh); x.fillText(l, bx + bw / 2, top + k * lh); });
  });
  // blob URL, not a data URL: inline style strings split on ";" and would cut "data:image/png;base64"
  return new Promise(res => c.toBlob(b => res(URL.createObjectURL(b)), "image/png"));
}

class Component extends DCLogic {
  state = { view: "browse", tpl: "distracted", texts: {}, q: "", vibe: null, focusC: null, busy: false, vw: typeof window === "undefined" ? 1200 : window.innerWidth };
  boxRef = React.createRef();
  componentDidMount() {
    this._rs = () => this.setState({ vw: window.innerWidth });
    window.addEventListener("resize", this._rs);
    if (document.fonts) document.fonts.load("48px Anton").then(() => this.forceUpdate()).catch(() => {});
    setTimeout(() => { const el = this.boxRef.current && this.boxRef.current.querySelector("input"); if (el) el.focus(); }, 60);
  }
  componentWillUnmount() { window.removeEventListener("resize", this._rs); }
  renderVals() {
    const p = this.props, s = this.state, set = o => this.setState(o);
    const wide = s.vw >= 960;
    const T = TPLS.find(t => t.id === s.tpl) || TPLS[0];
    const texts = s.texts[T.id] || [];
    const q = s.q.trim().toLowerCase();
    const list = TPLS.filter(t => (!q || t.name.toLowerCase().indexOf(q) >= 0) && (!s.vibe || t.vibes.indexOf(s.vibe) >= 0));
    // switching templates carries text into matching boxes
    const open = t => {
      this.setState({ tpl: t.id, view: "edit", texts: s.texts[t.id] ? s.texts : Object.assign({}, s.texts, { [t.id]: texts.slice(0, t.boxes.length) }) },
        () => setTimeout(() => { const el = this.boxRef.current && this.boxRef.current.querySelector('input[aria-label^="Text 1"]'); if (el) el.focus(); }, 0));
    };
    const picked = wide || s.view === "edit";
    const card = t => ({ name: t.name, cols: colsCss(t.cols), cells: t.cells, onClick: () => open(t), sel: picked && t.id === T.id,
      ring: picked && t.id === T.id ? "0 0 0 2px var(--accent,#FF5672)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: picked && t.id === T.id ? "var(--ink,#ECECF1)" : "var(--ink-2,#C9C9D4)" });
    const hasText = texts.some(v => v && v.trim());
    const RW = 900, RH = RW / T.ar, cq = px => (px / RW * 100).toFixed(2) + "cqw";
    const fitFor = (b, i) => { const raw = (texts[i] || "").trim(); const f = fitBox(measureCtx(), T, b, (raw || "Text " + (i + 1)).toUpperCase(), RW); const bh = b[3] / 100 * RH, used = f.lines.length * f.size * 1.05; return { fs: cq(f.size), padT: cq(Math.max(0, (bh - used) / 2 - f.size * 0.06)), padX: cq(b[2] / 100 * RW * 0.03), shown: raw ? f.lines.join("\n") : "" }; };
    const generate = async () => {
      if (!hasText || s.busy || !p.onAttach) return;
      set({ busy: true });
      try { await document.fonts.load("48px Anton"); } catch (e) {}
      const src = await renderMeme(T, texts);
      p.onAttach({ src, template: T.name });
    };
    const narrowEdit = !wide && s.view === "edit";
    return {
      z: String(p.z ?? 80), boxRef: this.boxRef,
      wide, narrowBrowse: !wide && s.view !== "edit", narrowEdit,
      dlgW: wide ? "920px" : "440px", dlgH: wide ? "660px" : "760px", outerPad: wide ? "24px" : "12px",
      headH: wide ? "66px" : "60px", headPadL: narrowEdit ? "10px" : "22px", titlePad: narrowEdit ? "4px" : "0",
      showBack: narrowEdit, headTitle: narrowEdit ? T.name : "Meme Fighter",
      back: () => set({ view: "browse" }),
      onClose: () => { if (p.onClose) p.onClose(); },
      onKey: e => {
        if (e.key === "Escape") { e.stopPropagation(); if (narrowEdit) set({ view: "browse" }); else if (p.onClose) p.onClose(); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); }
      },
      q: s.q, onQ: e => set({ q: e.target.value }),
      vibes: VIBES.map(([k, emoji, label]) => Object.assign({ emoji, label, sel: s.vibe === k, onClick: () => set({ vibe: s.vibe === k ? null : k }) }, s.vibe === k ? ON : OFF)),
      all: list.map(card), noResults: list.length === 0,
      tpl: { name: T.name, cols: colsCss(T.cols), cells: T.cells }, ar: String(T.ar),
      c2Max: T.ar < 1 ? Math.round(300 * T.ar) + "px" : "460px", nMax: T.ar < 1 ? Math.round(260 * T.ar) + "px" : "100%",
      boxes: T.boxes.map((b, i) => Object.assign(fitFor(b, i), {
        x: b[0] + "%", y: b[1] + "%", w: b[2] + "%", h: b[3] + "%", n: String(i + 1),
        value: texts[i] || "", phLong: "Text for box " + (i + 1), label: "Text " + (i + 1) + " of " + T.boxes.length,
        cOutline: s.focusC === i ? "2px solid var(--accent,#FF5672)" : "1.5px dashed rgba(255,255,255,.7)",
        onInput: e => { const n = texts.slice(); n[i] = e.target.value; set({ texts: Object.assign({}, s.texts, { [T.id]: n }) }); },
        onFocus: () => set({ focusC: i }),
      })),
      blurC: () => set({ focusC: null }),
      hasText, noText: !hasText || s.busy,
      clear: () => set({ texts: Object.assign({}, s.texts, { [T.id]: [] }) }),
      cta: s.busy ? "Adding…" : "Add to message", generate,
    };
  }
}

export default Component;

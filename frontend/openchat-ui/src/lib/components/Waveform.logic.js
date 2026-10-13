// Logic for Waveform.svelte — carried over from lib/Waveform.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Audio waveform. levels: array of 0–1 (or `count` bars from a stable seed). progress 0–1 colours the played part.
// seekable → handle + pointer/arrow-key seeking → onSeek(fraction). Bars fill the width, so it never cuts off.
class Component extends DCLogic {
  rootRef = React.createRef();
  state = { w: 0 };
  componentDidMount() { const el = this.rootRef.current; if (!el) return; const m = () => { const w = el.clientWidth; if (w && w !== this.state.w) this.setState({ w }); }; m(); if (window.ResizeObserver) { this._ro = new ResizeObserver(m); this._ro.observe(el); } }
  componentWillUnmount() { if (this._ro) this._ro.disconnect(); }
  // resample source levels to however many 3px bars (2px gap) fit the measured width
  _fit(lv) { const n = this.state.w ? Math.max(8, Math.floor((this.state.w + 2) / 5)) : lv.length; if (n === lv.length) return lv; const out = []; for (let i = 0; i < n; i++) out.push(lv[Math.min(lv.length - 1, Math.floor(i * lv.length / n))]); return out; }
  _levels() {
    const p = this.props; if (Array.isArray(p.levels) && p.levels.length) return p.levels;
    const n = p.count ?? 40, seed = p.seed ?? 7, out = [];
    for (let i = 0; i < n; i++) { const x = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453; out.push(0.25 + (x - Math.floor(x)) * 0.75); }
    return out;
  }
  _seekAt(clientX) {
    const el = this.rootRef.current; if (!el || !this.props.onSeek) return;
    const r = el.getBoundingClientRect(); this.props.onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  }
  renderVals() {
    const p = this.props, lv = this._fit(this._levels()), prog = Math.max(0, Math.min(1, p.progress ?? 0)), h = p.height ?? 22, seek = p.seekable ?? !!p.onSeek;
    const played = p.playedColor ?? "var(--accent,#FF5672)", rest = p.restColor ?? "var(--bubble-wave-off,#4A4A56)";
    return {
      rootRef: this.rootRef, hpx: h + "px", playedInk: played, ring: p.ring ?? "var(--bubble-recv-bg,#191921)",
      bars: lv.map((v, i) => ({ h: Math.max(3, Math.round(v * h)) + "px", c: (i + 0.5) / lv.length <= prog ? played : rest })),
      showHandle: seek && p.handle !== false, handleX: (prog * 100).toFixed(2) + "%",
      role: seek ? "slider" : "img", tab: seek ? "0" : undefined, cursor: seek ? "pointer" : "default",
      aria: p.label ?? "Waveform", pct: String(Math.round(prog * 100)),
      down: e => {
        if (!seek) return; this._seekAt(e.clientX);
        const mv = ev => this._seekAt(ev.clientX), up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
      },
      key: e => { if (!seek || !p.onSeek) return; const d = e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0; if (d) { e.preventDefault(); p.onSeek(Math.max(0, Math.min(1, prog + d))); } },
    };
  }
}

export default Component;

// Logic for ContextMenu.svelte — carried over from lib/ContextMenu.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// The one row menu. Same items, three ways in:
//   desktop right-click → `point` (opens at the cursor)
//   kebab / keyboard (Shift+F10, Menu key) → `anchor` rect (opens under it, end-aligned)
//   touch long-press → `anchor` {left:x,right:x,top,bottom} of the row with align "start" (anchored popover, no bottom sheet)
// Flips to stay on screen; closes on outside press, Esc, scroll or resize. Rows own open/close state.
class Component extends DCLogic {
  state = { pos: null };
  boxRef = React.createRef();
  componentDidMount() {
    this._down = e => { const b = this.boxRef.current; if (this.props.open && b && !b.contains(e.target)) this._close(); };
    this._key = e => { if (this.props.open && e.key === "Escape") this._close(); };
    this._gone = () => { if (this.props.open) this._close(); };
    document.addEventListener("pointerdown", this._down, true);
    document.addEventListener("keydown", this._key);
    window.addEventListener("resize", this._gone);
    document.addEventListener("scroll", this._gone, true);
    // the menu's real size only exists once lib/Menu has loaded; re-place whenever the box resizes
    if (typeof ResizeObserver !== "undefined") this._ro = new ResizeObserver(() => { if (this.props.open) this._place(true); });
    this._place();
  }
  componentDidUpdate() { this._place(); }
  componentWillUnmount() {
    document.removeEventListener("pointerdown", this._down, true);
    document.removeEventListener("keydown", this._key);
    window.removeEventListener("resize", this._gone);
    document.removeEventListener("scroll", this._gone, true);
    if (this._ro) this._ro.disconnect();
  }
  _close() {
    this._placed = null; this._focusedFor = null;
    const back = this._returnTo; this._returnTo = null;
    if (this.props.onClose) this.props.onClose();
    if (back && back.isConnected && typeof back.focus === "function") requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }
  _sig() { const p = this.props; return p.open ? JSON.stringify([p.point || null, p.anchor || null, (p.items || []).length]) : null; }
  _place(force) {
    const sig = this._sig();
    if (!sig) { if (this._placed) { this._placed = null; } this._observed = null; return; }
    const b = this.boxRef.current; if (!b) return;
    if (this._ro && this._observed !== b) { this._ro.disconnect(); this._ro.observe(b); this._observed = b; }
    const r = b.getBoundingClientRect();
    const size = Math.round(r.width) + "x" + Math.round(r.height);
    if (sig === this._placed && size === this._size && !force) return;
    if (sig === this._placed && size === this._size) return;
    // hold back until the real menu has rendered (MenuItem rows present), so the flip uses the true height
    if (!b.querySelector('[role="menuitem"], [data-sc-name="lib/MenuItem"] *')) { if (this.state.pos && this.state.pos.sig === sig) this.setState({ pos: null }); return; }
    this._size = size;
    const raw = this.state.pos && this.state.pos.sig === sig ? { x: this.state.pos.left, y: this.state.pos.top } : this._raw();
    // fixed elements can be offset by a contained ancestor; measure it instead of assuming the viewport
    const offX = r.left - raw.x, offY = r.top - raw.y, w = r.width, h = r.height;
    const vw = window.innerWidth, vh = window.innerHeight, M = 8, p = this.props;
    let x, y;
    if (p.point) {
      x = p.point.x; y = p.point.y;
      if (x + w > vw - M) x = p.point.x - w;
      if (y + h > vh - M) y = p.point.y - h;
    } else {
      const a = p.anchor || { left: 0, right: 0, top: 0, bottom: 0 };
      x = (p.align ?? "end") === "end" ? a.right - w : a.left;
      if (x + w > vw - M) x = vw - M - w;
      y = a.bottom + 6;
      if (y + h > vh - M && a.top - h - 6 >= M) y = a.top - h - 6;
    }
    x = Math.max(M, Math.min(x, vw - M - w)); y = Math.max(M, Math.min(y, vh - M - h));
    this._placed = sig;
    if (this._focusedFor !== sig) {
      this._focusedFor = sig;
      if (!this._returnTo) this._returnTo = document.activeElement;
      requestAnimationFrame(() => { const first = b.querySelector('[role="menuitem"]'); if (first) first.focus({ preventScroll: true }); });
    }
    const pos = { left: Math.round(x - offX), top: Math.round(y - offY), sig };
    const cur = this.state.pos;
    if (!cur || cur.sig !== sig || cur.left !== pos.left || cur.top !== pos.top) this.setState({ pos });
  }
  _raw() { const p = this.props; if (p.point) return { x: p.point.x, y: p.point.y }; const a = p.anchor || {}; return { x: a.left || 0, y: a.bottom || 0 }; }
  renderVals() {
    const p = this.props, sig = this._sig(), placed = this.state.pos && this.state.pos.sig === sig;
    const raw = this._raw();
    return { 
      open: !!p.open, boxRef: this.boxRef,
      left: (placed ? this.state.pos.left : raw.x) + "px", top: (placed ? this.state.pos.top : raw.y) + "px",
      vis: placed ? "visible" : "hidden",
      minWidth: p.minWidth ?? "212px",
      swallow: e => e.preventDefault(),
      items: (p.items || []).map(it => it.variant === "separator" ? it : Object.assign({}, it, { onSelect: () => { this._close(); if (it.onSelect) it.onSelect(); } })),
    };
  }
}

export default Component;

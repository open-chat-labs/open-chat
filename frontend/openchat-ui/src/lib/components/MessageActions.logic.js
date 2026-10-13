// Logic for MessageActions.svelte — carried over from lib/MessageActions.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Message actions surface. Two layouts, same content:
//   popover (pointer / wide): one panel at the cursor or under an anchor — reaction row + actions; 🙂 morphs it into lib/EmojiPicker in place.
//   focus (touch / narrow): scrim + blur, the message cloned and lifted where it sits, reactions above, actions below; 🙂 swaps the actions for the picker.
// reactions=false drops the reaction row (opened from the hover bar's ⋯, which already offers them).
// pickerOnly opens straight to the picker (hover bar 🙂) with no back step. The host decides the layout and owns the items.
const QUICK = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "😮", "😢"];
class Component extends DCLogic {
  state = { mode: null, pos: null };
  boxRef = React.createRef(); cloneRef = React.createRef();
  componentDidMount() {
    this._down = e => { if (!this.props.open || this.props.focus) return; const b = this.boxRef.current; if (b && !b.contains(e.target)) this._close(); };
    this._key = e => { if (this.props.open && e.key === "Escape") { e.preventDefault(); this._close(); } };
    this._gone = e => { if (!this.props.open || this.props.focus) return; const b = this.boxRef.current; if (e && e.target && b && b.contains(e.target)) return; this._close(); };
    document.addEventListener("pointerdown", this._down, true);
    document.addEventListener("keydown", this._key);
    window.addEventListener("resize", this._gone);
    document.addEventListener("scroll", this._gone, true);
    if (typeof ResizeObserver !== "undefined") this._ro = new ResizeObserver(() => this._place(true));
    this._sync();
  }
  componentDidUpdate() { this._sync(); }
  componentWillUnmount() {
    document.removeEventListener("pointerdown", this._down, true);
    document.removeEventListener("keydown", this._key);
    window.removeEventListener("resize", this._gone);
    document.removeEventListener("scroll", this._gone, true);
    if (this._ro) this._ro.disconnect();
  }
  _close() { const back = this._returnTo; this._returnTo = null; this._openSig = null; if (this.props.onClose) this.props.onClose(); if (back && back.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true })); }
  _mode() { return this.state.mode && this.state.mode.sig === this._sigOf() ? this.state.mode.v : (this.props.pickerOnly ? "picker" : "menu"); }
  _sigOf() { const p = this.props; return p.open ? JSON.stringify([p.point || null, p.anchor || null, p.focus ? p.focusRect : null, !!p.pickerOnly]) : null; }
  _sync() {
    const sig = this._sigOf();
    if (!sig) { this._openSig = null; return; }
    if (sig !== this._openSig) {
      this._openSig = sig; this._placedSig = null; this._returnTo = document.activeElement;
      // focus layout: clone the message so it can sit above the scrim
      const c = this.cloneRef.current;
      if (this.props.focus && c) { c.innerHTML = ""; const el = this.props.focusEl; if (el) { const k = el.cloneNode(true); k.querySelectorAll("[data-msg-acts],[data-msg-mark]").forEach(n => n.remove()); k.style.transform = ""; c.appendChild(k); } }
      requestAnimationFrame(() => { const first = this.boxRef.current && this.boxRef.current.querySelector("[data-ma-item]"); if (first && this.props.focusFirst) first.focus({ preventScroll: true }); });
    }
    const b = this.boxRef.current; if (b && this._ro && this._observed !== b) { this._ro.disconnect(); this._ro.observe(b); this._observed = b; }
    this._place();
  }
  _place(force) {
    const p = this.props, b = this.boxRef.current; if (!p.open || !b) return;
    const sig = this._openSig + "|" + this._mode();
    const r = b.getBoundingClientRect(), w = r.width, h = r.height, vw = window.innerWidth, vh = window.innerHeight, M = 8;
    const size = Math.round(w) + "x" + Math.round(h);
    if (!force && this._placedSig === sig && this._size === size) return;
    if (this._placedSig === sig && this._size === size) return;
    this._size = size;
    let left, top, shift = 0;
    if (p.focus) {
      const fr = p.focusRect || { left: 20, top: vh / 3, width: 300, height: 60 };
      // the slot's offset inside the box is measured, so the clone always lands exactly in it
      const slot = b.querySelector("[data-ma-slot]");
      const slotY = slot ? slot.getBoundingClientRect().top - r.top : 0;
      left = Math.min(Math.max(M, fr.left), vw - w - M);
      top = fr.top - slotY;
      if (top + h > vh - M) shift = (vh - M) - (top + h);
      if (top + shift < M) shift = M - top;
      top += shift;
      this.setState({ pos: { sig, left, top, cloneLeft: left, cloneTop: top + slotY, cloneW: fr.width, cloneH: fr.height } });
    } else {
      const prev = this.state.pos && this.state.pos.base === this._openSig ? this.state.pos : null;
      if (prev) { left = prev.left; top = prev.top; }
      else if (p.point) { left = p.point.x; top = p.point.y; if (left + w > vw - M) left = p.point.x - w; if (top + h > vh - M) top = p.point.y - h; }
      else if (p.anchor) { const a = p.anchor; left = (p.align || "end") === "end" ? a.right - w : a.left; top = a.bottom + 6; if (top + h > vh - M) top = a.top - h - 6; }
      else { left = (vw - w) / 2; top = (vh - h) / 2; }
      // morphing to the picker keeps the top-left corner unless it no longer fits
      if (left + w > vw - M) left = vw - w - M; if (top + h > vh - M) top = vh - h - M;
      left = Math.max(M, left); top = Math.max(M, top);
      this.setState({ pos: { sig, base: this._openSig, left, top } });
    }
    this._placedSig = sig;
  }
  renderVals() {
    const p = this.props, open = !!p.open, focus = !!p.focus;
    const mode = open ? this._mode() : "menu", picker = mode === "picker";
    const pos = this.state.pos && this.state.pos.sig === (this._openSig + "|" + mode) ? this.state.pos : null;
    let capH = 0;
    if (focus && p.focusRect) {
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const items = p.items || [], seps = items.filter(i => i.variant === "separator").length;
      const below = picker ? Math.min(390, vh * 0.6) : (items.length - seps) * 44 + seps * 9 + 12;
      const above = picker ? 0 : 42 + 10;
      capH = Math.min(p.focusRect.height, Math.max(80, vh - 16 - above - 10 - below));
    }
    const sel = p.selected || [], recent = p.recent || [];
    const qs = []; recent.concat(QUICK).forEach(c => { if (qs.indexOf(c) < 0 && qs.length < (focus ? 7 : 5)) qs.push(c); });
    const react = c => { if (p.onReact) p.onReact(c); this._close(); };
    const setMode = v => this.setState({ mode: { sig: this._sigOf(), v } });
    const rows = (p.items || []).map(it => it.variant === "separator" ? { sep: true, row: false } : { sep: false, row: true, label: it.label, mask: (it.mask || "") + " center/contain no-repeat", ink: it.variant === "danger" ? "var(--status-danger,#FF4D4D)" : "var(--ink,#ECECF1)", pick: () => { this._close(); if (it.onSelect) it.onSelect(); } });
    return {
      open, focus, boxRef: this.boxRef, cloneRef: this.cloneRef,
      left: pos ? pos.left + "px" : "0px", top: pos ? pos.top + "px" : "0px", vis: pos ? "visible" : "hidden",
      cloneLeft: pos && focus ? pos.cloneLeft + "px" : "0px", cloneTop: pos && focus ? pos.cloneTop + "px" : "0px", cloneW: pos && focus ? pos.cloneW + "px" : "auto", cloneH: focus && p.focusRect ? capH + "px" : "0px",
      // tall messages (polls, prizes, media) are capped so strip + message + actions always fit; the bottom edge (timestamp) stays, the top fades
      cloneMask: focus && p.focusRect && capH < p.focusRect.height ? "linear-gradient(to bottom, transparent 0, #000 48px)" : "none",
      boxW: focus ? "min(360px, calc(100vw - 16px))" : "auto", stackGap: focus ? "10px" : "0px",
      showStrip: focus && !picker, inlineStrip: !focus && (p.reactions ?? true), showRows: !picker, showPicker: picker,
      rowsW: focus ? "min(240px, 100%)" : "252px", rowH: focus ? "42px" : "36px",
      stripPad: "0 6px", stripRadius: "26px", stripShadow: "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 12px 30px rgba(0,0,0,.5)",
      emojiBox: "42px", emojiSize: "22px",
      pickerW: focus ? "min(340px, calc(100vw - 16px))" : "340px", pickerH: focus ? "min(390px, 60vh)" : "380px",
      quick: qs.map(c => { const on = sel.indexOf(c) >= 0; return { char: c, label: (on ? "Remove " : "React ") + c, onStr: String(on), bg: on ? "var(--accent-soft,rgba(255,86,114,.16))" : "transparent", ring: on ? "inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 50%,transparent)" : "none", pick: () => react(c) }; }),
      openPicker: () => setMode("picker"),
      rows, recent, selected: sel, pickAny: c => react(c),
      backFn: p.pickerOnly ? undefined : () => setMode("menu"),
      close: () => this._close(), swallow: e => e.preventDefault(),
      onKey: e => {
        if (picker) return;
        const items = this.boxRef.current ? [...this.boxRef.current.querySelectorAll("[data-ma-item]")] : [];
        const i = items.indexOf(document.activeElement);
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (step) { e.preventDefault(); const n = i < 0 ? 0 : (i + step + items.length) % items.length; items[n] && items[n].focus(); }
        else if (e.key === "Home" || e.key === "End") { e.preventDefault(); const n = e.key === "Home" ? 0 : items.length - 1; items[n] && items[n].focus(); }
        else if ((e.key === "Enter" || e.key === " ") && i >= 0) { e.preventDefault(); items[i].click(); }
        else if (e.key === "Tab") { e.preventDefault(); this._close(); }
      },
    };
  }
}

export default Component;

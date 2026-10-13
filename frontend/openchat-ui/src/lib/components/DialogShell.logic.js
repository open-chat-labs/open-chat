// Logic for DialogShell.svelte — carried over from lib/DialogShell.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Modal frame: blurred backdrop (click closes), card with title + close, body from children.
// height "auto" sizes to content; otherwise a fixed/min() height so lists can scroll inside.
// Focus moves into the dialog on open and back to the opener on close; Tab stays inside;
// Esc closes only the top-most dialog when several are stacked (e.g. ChatPicker over Invite).
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
const stack = () => (window.__ocDialogs = window.__ocDialogs || []);
class Component extends DCLogic {
  boxRef = React.createRef();
  componentDidMount() {
    this._returnTo = document.activeElement;
    stack().push(this);
    this._key = e => {
      const s = stack(); if (s[s.length - 1] !== this) return;
      if (e.key === "Escape") { if (this.props.onClose) { e.preventDefault(); this.props.onClose(); } return; }
      if (e.key !== "Tab") return;
      const box = this.boxRef.current; if (!box) return;
      const els = [...box.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) { e.preventDefault(); box.focus(); return; }
      const first = els[0], last = els[els.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !box.contains(a))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !box.contains(a))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", this._key);
    // first field if there is one, else the dialog itself (so the close button isn't the default target)
    this._f = setTimeout(() => { const box = this.boxRef.current; if (!box || box.contains(document.activeElement)) return; const field = box.querySelector("input:not([type=hidden]):not([disabled]),textarea:not([disabled])"); (field || box).focus({ preventScroll: true }); }, 60);
  }
  componentWillUnmount() {
    clearTimeout(this._f);
    window.removeEventListener("keydown", this._key);
    const s = stack(), i = s.indexOf(this); if (i >= 0) s.splice(i, 1);
    const back = this._returnTo;
    if (back && back.isConnected && typeof back.focus === "function") setTimeout(() => back.focus({ preventScroll: true }), 0);
  }
  renderVals() {
    const p = this.props;
    return { 
      boxRef: this.boxRef,
      title: p.title ?? "Dialog",
      width: (p.width ?? 440) + "px",
      height: p.height ?? "min(560px,100%)",
      bodyPad: p.flush ? "0" : "var(--space-16)",
      z: String(p.z ?? 80),
      onClose: p.onClose, children: p.children,
    };
  }
}

export default Component;

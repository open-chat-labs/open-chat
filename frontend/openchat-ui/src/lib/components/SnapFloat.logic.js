// Logic for SnapFloat.svelte — carried over from lib/SnapFloat.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Draggable floating box that snaps to 8 spots (corners + edge midpoints) inside its positioned parent.
// Drag from anywhere — a drag starts after 5px, so taps still reach buttons inside; the click after a drag is swallowed.
// Snap glides from the drop point (FLIP, 720ms ease-out). safeTop / safeBottom (px) keep it clear of a header / composer.
// position: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br" (centre drops go to the nearer side) → onSnap(position).
class Component extends DCLogic {
  state = {};
  ref = React.createRef();
  _pos() { return this.state.pos || this.props.position || "br"; }
  renderVals() {
    const p = this.props, k = this._pos(), m = (p.inset ?? 20);
    const top = (p.safeTop ?? m) + "px", bot = (p.safeBottom ?? m) + "px", side = m + "px";
    return {
      ref: this.ref, role: p.role ?? "region", label: p.label, z: String(p.zIndex ?? 30), w: p.width ? (typeof p.width === "number" ? p.width + "px" : p.width) : "auto",
      t: k[0] === "t" ? top : k[0] === "m" ? "50%" : "auto", b: k[0] === "b" ? bot : "auto",
      l: k[1] === "l" ? side : k[1] === "c" ? "50%" : "auto", r: k[1] === "r" ? side : "auto",
      tr: (k[1] === "c" ? "-50% " : "0 ") + (k[0] === "m" ? "-50%" : "0"),
      noDrag: e => e.preventDefault(),
      down: e => {
        const el = this.ref.current; if (!el || e.button > 0) return;
        const x0 = e.clientX, y0 = e.clientY; let moved = false;
        const move = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
          if (!moved) { moved = true; el.style.transition = "none"; el.style.cursor = "grabbing"; document.body.style.userSelect = "none"; }
          ev.preventDefault(); el.style.transform = "translate(" + dx + "px," + dy + "px)"; };
        const up = () => {
          window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
          if (!moved) return;
          el.style.cursor = ""; document.body.style.userSelect = "";
          const eat = ce => { ce.stopPropagation(); ce.preventDefault(); }; window.addEventListener("click", eat, { capture: true, once: true }); setTimeout(() => window.removeEventListener("click", eat, { capture: true }), 0);
          const r = el.getBoundingClientRect(), pr = el.offsetParent.getBoundingClientRect();
          const cx = r.left + r.width / 2 - pr.left, cy = r.top + r.height / 2 - pr.top;
          const v = cy < pr.height / 3 ? "t" : cy > pr.height * 2 / 3 ? "b" : "m", h = cx < pr.width / 3 ? "l" : cx > pr.width * 2 / 3 ? "r" : "c";
          const pos = v === "m" && h === "c" ? "m" + (cx < pr.width / 2 ? "l" : "r") : v + h;
          el.style.transform = "";
          this.setState({ pos }, () => { const n = el.getBoundingClientRect(); el.style.transform = "translate(" + (r.left - n.left) + "px," + (r.top - n.top) + "px)"; void el.offsetWidth; el.style.transition = "transform 720ms cubic-bezier(.16,1,.3,1)"; el.style.transform = ""; });
          if (p.onSnap) p.onSnap(pos);
        };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
      },
    };
  }
}

export default Component;

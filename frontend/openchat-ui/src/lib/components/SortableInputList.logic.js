// Logic for SortableInputList.svelte — carried over from lib/SortableInputList.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// List editor with drag handles. No "Add" button: a fresh empty row appears once every row is filled (up to `max`).
// Rows past `min` get ×; drag the handle (or Alt+↑/↓ on it) to reorder; duplicates are flagged. onChange(values) gets the non-empty values.
class Component extends DCLogic {
  listRef = React.createRef();
  state = { rows: null, drag: null };
  componentDidUpdate(prev) {
    if (prev.values === this.props.values || this.state.rows == null) return;
    const j = a => (a || []).map(v => v.trim()).filter(Boolean).join("\u0001");
    if (j(this.state.rows) !== j(this.props.values)) this.setState({ rows: null });
  }
  _rows() { const r = this.state.rows ?? (this.props.values ?? ["", ""]).slice(); return this._pad(r); }
  _pad(r) {
    const min = this.props.min ?? 2, max = this.props.max ?? 10; r = r.slice();
    while (r.length < min) r.push("");
    if (r.length < max && r.every(v => v.trim())) r.push("");
    return r;
  }
  _commit(r) { r = this._pad(r); this.setState({ rows: r }); if (this.props.onChange) this.props.onChange(r.map(v => v.trim()).filter(Boolean)); }
  _move(from, to) { const r = this._rows(); if (to < 0 || to >= r.length || from === to) return; const [x] = r.splice(from, 1); r.splice(to, 0, x); this._commit(r); }
  _grab(i, e) {
    const list = this.listRef.current; if (!list) return; e.preventDefault();
    const els = [...list.querySelectorAll("[data-row]")], hs = els.map(el => el.getBoundingClientRect()), step = hs.length > 1 ? hs[1].top - hs[0].top : 52, y0 = e.clientY;
    const move = ev => { const dy = ev.clientY - y0, to = Math.max(0, Math.min(els.length - 1, i + Math.round(dy / step))); this.setState({ drag: { i, dy, to, step } }); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); const d = this.state.drag; this.setState({ drag: null }); if (d) this._move(d.i, d.to); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  renderVals() {
    const p = this.props, r = this._rows(), min = p.min ?? 2, ml = p.maxLength ?? 50, d = this.state.drag, noun = p.itemLabel ?? "Answer";
    const clean = r.map(v => v.trim().toLowerCase()), dup = i => clean[i] && clean.indexOf(clean[i]) !== i;
    const filled = r.filter(v => v.trim()).length;
    return {
      listRef: this.listRef, label: p.label ?? noun + "s", maxLength: ml,
      tidy: () => { const nonEmpty = r.filter((v, i) => v.trim() || i < min); if (nonEmpty.length !== r.length) this._commit(nonEmpty); },
      rows: r.map((v, i) => {
        const trailing = i === r.length - 1 && !v.trim() && i >= min, dragging = d && d.i === i;
        const shift = !d ? "none" : dragging ? "translateY(" + d.dy + "px)" : (i > d.i && i <= d.to) ? "translateY(-" + d.step + "px)" : (i < d.i && i >= d.to) ? "translateY(" + d.step + "px)" : "none";
        return {
          i: String(i), value: v, placeholder: i < min ? noun + " " + (i + 1) : (p.morePlaceholder ?? "Another " + noun.toLowerCase() + " (optional)"), aria: noun + " " + (i + 1),
          onInput: e => { const n = r.slice(); n[i] = e.target.value; this._commit(n); },
          left: String(ml - v.length), countShow: ml - v.length <= 15 ? "block" : "none", dupShow: dup(i) ? "block" : "none",
          ring: dup(i) ? "inset 0 0 0 1px var(--status-warning,#FFB03D)" : dragging ? "0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))",
          shift, trans: dragging ? "none" : "transform 180ms var(--ease-out,ease-out)", z: dragging ? "2" : "auto",
          handleOp: trailing ? "0.3" : "1", handleTab: trailing ? "-1" : "0", moveAria: "Move " + noun.toLowerCase() + " " + (i + 1) + " (Alt + arrow keys)",
          grab: e => { if (!trailing) this._grab(i, e); },
          key: e => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); this._move(i, i + (e.key === "ArrowUp" ? -1 : 1)); } },
          removeShow: !trailing && filled > min - 0 && r.length > min ? "flex" : "none", removeAria: "Remove " + noun.toLowerCase() + " " + (i + 1),
          remove: () => this._commit(r.filter((_, k) => k !== i)),
        };
      }),
    };
  }
}

export default Component;

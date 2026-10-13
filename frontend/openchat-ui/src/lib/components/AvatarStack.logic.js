// Logic for AvatarStack.svelte — carried over from lib/AvatarStack.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Overlapping avatars. Up to `max` shown; past that, max-1 faces + a "+N" badge.
// people: [{ grad|color|src, initial?, name? }] or plain CSS background strings.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, list = (p.people || []).map(x => typeof x === "string" ? { bg: x } : { bg: x.src ? "center/cover url(" + x.src + ")" : (x.grad || x.color || "var(--surface-3,#24242e)"), initial: p.initials ? (x.initial || "") : "", name: x.name });
    const max = p.max ?? 4, size = p.size ?? 28, over = list.length > max;
    const shown = over ? list.slice(0, max - 1) : list, rest = list.length - shown.length;
    const ov = Math.round(size * 0.28) + "px";
    return {
      shown, hasMore: over, more: "+" + rest, px: size + "px", fpx: Math.round(size * 0.4) + "px", neg: "-" + ov, overlap: ov,
      ring: p.ring ?? "var(--surface-2,#191921)",
      aria: list.length + (list.length === 1 ? " person" : " people"),
    };
  }
}

export default Component;

// Logic for Skeleton.svelte — carried over from lib/Skeleton.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Loading placeholder rows shaped like the real lists. Soft shimmer (tokens: --skeleton-base/--skeleton-sheen,
// keyframes oc-shimmer in tokens.css; stops under prefers-reduced-motion). Announces once as "Loading …".
// variant: "chat" | "token" | "activity" | "member".
const SHAPES = {
  chat:     { h: "64px", av: "44px", avRadius: "50%", gap: "12px", pad: "0 var(--space-10)", meta: true, meta2: true, rowGap: "4px", label: "Loading chats" },
  token:    { h: "68px", av: "40px", avRadius: "50%", gap: "14px", pad: "var(--space-12) var(--space-14)", meta: true, meta2: true, bar: true, card: "var(--overlay-1)", rowGap: "8px", label: "Loading tokens" },
  activity: { h: "56px", av: "40px", avRadius: "50%", gap: "12px", pad: "0 var(--space-8)", meta: true, rowGap: "4px", label: "Loading activity" },
  member:   { h: "52px", av: "36px", avRadius: "50%", gap: "12px", pad: "0 var(--space-8)", meta: false, rowGap: "2px", label: "Loading members" },
};
// fixed, varied widths so rows don't look stamped; deterministic so nothing jumps between renders
const W1 = ["46%", "62%", "38%", "54%", "70%", "42%", "58%", "50%"];
const W2 = ["78%", "64%", "84%", "56%", "72%", "88%", "60%", "68%"];
class Component extends DCLogic {
  renderVals() {
    const p = this.props, v = SHAPES[p.variant] ? p.variant : "chat", sh = SHAPES[v], n = p.count ?? 6;
    return {
      label: p.label ?? sh.label, gap: sh.rowGap,
      rows: Array.from({ length: n }, (_, i) => ({
        h: sh.h, av: sh.av, avRadius: sh.avRadius, gap: sh.gap, pad: sh.pad, card: sh.card || "transparent",
        w1: W1[i % W1.length], w2: W2[i % W2.length], w3: W1[(i + 3) % W1.length],
        meta: sh.meta, meta2: !!sh.meta2, bar: !!sh.bar, m1: v === "token" ? "56px" : "34px",
        delay: (i * 90) + "ms",
      })),
    };
  }
}

export default Component;

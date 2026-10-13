// Logic for Pill.svelte — carried over from lib/Pill.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const TONES = {
  neutral: ["var(--overlay-2,rgba(255,255,255,.06))", "var(--ink-2,#C9C9D4)"],
  success: ["rgba(46,230,168,.12)", "var(--status-online,#2EE6A8)"],
  warning: ["rgba(255,176,61,.12)", "var(--status-gold,#FFB03D)"],
  danger: ["rgba(245,73,61,.12)", "var(--status-danger,#F5493D)"],
  accent: ["var(--accent-soft,rgba(255,86,114,.14))", "var(--accent-bright,#FF8298)"],
};
// Status / value chip. sm (18px, sans, for row statuses like Pending) or md (22px, mono, for numbers like timers and % change).
class Component extends DCLogic {
  renderVals() {
    const p = this.props, md = (p.size ?? "sm") === "md", t = TONES[p.tone ?? "neutral"] || TONES.neutral;
    return { 
      label: p.label ?? "Pending", dot: !!p.dot,
      bg: t[0], ink: t[1],
      h: md ? "22px" : "18px", padX: md ? "8px" : "7px",
      font: md ? "600 12px/1 var(--font-mono)" : "var(--weight-semibold) 11px/1 var(--font-sans)",
    };
  }
}

export default Component;

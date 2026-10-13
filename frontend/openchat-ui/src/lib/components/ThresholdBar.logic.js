// Logic for ThresholdBar.svelte — carried over from lib/ThresholdBar.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Two-sided vote bar with threshold lines. yes grows from the left, no from the right (fractions 0–1).
// thresholds: [{ at: 0–1, label, strong }] — strong = auto-accept (triangle), else soft "accepted when time runs out" (chevron).
class Component extends DCLogic {
  renderVals() {
    const p = this.props, pc = v => (Math.max(0, Math.min(1, v)) * 100).toFixed(2) + "%";
    const th = p.thresholds ?? [{ at: 0.5, label: "Majority — adopted when voting ends" }, { at: 0.75, label: "Adopted immediately", strong: true }];
    const yes = p.yes ?? 0.62, no = p.no ?? 0.14;
    return {
      h: (p.height ?? 8) + "px", yesW: pc(yes), noW: pc(no),
      yesInk: p.yesColor ?? "var(--status-online,#2EE6A8)", noInk: p.noColor ?? "var(--status-danger,#FF4D4D)",
      marks: th.map(t => ({ at: pc(t.at), label: t.label || "", strong: !!t.strong, soft: !t.strong, line: t.strong ? "var(--ink,#ECECF1)" : "var(--ink-2,#C9C9D4)" })),
      aria: p.label ?? (Math.round(yes * 100) + "% yes, " + Math.round(no * 100) + "% no"),
    };
  }
}

export default Component;

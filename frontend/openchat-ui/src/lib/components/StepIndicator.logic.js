// Logic for StepIndicator.svelte — carried over from lib/StepIndicator.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Horizontal journey steps for page headers (Details → Quote → Swap). current is 0-based; complete ticks every step.
// compact shows only the current step's label (narrow layouts).
class Component extends DCLogic {
  renderVals() {
    const p = this.props, labels = p.steps ?? ["Details", "Quote", "Swap"], cur = p.current ?? 0, all = !!p.complete;
    return { 
      aria: "Step " + (Math.min(cur, labels.length - 1) + 1) + " of " + labels.length,
      steps: labels.map((label, i) => {
        const done = all || i < cur, on = i <= cur || all;
        return { label, n: done ? "\u2713" : String(i + 1), current: !all && i === cur ? "step" : undefined,
          sep: i < labels.length - 1 ? "block" : "none", labelShow: p.compact && i !== cur ? "none" : "inline",
          bg: on ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.08))",
          numInk: on ? "var(--on-accent,#2E0512)" : "var(--ink-3,#9A9AA8)",
          ink: i === cur ? "var(--ink,#ECECF1)" : "var(--ink-4,#8A8A99)" };
      }),
    };
  }
}

export default Component;

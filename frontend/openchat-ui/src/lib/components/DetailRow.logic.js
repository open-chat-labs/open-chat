// Logic for DetailRow.svelte — carried over from lib/DetailRow.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const TONES = { default: "var(--ink,#ECECF1)", positive: "var(--status-online,#2EE6A8)", warning: "var(--status-gold,#FFB03D)", danger: "var(--status-danger,#F5493D)", muted: "var(--ink-3,#9A9AA8)" };
const SIZES = { sm: "42px", md: "50px", lg: "56px" };
// Label left, mono value right; for quotes, summaries and token facts. Optional copy, value tone (or raw valueColor), rule above/below, bold total.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, strong = !!p.strong, rule = p.rule ?? "top";
    const line = "1px solid var(--line-1,rgba(255,255,255,.06))";
    return { 
      label: p.label ?? "Transfer fee", value: p.value ?? "0.0001 ICP",
      minH: SIZES[p.size ?? "md"] || SIZES.md,
      ruleTop: rule === "top" ? line : "none", ruleBottom: rule === "bottom" ? line : "none",
      labelFont: strong ? "700 14.5px/1 var(--font-sans)" : "var(--weight-medium) 13.5px/1 var(--font-sans)",
      labelInk: strong ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)",
      valueFont: strong ? "700 15px/1.3 var(--font-mono)" : "600 13px/1.3 var(--font-mono)",
      valueInk: p.valueColor || TONES[p.tone ?? "default"] || TONES.default,
      hasCopy: !!p.copyValue, copyValue: p.copyValue ?? "", copyLabel: p.copyLabel ?? "Copy",
    };
  }
}

export default Component;

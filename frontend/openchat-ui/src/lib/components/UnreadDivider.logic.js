// Logic for UnreadDivider.svelte — carried over from lib/UnreadDivider.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  renderVals() {
    const tone = this.props.tone ?? "accent";
    return {
      label: (this.props.label ?? "Unread messages").toUpperCase(),
      // date markers are pills; the unread marker keeps its accent rule
      isPill: tone === "neutral", isLine: tone !== "neutral",
      pillLabel: this.props.label ?? "Today",
      lineColor: tone === "accent" ? "var(--accent-dim,rgba(255,86,114,.35))" : "var(--line-2,rgba(255,255,255,.1))",
      textColor: tone === "accent" ? "var(--accent,#FF5672)" : "var(--ink-3,#8A8A99)",
    };
  }
}

export default Component;

// Logic for Banner.svelte — carried over from lib/Banner.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// public icon keys → canonical names in lib/icons.js
const ICONS = {
  "info": "info",
  "warning": "warning",
  "danger": "warning",
  "offline": "offline"
};

class Component extends DCLogic {
  renderVals() {
    const tone = this.props.tone ?? "info";
    const icon = tone === "offline" ? "offline" : tone;
    const tint = tone === "danger" ? "var(--status-danger,#F5493D)" : (tone === "warning" || tone === "offline" ? "var(--status-chit,#FF9F45)" : "var(--accent,#FF5672)");
    const wash = tone === "danger" ? "var(--btn-danger-bg,rgba(240,68,56,.08))" : (tone === "warning" || tone === "offline" ? "var(--status-chit-soft,rgba(255,159,69,.14))" : "var(--accent-soft,rgba(255,86,114,.09))");
    const line = tone === "danger" ? "var(--btn-danger-line,rgba(240,68,56,.5))" : (tone === "warning" || tone === "offline" ? "var(--status-chit,#FF9F45)" : "var(--accent-dim,rgba(255,86,114,.35))");
    const label = this.props.actionLabel ?? "";
    return {
      text: this.props.text ?? "You're offline. Messages will send when you reconnect.",
      actionLabel: label,
      hasAction: !!label,
      actionHandler: this.props.actionHandler,
      tint,
      wash,
      line,
      iconMask: "var(--icon-" + (ICONS[icon] || ICONS.info) + ") center/contain no-repeat",
    };
  }
}

export default Component;

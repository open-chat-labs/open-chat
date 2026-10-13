// Logic for RoundIconButton.svelte — carried over from lib/RoundIconButton.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Circular icon control (call controls, mini call, recorder).
// variant: default | on (accent) | off (inverted — e.g. camera off) | danger | overlay (on video). size: sm 34 | md 50 | lg 56.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, v = p.variant || "default", sz = { sm: [34, 14], md: [50, 20], lg: [56, 22] }[p.size || "sm"] || [34, 14];
    const bg = { on: "var(--accent,#FF5672)", off: "#ECECF1", danger: "var(--status-danger,#F5493D)", overlay: "rgba(0,0,0,.4)" }[v] || "var(--overlay-2,rgba(255,255,255,.1))";
    const ink = v === "on" ? "var(--on-accent,#2E0512)" : v === "off" ? "#0e0e12" : v === "danger" || v === "overlay" ? "#fff" : "var(--ink,#ECECF1)";
    const press = e => { if (p.onPress) p.onPress(e); };
    return {
      press, key: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(e); } },
      label: p.label || "", tip: p.tooltip === false ? undefined : (p.label || undefined), pressed: p.pressed == null ? undefined : String(!!p.pressed),
      px: sz[0] + "px", ipx: sz[1] + "px", bg, ink, mask: "var(--icon-" + (p.icon || "close") + ") center/contain no-repeat",
    };
  }
}

export default Component;

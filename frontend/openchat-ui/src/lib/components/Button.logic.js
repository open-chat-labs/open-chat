// Logic for Button.svelte — carried over from lib/Button.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  renderVals() {
    const v = this.props.disabled ? "disabled" : (this.props.variant ?? "primary");
    const st = this.props.state ?? "default";
    const rootWidth = this.props.fullWidth ? "100%" : "auto";
    const ring = st === "focus" ? "0 0 0 3px var(--accent-dim,rgba(255,86,114,.35))" : (st === "active" ? "inset 0 2px 6px rgba(0,0,0,.32)" : "none");
    const press = st === "active" ? "scale(.97)" : "none";
    return {
      label: this.props.label ?? "Button",
      onPress: this.props.onClick,
      isPrimary: v === "primary",
      isSecondary: v === "secondary",
      isGhost: v === "ghost",
      isDanger: v === "danger",
      rootWidth,
      isDisabled: v === "disabled",
      pressTransform: press,
      primaryBg: st === "hover" ? "var(--accent-hover,#ff6d85)" : "var(--accent,#FF5672)",
      secondaryBg: st === "hover" ? "var(--btn-hover,rgba(255,255,255,.1))" : "var(--overlay-1,rgba(255,255,255,.05))",
      ghostBg: st === "hover" || st === "active" ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent",
      dangerBg: st === "hover" ? "var(--btn-danger-bg-hover,rgba(224,49,49,.16))" : "var(--btn-danger-bg,rgba(224,49,49,.07))",
      focusRing: ring,
      secondaryRing: "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))" + (ring === "none" ? "" : "," + ring),
      dangerRing: "inset 0 0 0 1px var(--btn-danger-line,rgba(224,49,49,.45))" + (ring === "none" ? "" : "," + ring),
    };
  }
}

export default Component;

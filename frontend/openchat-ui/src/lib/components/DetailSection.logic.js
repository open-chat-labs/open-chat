// Logic for DetailSection.svelte — carried over from lib/DetailSection.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  state = { open: false };
  renderVals() {
    const variant = this.props.variant ?? "value";
    // prose can clamp to N lines with a More / Less toggle (side panels)
    const clamp = Number(this.props.clamp) || 0;
    const long = clamp > 0 && String(this.props.value ?? "").length > clamp * 38;
    return {
      lineClamp: long && !this.state.open ? String(clamp) : "unset",
      canExpand: long,
      moreLabel: this.state.open ? "Less" : "More",
      toggleMore: () => this.setState(st => ({ open: !st.open })),
      label: (this.props.label ?? "Label").toUpperCase(),
      value: this.props.value ?? "",
      isProse: variant === "prose",
      isValue: variant !== "prose",
      hasDot: this.props.dot ?? false,
      valueColor: this.props.highlight ? "var(--accent-bright,#FF8298)" : "var(--ink,#E4E4EC)",
    };
  }
}

export default Component;

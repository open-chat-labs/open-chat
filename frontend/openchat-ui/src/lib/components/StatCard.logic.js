// Logic for StatCard.svelte — carried over from lib/StatCard.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  renderVals() {
    return {
      label: (this.props.label ?? "Member since").toUpperCase(),
      value: this.props.value ?? "1 Nov 2021",
      valueInk: (this.props.emphasis ?? false) ? "var(--accent-bright,#FF8298)" : "var(--ink,#E4E4EC)",
    };
  }
}

export default Component;

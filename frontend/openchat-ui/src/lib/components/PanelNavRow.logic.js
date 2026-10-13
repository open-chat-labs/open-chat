// Logic for PanelNavRow.svelte — carried over from lib/PanelNavRow.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const CHEVRON = "var(--icon-chevron-right) center/contain no-repeat";

class Component extends DCLogic {
  renderVals() {
    const hint = this.props.hint ?? "";
    const value = this.props.value ?? "";
    return {
      label: this.props.label ?? "Section",
      hint,
      hasHint: !!hint,
      value,
      hasValue: !!value,
      valueColor: this.props.highlight ? "var(--accent-bright,#FF8298)" : "var(--ink-3,#9A9AA8)",
      chevronMask: CHEVRON,
      onPress: this.props.onClick,
    };
  }
}

export default Component;

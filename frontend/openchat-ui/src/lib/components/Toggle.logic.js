// Logic for Toggle.svelte — carried over from lib/Toggle.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  state = { on: null };
  // let a parent that drives `on` win back control (e.g. a cancelled PIN flow)
  componentDidUpdate(prev) {
    if (prev.on !== this.props.on && this.state.on !== this.props.on) {
      this.setState({ on: this.props.on });
    }
  }
  renderVals() {
    const on = this.state.on === null ? (this.props.on ?? true) : this.state.on;
    const label = this.props.label ?? "";
    const help = this.props.help ?? "";
    return {
      label, help,
      hasLabel: !!label,
      hasHelp: !!help,
      rootWidth: this.props.label ? "100%" : "42px",
      rootHeight: this.props.label ? "auto" : "24px",
      isOn: on, ariaChecked: on ? "true" : "false", ariaName: label || undefined, ariaDisabled: this.props.disabled ? "true" : undefined,
      isOff: !on,
      trackBg: on ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.14))",
      knobBg: on ? "#fff" : "var(--ink-4,#6E6E7C)",
      knobShift: on ? "translateX(calc(var(--oc-dir,1) * 16px))" : "translateX(0)",
      cursor: this.props.disabled ? "not-allowed" : "pointer",
      opacity: this.props.disabled ? 0.4 : 1,
      toggle: () => {
        if (this.props.disabled) return;
        this.setState({ on: !on });
        if (this.props.onChange) this.props.onChange(!on);
      },
    };
  }
}

export default Component;

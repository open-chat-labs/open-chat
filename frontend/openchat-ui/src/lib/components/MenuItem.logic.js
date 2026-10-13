// Logic for MenuItem.svelte — carried over from lib/MenuItem.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  state = { vw: typeof window === "undefined" ? 1920 : window.innerWidth };

  componentDidMount() {
    this._onResize = () => this.setState({ vw: window.innerWidth });
    window.addEventListener("resize", this._onResize);
  }

  componentWillUnmount() { window.removeEventListener("resize", this._onResize); }

  renderVals() {
    const vw = this.state.vw;
    const minVw = this.props.minVw ?? null;
    const maxVw = this.props.maxVw ?? null;
    const visible = (minVw == null || vw >= minVw) && (maxVw == null || vw < maxVw);
    const variant = this.props.variant ?? "regular";
    const mask = this.props.icon ? "var(--icon-" + this.props.icon + ") center/contain no-repeat" : (this.props.mask ?? "");
    const shortcut = this.props.shortcut ?? "";
    return {
      isSeparator: visible && variant === "separator",
      isAction: visible && variant !== "separator",
      color: variant === "danger" ? "var(--status-danger,#F5493D)" : "var(--ink-2,#B9B9C6)",
      label: this.props.label ?? "Menu item",
      mask,
      hasIcon: !!mask,
      checkMask: this.props.checkMask ?? "",
      hasCheck: !!this.props.checkMask,
      shortcut,
      hasShortcut: !!shortcut,
      onSelect: this.props.onSelect,
    };
  }
}

export default Component;

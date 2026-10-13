// Logic for TextArea.svelte — carried over from lib/TextArea.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const ALERT = "var(--icon-warning) center/contain no-repeat";

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this._area = React.createRef();
  }

  // grows with its content; measured on the node so a keystroke costs one render
  _fit() {
    const el = this._area.current;
    if (!el) return;
    const min = this.props.minHeight ?? 76;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, min) + "px";
  }

  componentDidMount() { this._fit(); }
  componentDidUpdate() { this._fit(); }

  renderVals() {
    const value = this.props.value ?? "";
    const max = this.props.maxLength;
    const remaining = max ? max - String(value).length : 0;
    const error = !!this.props.error;
    const note = error ? (this.props.errorText ?? "") : (this.props.help ?? "");

    return {
      areaRef: this._area,
      value,
      onInput: this.props.onInput,
      placeholder: this.props.placeholder ?? "",
      maxLength: max,
      rows: 2,
      minHeight: (this.props.minHeight ?? 76) + "px",
      showCount: !!max,
      left: String(remaining),
      leftInk: max && remaining <= Math.max(5, Math.round(max * 0.08))
        ? "var(--status-warning,#FFB03D)"
        : "var(--ink-4,#7C7C8C)",
      line: error ? "var(--status-danger,#F5493D)" : "var(--line-2,rgba(255,255,255,.1))",
      error,
      alertMask: ALERT,
      hasNote: !!note,
      note,
      noteInk: error ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",
      noteWeight: error ? "var(--weight-medium)" : "var(--weight-regular)",
    };
  }
}

export default Component;

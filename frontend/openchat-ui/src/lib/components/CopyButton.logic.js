// Logic for CopyButton.svelte — carried over from lib/CopyButton.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const COPY = "var(--icon-copy) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
// Icon-only copy: writes value to the clipboard, shows a check for 1.6s.
class Component extends DCLogic {
  state = { done: false };
  componentWillUnmount() { clearTimeout(this._t); }
  renderVals() {
    const p = this.props, sm = (p.size ?? "sm") === "sm", done = this.state.done;
    return { 
      box: sm ? "26px" : "34px", icon: sm ? "13px" : "16px",
      mask: done ? CHECK : COPY, ink: done ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#9A9AA8)",
      tip: done ? "Copied" : (p.label ?? "Copy"),
      copy: e => {
        if (e && e.stopPropagation) e.stopPropagation();
        try { navigator.clipboard.writeText(String(p.value ?? "")); } catch (err) {}
        if (p.onCopy) p.onCopy();
        this.setState({ done: true }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ done: false }), 1600);
      },
    };
  }
}

export default Component;

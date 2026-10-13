// Logic for Spinner.svelte — carried over from lib/Spinner.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  renderVals() {
    const size = this.props.size ?? 32;
    const tone = this.props.tone ?? "accent";
    const stroke = size <= 20 ? 2 : size <= 36 ? 2.5 : 3;
    const r = 12 - stroke / 2, c = 2 * Math.PI * r;
    const arc = tone === "ink" ? "var(--ink,#ECECF1)" : "var(--accent,#FF5672)";
    return { label: this.props.label ?? "Loading", size, stroke, r, arc, dash: (c * 0.28) + " " + c };
  }
}

export default Component;

// Logic for Tooltip.svelte — carried over from lib/Tooltip.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Visual spec for the app-wide tooltip (behaviour: lib/tooltip.js — any element with a title gets it).
// Plain label only: inverted surface, 12px semibold, 400ms delay, above the target (flips below near the top edge).
class Component extends DCLogic {
  renderVals() {
    return { label: this.props.label ?? "Mute notifications", dir: (this.props.placement ?? "top") === "top" ? "column" : "column-reverse" };
  }
}

export default Component;

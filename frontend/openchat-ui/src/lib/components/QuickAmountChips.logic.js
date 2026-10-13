// Logic for QuickAmountChips.svelte — carried over from lib/QuickAmountChips.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Fraction-of-balance shortcuts. Emits onPick(fraction); the parent turns it into an amount (respecting decimals and fees).
class Component extends DCLogic {
  renderVals() {
    const p = this.props, md = (p.size ?? "sm") === "md";
    const opts = p.options ?? [0.25, 0.5, 0.75, 1];
    return { 
      h: md ? "30px" : "28px", padX: md ? "12px" : "10px", radius: md ? "9px" : "8px", fs: md ? "12.5px" : "12px",
      chips: opts.map(k => ({ label: k >= 1 ? "Max" : Math.round(k * 100) + "%", pick: () => { if (p.onSelect) p.onSelect(k); } })),
    };
  }
}

export default Component;

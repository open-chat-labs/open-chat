// Logic for ShareBar.svelte — carried over from lib/ShareBar.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Thin share bar (token's share of the wallet). Minimum 2% sliver so tiny holdings stay visible;
// veiled (balances hidden) animates every bar to the same 33% so lengths don't leak holdings.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, share = Math.max(0, Math.min(100, Number(p.share ?? 41.3)));
    return { 
      h: (p.thickness ?? 2) + "px",
      width: p.veiled ? "33%" : Math.max(2, share).toFixed(1) + "%",
      aria: p.veiled ? undefined : String(Math.round(share)),
      gradient: p.gradient ?? "var(--accent,#FF5672)",
    };
  }
}

export default Component;

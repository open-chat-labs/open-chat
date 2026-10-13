// Logic for TokenCoin.svelte — hand-adapted from lib/TokenCoin.dc.html (prototype built the coin with createElement).
import { DCLogic } from '../../lib/dc/logic.js';

// 3D spinning token coin: stacked edge layers + two faces with the token mark, soft floor shadow. Paused with reduced motion.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, size = p.size ?? 80, T = Math.round(size * 0.14), edge = p.edge ?? "#7a2bd0", edge2 = p.edge2 ?? "#5a1fa0", layers = [];
    for (let z = -T / 2; z <= T / 2; z += 1) layers.push({ z, bg: Math.round(z) % 2 === 0 ? edge : edge2 });
    const d = T / 2 + 0.5;
    return {
      size, layers, faces: [{ tr: "translateZ(" + d + "px)" }, { tr: "rotateY(180deg) translateZ(" + d + "px)" }],
      gradient: p.gradient ?? "linear-gradient(140deg,#ff5f9e,#6a2bff)", mark: p.mark ?? "∞", rim: Math.max(2, size * 0.05), markPx: Math.round(size * 0.42),
      aria: (p.symbol ?? "ICP") + " token",
    };
  }
}

export default Component;

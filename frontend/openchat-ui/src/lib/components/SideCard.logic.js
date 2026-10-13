// Logic for SideCard.svelte — carried over from lib/SideCard.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// The right-hand card in wallet workspaces (Send summary, Swap quote, token card). Content is children.
class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    return { 
      minH: p.minHeight ?? "0",
      gap: p.gap ?? "0",
      pad: p.pad ?? "24px",
      children: p.children,
    };
  }
}

export default Component;

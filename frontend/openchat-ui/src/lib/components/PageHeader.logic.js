// Logic for PageHeader.svelte — carried over from lib/PageHeader.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Header for workspace pages (wallet token page, Send, Receive, Swap): back · optional 28px token avatar · title · trailing slot.
// Trailing content (steps, balance) is passed as children.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, back = !!p.onBack;
    return { 
      title: p.title ?? "Swap ICP",
      hasBack: back, onBack: p.onBack, backLabel: p.backLabel ?? "Back",
      padStart: back ? "var(--space-14)" : "var(--space-24)",
      hasAvatar: !!p.avatarMark, avatarMark: p.avatarMark, avatarGradient: p.avatarGradient,
      hasTrailing: p.children != null && p.children !== false && !(Array.isArray(p.children) && !p.children.length),
      children: p.children,
    };
  }
}

export default Component;

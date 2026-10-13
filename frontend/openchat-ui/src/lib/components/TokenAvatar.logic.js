// Logic for TokenAvatar.svelte — carried over from lib/TokenAvatar.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const BADGES = {
  send: "var(--icon-send) center/contain no-repeat",
  receive: "var(--icon-receive) center/contain no-repeat",
  swap: "var(--icon-swap) center/contain no-repeat",
};
// Token mark on its brand gradient. Sizes in use: 28 (headers, pills), 40 (rows), 52 (hero). Optional activity badge.
class Component extends DCLogic {
  renderVals() {
    const size = this.props.size ?? 40;
    const badge = this.props.badge && this.props.badge !== "none" ? this.props.badge : null;
    return { 
      symbol: this.props.symbol ?? "",
      mark: this.props.mark ?? "\u221E",
      gradient: this.props.gradient ?? "linear-gradient(140deg,#ff5f9e,#6a2bff)",
      px: size + "px", fontPx: Math.round(size * 0.38) + "px",
      hasBadge: !!badge && !!BADGES[badge], badgeMask: badge ? BADGES[badge] : "",
      badgePx: (size >= 36 ? 18 : 14) + "px", badgeIcon: (size >= 36 ? 10 : 8) + "px",
    };
  }
}

export default Component;

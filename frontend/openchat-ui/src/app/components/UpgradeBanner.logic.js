// Logic for UpgradeBanner.svelte — carried over from lib/UpgradeBanner.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const GEM = "var(--icon-gem) center/contain no-repeat";
class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    return { gemMask: GEM,
      text: p.text ?? "This is a Diamond feature.",
      actionLabel: p.actionLabel ?? "Upgrade",
      onUpgrade: p.onUpgrade,
    };
  }
}

export default Component;

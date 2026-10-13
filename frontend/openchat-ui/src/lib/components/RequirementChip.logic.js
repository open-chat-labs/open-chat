// Logic for RequirementChip.svelte — carried over from lib/RequirementChip.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Gate / requirement chip. state: met (green check) | unmet (amber lock) | neutral (no verdict yet, e.g. guest). size sm 22 | md 26.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, s = p.state ?? (p.met === true ? "met" : p.met === false ? "unmet" : "neutral"), sm = p.size === "sm";
    const look = {
      met: ["check", "var(--status-online,#2EE6A8)", "color-mix(in oklch,var(--status-online,#2EE6A8) 13%,transparent)", "met"],
      unmet: ["lock", "var(--status-warning,#FFB03D)", "color-mix(in oklch,var(--status-warning,#FFB03D) 14%,transparent)", "not met"],
      neutral: [p.icon || "shield", "var(--ink-2,#B9B9C6)", "var(--overlay-2,rgba(255,255,255,.08))", ""],
    }[s] || [];
    return {
      label: p.label ?? "Diamond member", mask: "var(--icon-" + (s === "neutral" ? look[0] : (p.icon && s === "met" ? look[0] : look[0])) + ") center/contain no-repeat",
      ink: look[1], bg: look[2], aria: (p.label ?? "Diamond member") + (look[3] ? " — " + look[3] : ""),
      h: sm ? "22px" : "26px", px: sm ? "8px" : "9px", fs: sm ? "11.5px" : "12px",
    };
  }
}

export default Component;

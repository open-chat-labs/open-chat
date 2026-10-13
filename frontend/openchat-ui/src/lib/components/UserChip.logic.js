// Logic for UserChip.svelte — carried over from lib/UserChip.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const CLOSE = "var(--icon-close) center/contain no-repeat";

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  rose: "linear-gradient(140deg,#FF6B8B,#C13584)",
  plum: "linear-gradient(140deg,#B06BFF,#6A2BFF)",
  slate: "linear-gradient(140deg,#8E9BB3,#5A6478)",
};

const SIZES = {
  sm: { pad: "3px var(--space-6) 3px 3px", avatar: "20px", initials: "9px", label: "var(--text-sm)", remove: "17px", icon: "9px" },
  md: { pad: "4px var(--space-8) 4px 4px", avatar: "26px", initials: "11px", label: "var(--text-md)", remove: "20px", icon: "11px" },
  lg: { pad: "5px var(--space-10) 5px 5px", avatar: "32px", initials: "13px", label: "var(--text-base)", remove: "24px", icon: "12px" },
};

class Component extends DCLogic {
  renderVals() {
    const size = SIZES[this.props.size] ?? SIZES.md;
    const variant = this.props.variant ?? "neutral";
    const label = this.props.label ?? "Alice Anderson";
    const interactive = !!this.props.onClick;
    const accentTone = variant === "accent";
    const dangerTone = variant === "danger";
    const tone = dangerTone ? "var(--status-danger,#F5493D)" : "var(--accent,#FF5672)";

    return {
      label,
      gradient: GRADIENTS[this.props.color ?? "violet"] ?? GRADIENTS.violet,
      avatarSize: size.avatar,
      labelSize: size.label,
      labelWeight: "var(--weight-semibold)",
      pad: this.props.showAvatar === false ? size.pad.replace(/ [\d]+px$/, " var(--space-8)") : size.pad,
      removeSize: size.remove,
      removeIcon: size.icon,
      closeMask: CLOSE,
      showAvatar: this.props.showAvatar ?? true,
      showRemove: this.props.showRemove ?? true,
      online: this.props.online ?? false,
      dotRing: accentTone || dangerTone ? "var(--surface-1,#0e0e12)" : "var(--surface-2,#17171d)",
      hasTag: !!this.props.tag,
      tag: this.props.tag ?? "",
      bg: accentTone || dangerTone
        ? "color-mix(in srgb, " + tone + " 14%, transparent)"
        : "var(--overlay-1,rgba(255,255,255,.06))",
      line: accentTone || dangerTone
        ? "color-mix(in srgb, " + tone + " 32%, transparent)"
        : "var(--line-2,rgba(255,255,255,.1))",
      ink: accentTone ? "var(--accent-bright,#FF8298)" : dangerTone ? "var(--status-danger,#F5493D)" : "var(--ink,#ECECF1)",
      removeInk: accentTone ? "var(--accent-bright,#FF8298)" : dangerTone ? "var(--status-danger,#F5493D)" : "var(--ink-3,#9A9AA8)",
      cursor: interactive ? "pointer" : "default",
      hoverStyle: interactive ? "var(--overlay-2,rgba(255,255,255,.1))" : "",
      onPress: this.props.onClick,
      onRemove: this.props.onRemove,
    };
  }
}

export default Component;

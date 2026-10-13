// Logic for MemberRow.svelte — carried over from lib/MemberRow.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const MENU = "var(--icon-kebab) center/contain no-repeat";
const INVITE = "var(--icon-invite) center/contain no-repeat";
const HOOK = "var(--icon-hook) center/contain no-repeat";

// right-side icon affordances — the common alternatives to a kebab
const ICONS = {
  check: "var(--icon-check) center/contain no-repeat",
  plus: "var(--icon-plus) center/contain no-repeat",
  close: "var(--icon-close) center/contain no-repeat",
  chevron: "var(--icon-chevron-right) center/contain no-repeat",
  star: "var(--icon-star) center/contain no-repeat",
  message: "var(--icon-chat) center/contain no-repeat",
};

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  rose: "linear-gradient(140deg,#FF6B8B,#C13584)",
  plum: "linear-gradient(140deg,#B06BFF,#6A2BFF)",
  slate: "linear-gradient(140deg,#8E9BB3,#5A6478)",
};

class Component extends DCLogic {
  renderVals() {
    const variant = this.props.variant ?? "member";
    const isInvite = variant === "invite";
    const isBot = variant === "bot";
    const subtitle = this.props.subtitle ?? "";
    const tag = this.props.tag ?? "";
    const icon = this.props.icon ?? "";
    const selected = this.props.selected ?? false;
    // icon "toggle": a round add/check picker, and the whole row reads as selected
    const isToggle = icon === "toggle";
    const disabled = this.props.disabled ?? false;
    const muted = this.props.muted ?? false;
    return {
      rowBg: isToggle && selected ? "color-mix(in srgb, var(--accent,#FF5672) 8%, transparent)" : "transparent",
      // on raised surfaces (sidebar cards) the default overlay is too faint, so the host can pass its own
      rowHoverBg: this.props.hoverBg && !disabled ? this.props.hoverBg : disabled ? "transparent" : isToggle && selected ? "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)" : "var(--overlay-1,rgba(255,255,255,.05))",
      rowOpacity: disabled ? 0.55 : 1,
      rowCursor: disabled ? "default" : "pointer",
      avatarOpacity: muted ? 0.7 : 1,
      badge: this.props.badge ?? "",
      hasBadge: !!this.props.badge,
      showToggle: isToggle && !disabled,
      toggleBg: selected ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.07))",
      toggleLine: selected ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
      toggleInk: selected ? "var(--on-accent,#2E0512)" : "var(--ink-2,#B9B9C6)",
      toggleMask: selected ? ICONS.check : ICONS.plus,
      title: this.props.title ?? "Member",
      titleColor: isInvite ? "var(--accent,#FF5672)" : muted ? "var(--ink-2,#C9C9D4)" : "var(--ink,#E4E4EC)",
      subtitle,
      hasSubtitle: !!subtitle,
      // bots describe themselves in prose; members show a handle in mono
      subtitleFont: isBot ? "var(--font-sans)" : "var(--font-mono)",
      subtitleSize: isBot ? "var(--text-sm)" : "var(--text-xs)",
      subtitleClamp: isBot ? "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal" : "white-space:nowrap",
      tag,
      hasTag: !!tag,
      // your own row: a YOU chip alongside your role chip
      isYou: !!this.props.isYou,
      isInvite,
      isWebhook: variant === "webhook",
      hasPhoto: !!this.props.image,
      photo: this.props.image ? 'url(' + this.props.image + ') center/cover no-repeat' : 'none',
      hookMask: HOOK,
      hasAvatar: !isInvite,
      avatarGradient: GRADIENTS[this.props.color ?? "violet"] ?? GRADIENTS.violet,
      avatarRadius: isBot || variant === "webhook" ? "var(--radius-md)" : "var(--radius-pill)",
      showAction: !!this.props.actionLabel,
      actionLabel: this.props.actionLabel ?? "",
      onAction: this.props.onAction,
      online: this.props.online ?? false,
      ringColor: this.props.ringColor ?? "var(--card,#0e0e12)",
      // activity: "typing" (animated dots), "now", or a short "2m"-style time since active
      isTyping: this.props.activity === "typing",
      hasActivityText: !!this.props.activity && this.props.activity !== "typing",
      activity: this.props.activity ?? "",
      activityInk: this.props.activity === "now" ? "var(--status-online,#2EE6A8)" : "var(--ink-4,#7C7C8C)",
      activityWeight: this.props.activity === "now" ? "var(--weight-semibold)" : "var(--weight-medium)",
      typingDots: this.props.activity === "typing",
      showIcon: !!icon && !isToggle,
      iconMaskValue: ICONS[icon] ?? ICONS.chevron,
      iconInk: selected ? "var(--on-accent,#2E0512)" : "var(--ink-3,#9A9AA8)",
      iconBg: selected ? "var(--accent,#FF5672)" : "transparent",
      onIcon: this.props.onIcon ?? this.props.onClick,
      showMenu: (this.props.showMenu ?? true) && !isInvite && !this.props.actionLabel && !icon && !this.props.badge,
      menuMask: MENU,
      inviteMask: INVITE,
      onPress: this.props.onClick,
      onMenu: this.props.onMenu,
    };
  }
}

export default Component;

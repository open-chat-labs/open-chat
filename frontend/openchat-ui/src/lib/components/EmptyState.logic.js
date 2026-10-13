// Logic for EmptyState.svelte — carried over from lib/EmptyState.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// public icon keys → canonical names in lib/icons.js
const ICONS = {
  "search": "search",
  "emoji": "emoji",
  "users": "users",
  "offline": "offline",
  "alert": "warning",
  "send": "wallet-send",
  "receive": "receive",
  "swap": "swap"
};

const PRESETS = {
  "no-conversations": { icon: "emoji", title: "No conversations yet", body: "Start a direct message or join a community to see it here.", actionLabel: "New message" },
  "no-results": { icon: "search", title: "No matches", body: "Nothing matched that search. Try a different name or keyword.", actionLabel: "" },
  "no-members": { icon: "users", title: "Just you in here", body: "Invite people to the group and their messages will appear in this thread.", actionLabel: "Invite people" },
  offline: { icon: "offline", title: "You're offline", body: "Messages you send will queue and deliver once the connection is back.", actionLabel: "Retry now", tone: "warning" },
  error: { icon: "alert", title: "Couldn't load messages", body: "Something went wrong on our side. Your drafts are safe.", actionLabel: "Try again", tone: "danger" },
};

class Component extends DCLogic {
  renderVals() {
    const p = PRESETS[this.props.preset ?? "no-conversations"] ?? PRESETS["no-conversations"];
    const tone = this.props.tone ?? p.tone ?? "neutral";
    const label = this.props.actionLabel ?? p.actionLabel;
    const toneColor = tone === "danger" ? "var(--status-danger,#F5493D)" : (tone === "warning" ? "var(--status-chit,#FF9F45)" : "var(--ink-3,#8A8A99)");
    const toneWash = tone === "danger" ? "var(--btn-danger-bg,rgba(240,68,56,.08))" : (tone === "warning" ? "var(--status-chit-soft,rgba(255,159,69,.14))" : "var(--overlay-2,rgba(255,255,255,.09))");
    return {
      title: this.props.title ?? p.title,
      body: this.props.body ?? p.body,
      actionLabel: label,
      hasAction: !!label,
      actionHandler: this.props.actionHandler,
      iconColor: toneColor,
      iconWash: toneWash,
      iconMask: "var(--icon-" + (ICONS[this.props.icon ?? p.icon] || ICONS.emoji) + ") center/contain no-repeat",
    };
  }
}

export default Component;

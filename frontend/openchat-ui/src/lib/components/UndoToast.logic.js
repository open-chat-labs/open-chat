// Logic for UndoToast.svelte — carried over from lib/UndoToast.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const ICONS = {
  undo: "var(--icon-rotate-back) center/contain no-repeat",
  hide: "var(--icon-eye-off) center/contain no-repeat",
  trash: "var(--icon-trash) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
};
const CLOSE = "var(--icon-close) center/contain no-repeat";
const LEAVE_MS = 190;

class Component extends DCLogic {
  state = { leaving: false };

  // the toast outlives its own `shown` by one animation so it can leave gracefully
  componentDidUpdate(prev) {
    if (prev.shown && !this.props.shown) {
      clearTimeout(this._t);
      this.setState({ leaving: true });
      this._t = setTimeout(() => this.setState({ leaving: false }), LEAVE_MS);
    } else if (!prev.shown && this.props.shown && this.state.leaving) {
      clearTimeout(this._t);
      this.setState({ leaving: false });
    }
  }

  componentWillUnmount() { clearTimeout(this._t); }

  renderVals() {
    const p = this.props;
    const shown = p.shown ?? true;
    const leaving = this.state.leaving && !shown;
    const icon = p.icon ?? "undo";

    // tone="success" + size="lg": the prominent confirmation used after wallet sends
    const ok = p.tone === "success", lg = p.size === "lg";
    return {
      gap: lg ? "var(--space-12)" : "var(--space-10)",
      minH: lg ? "60px" : "0",
      pad: lg ? "var(--space-10) var(--space-10) var(--space-10) var(--space-12)" : "var(--space-10) var(--space-12)",
      radius: lg ? "var(--radius-lg,14px)" : "var(--radius-md)",
      bg: ok ? "linear-gradient(0deg,rgba(46,230,168,.10),rgba(46,230,168,.10)),var(--surface-2,#191921)" : "var(--surface-2,#191921)",
      shadow: ok ? "inset 0 0 0 1px rgba(46,230,168,.38),0 18px 44px rgba(0,0,0,.5)" : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 14px 34px rgba(0,0,0,.45)",
      badge: ok ? (lg ? "32px" : "24px") : "15px", badgeBg: ok ? "rgba(46,230,168,.16)" : "transparent",
      iconSize: ok ? (lg ? "16px" : "13px") : "15px", iconInk: ok ? "var(--status-online,#2EE6A8)" : "var(--ink-4,#7C7C8C)",
      msgFont: lg ? "var(--weight-semibold) var(--text-md)/1.35 var(--font-sans)" : "var(--weight-medium) var(--text-sm)/1.35 var(--font-sans)",
      msgInk: ok || lg ? "var(--ink,#ECECF1)" : "var(--ink-2,#C9C9D4)",
      actH: lg ? "36px" : "26px", actPad: lg ? "var(--space-14)" : "var(--space-10)",
      actBg: lg ? "var(--overlay-2,rgba(255,255,255,.08))" : "transparent",
      actFont: lg ? "var(--weight-bold) var(--text-md)/1 var(--font-sans)" : "var(--weight-semibold) var(--text-sm)/1 var(--font-sans)",
      actInk: lg ? "var(--ink,#ECECF1)" : "var(--accent,#FF5672)",
      actHover: lg ? "var(--overlay-3,rgba(255,255,255,.14))" : "var(--accent-soft,rgba(255,86,114,.12))",
      closeBox: lg ? "32px" : "22px", closeSize: lg ? "13px" : "11px",
      mounted: shown || leaving,
      anim: leaving
        ? "oc-toast-out " + LEAVE_MS + "ms var(--ease-standard,ease) both"
        : "oc-toast-in 160ms var(--ease-out) both",
      hits: leaving ? "none" : "auto",
      hasIcon: icon !== "none" && !!ICONS[icon],
      iconMask: ICONS[icon] ?? ICONS.undo,
      message: p.message ?? "",
      hasAction: !!p.onAction,
      actionLabel: p.actionLabel ?? "Undo",
      onAction: p.onAction,
      hasDismiss: !!p.onClose,
      closeMask: CLOSE,
      onDismiss: p.onClose,
    };
  }
}

export default Component;

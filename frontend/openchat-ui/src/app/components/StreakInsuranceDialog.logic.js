// Logic for StreakInsuranceDialog.svelte — carried over from lib/StreakInsuranceDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const CLOSE = "var(--icon-close) center/contain no-repeat";
const BACK = "var(--icon-back) center/contain no-repeat";
const SHIELD = "var(--icon-shield) center/contain no-repeat";

// rising ladder, priced on a day's position in your holding rather than on the
// basket — so buying one day at a time costs the same as buying several at once
const STEPS = [1, 2, 4, 12, 28, 60, 124];
const MAX_DAYS = STEPS.length;
const fmt = n => n.toLocaleString("en-US");
const ordinal = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");

class Component extends DCLogic {
  state = { qty: 1, closing: false, exit: "close" };

  componentWillUnmount() { clearTimeout(this._t); }

  _leave(kind) {
    if (this.state.closing) return;
    this.setState({ closing: true, exit: kind });
    this._t = setTimeout(() => {
      const cb = kind === "back" ? (this.props.onBack ?? this.props.onClose) : this.props.onClose;
      if (cb) cb();
    }, 170);
  }

  renderVals() {
    const st = this.state;
    const insured = this.props.insured ?? 0;
    const used = this.props.used ?? 0;
    const balance = this.props.balance ?? 60501;
    const streak = this.props.streak ?? 57;
    // cover in hand is what has been bought minus what a missed day has spent
    const held = Math.min(Math.max(insured - used, 0), MAX_DAYS);
    const room = MAX_DAYS - held;
    const qty = Math.min(st.qty, room);
    const total = STEPS.slice(held, held + qty).reduce((sum, v) => sum + v, 0);
    const affordable = total <= balance;
    const canPay = qty > 0 && affordable;
    const addedDays = [];
    for (let i = held + 1; i <= held + qty; i++) addedDays.push(ordinal(i));

    return {
      closeMask: CLOSE,
      backMask: BACK,
      shieldMask: SHIELD,

      subtitle: streak + " day streak · " + (held > 0 ? held + (held === 1 ? " day" : " days") + " covered" : "no cover yet"),

      cells: Array.from({ length: MAX_DAYS }, (_, i) => i).map(i => {
        const owned = i < held;
        const adding = i >= held && i < held + qty;
        const price = STEPS[i];
        return {
          label: owned ? "Day " + (i + 1) : "+" + price,
          title: owned
            ? "Day " + (i + 1) + " of your cover"
            : ordinal(i + 1) + " day of cover · " + price + " CHAT",
          bg: owned
            ? "var(--accent-soft,rgba(255,86,114,.12))"
            : (adding ? "color-mix(in srgb, var(--status-chit,#FF9F45) 14%, transparent)" : "transparent"),
          ring: owned
            ? "inset 0 0 0 1px var(--accent-dim,rgba(255,86,114,.35))"
            : (adding
                ? "inset 0 0 0 1px color-mix(in srgb, var(--status-chit,#FF9F45) 45%, transparent)"
                : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))"),
          ink: owned ? "var(--accent,#FF5672)" : (adding ? "var(--status-chit,#FF9F45)" : "var(--ink-4,#7C7C8C)"),
          iconOpacity: owned || adding ? "1" : ".45",
          cursor: owned ? "default" : "pointer",
          // tapping the last added cell takes it back off again
          onPress: owned ? undefined : () => this.setState({ qty: i === held + qty - 1 ? i - held : i - held + 1 }),
        };
      }),

      summaryTitle: qty > 0
        ? "Adding " + qty + (qty === 1 ? " day" : " days") + " of cover"
        : (room === 0 ? "Covered for a full week" : "Tap a day to add cover"),
      summaryHint: qty > 0
        ? (qty === 1 ? addedDays[0] : addedDays[0] + " to " + addedDays[addedDays.length - 1]) +
          " day of your holding · each day dearer than the last"
        : (used > 0 ? used + (used === 1 ? " day" : " days") + " used so far" : "Insured days are spent one at a time when you miss a day"),
      totalLabel: fmt(total) + " CHAT",

      balanceLine: affordable
        ? "Balance " + fmt(balance) + " CHAT · cover caps at " + MAX_DAYS + " days"
        : "Balance " + fmt(balance) + " CHAT — not enough",
      balanceInk: affordable ? "var(--ink-4,#7C7C8C)" : "var(--status-danger,#F5493D)",

      payLabel: room === 0
        ? "Fully covered"
        : (qty === 0 ? "Pick a day" : qty + (qty === 1 ? " day" : " days") + " · pay " + fmt(total) + " CHAT"),
      payBg: canPay ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.09))",
      payInk: canPay ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      payOpacity: canPay ? "1" : ".7",
      payCursor: canPay ? "pointer" : "not-allowed",
      onPay: () => {
        if (!canPay) return;
        if (this.props.onBuy) this.props.onBuy(qty, total);
        this._leave("buy");
      },

      onBack: () => this._leave("back"),
      onClose: () => this._leave("close"),
      veilAnim: st.closing ? "oc-veil-out 170ms var(--ease-standard) both" : "oc-veil-in var(--duration-base,200ms) var(--ease-out) both",
      cardAnim: st.closing ? "oc-dlg-out 170ms var(--ease-standard) both" : "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both",
    };
  }
}

export default Component;

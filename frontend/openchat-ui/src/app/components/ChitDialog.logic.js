// Logic for ChitDialog.svelte — carried over from lib/ChitDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const CLOSE = "var(--icon-close) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const CHEVRON = "var(--icon-chevron-right) center/contain no-repeat";
const FLAME = "var(--icon-flame) center/contain no-repeat";
const SHIELD = "var(--icon-shield) center/contain no-repeat";
const TROPHY = "var(--icon-trophy) center/contain no-repeat";
const SPARK = "var(--icon-spark) center/contain no-repeat";

// milestone days that pay a bonus on top of the daily claim, with the position
// each one takes on the bar — hand-spaced so the early run stays readable and the
// long haul to 365 still reads as long
const TIERS = [3, 7, 14, 30, 100, 365];
const TIER_POS = { 3: 8, 7: 16, 14: 32, 30: 48, 100: 67, 365: 100 };
const fmt = n => n.toLocaleString("en-US");

class Component extends DCLogic {
  state = { claimed: null, closing: false, bonus: 0, pzUndo: false };

  componentWillUnmount() { clearTimeout(this._t); }

  _close() {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { if (this.props.onClose) this.props.onClose(); }, 170);
  }



  renderVals() {
    const st = this.state;
    const streak = (this.props.streak ?? 57) + (this.props.onClaim ? 0 : (st.claimed ? 1 : 0));
    const daily = this.props.daily ?? 1200;
    const earned = this.props.earned ?? 539400;
    const claimed = st.claimed ?? !(this.props.claimable ?? true);
    const balance = (this.props.balance ?? 102000) + st.bonus;
    const insuredLeft = Math.max((this.props.insured ?? 0) - (this.props.used ?? 0), 0);
    const boardRank = this.props.boardRank ?? 245;
    const boardScore = this.props.boardScore ?? 21400;
    const ordinalSuffix = boardRank % 10 === 1 && boardRank % 100 !== 11 ? "st"
      : boardRank % 10 === 2 && boardRank % 100 !== 12 ? "nd"
      : boardRank % 10 === 3 && boardRank % 100 !== 13 ? "rd" : "th";
    const boardHint = "You are " + boardRank + ordinalSuffix + " this month · " + fmt(boardScore) + " CHIT";

    // progress runs tier to tier so the bar means "distance to the next rate"
    const nextTier = TIERS.filter(t => t > streak)[0] ?? TIERS[TIERS.length - 1];
    const prevTier = TIERS.filter(t => t <= streak).pop() ?? 0;
    const span = Math.max(nextTier - prevTier, 1);
    const within = Math.min(Math.max(streak - prevTier, 0), span) / span;
    // the streak sits between its two bracketing milestones, in their spacing
    const scale = day => {
      if (day <= 0) return 0;
      const top = TIERS[TIERS.length - 1];
      if (day >= top) return 1;
      const hi = TIERS.filter(t => t > day)[0];
      const lo = TIERS.filter(t => t <= day).pop() ?? 0;
      const loPos = lo ? TIER_POS[lo] : 0;
      const hiPos = TIER_POS[hi];
      const frac = (day - lo) / (hi - lo);
      return (loPos + (hiPos - loPos) * frac) / 100;
    };
    const pct = scale(streak) * 100;

    return {
      closeMask: CLOSE,
      trophyMask: TROPHY,
      backMask: "var(--icon-back) center/contain no-repeat",
      hasBack: !!this.props.onBack,
      backTitle: this.props.backLabel ?? "Back",
      onBack: () => { if (this.props.onBack) this.props.onBack(); },
      boardHint,
      onSettings: () => { if (this.props.onAction) this.props.onAction("settings"); },
      onLeaderboard: () => { if (this.props.onAction) this.props.onAction("leaderboard"); },
      checkMask: CHECK,
      chevronMask: CHEVRON,
      flameMask: FLAME,

      subtitle: claimed
        ? "Claimed today — streak safe"
        : "Claim today to keep the streak alive",
      streak: String(streak),
      // the ring fills with the streak's progress toward the next tier
      ringGradient: "conic-gradient(var(--accent,#FF5672) 0turn, var(--status-chit,#FF9F45) " +
        (0.15 + within * 0.7).toFixed(3) + "turn, var(--overlay-2,rgba(255,255,255,.09)) " +
        (0.16 + within * 0.7).toFixed(3) + "turn, var(--overlay-2,rgba(255,255,255,.09)) 1turn)",
      ringAnim: st.claimed ? "oc-chit-pop 420ms var(--ease-out)" : "none",
      balance: fmt(balance) + " CHIT",
      earnedLine: fmt(earned) + " earned all time",

      milestoneTitle: streak >= TIERS[TIERS.length - 1]
        ? "Every milestone reached — " + fmt(daily) + " CHIT a day"
        : (nextTier - streak) + " days to the " + nextTier + "-day milestone",
      nextRate: fmt(daily) + " / day",
      progress: pct.toFixed(1) + "%",
      milestones: TIERS.map(t => ({
        label: String(t),
        pos: TIER_POS[t] + "%",
        ink: t <= streak ? "var(--status-chit,#FF9F45)" : "var(--ink-4,#7C7C8C)",
      })),
      // the bar's own end reads as the last milestone, so it needs no notch
      notches: TIERS.slice(0, -1).map(t => ({ pos: TIER_POS[t] + "%" })),

      claimable: !claimed,
      claimed,
      claimLabel: "Claim " + fmt(daily) + " CHIT",
      countdownLabel: "Come back in " + (this.props.countdown ?? "10:10:10"),
      onClaim: () => {
        // a host that owns the balance applies the claim itself
        const host = this.props.onClaim;
        this.setState({ claimed: true, bonus: host ? 0 : daily });
        if (host) host(daily);
      },

      hasCover: insuredLeft > 0,
      coverMask: SHIELD,
      coverInk: insuredLeft > 0 ? "var(--status-online,#2EE6A8)" : "var(--status-warning,#FFB03D)",
      coverTitleInk: "var(--ink,#ECECF1)",
      coverBg: insuredLeft > 0
        ? "var(--overlay-1,rgba(255,255,255,.045))"
        : "color-mix(in srgb, var(--status-warning,#FFB03D) 12%, transparent)",
      coverRing: insuredLeft > 0
        ? "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))"
        : "inset 0 0 0 1px color-mix(in srgb, var(--status-warning,#FFB03D) 50%, transparent)",
      coverTileBg: insuredLeft > 0
        ? "color-mix(in srgb, var(--status-online,#2EE6A8) 14%, transparent)"
        : "color-mix(in srgb, var(--status-warning,#FFB03D) 18%, transparent)",
      coverTitle: insuredLeft > 0
        ? "Insured for " + insuredLeft + (insuredLeft === 1 ? " day" : " days")
        : "No insurance",
      coverHint: insuredLeft > 0
        ? "Miss a day and one is spent — the streak carries on"
        : "Miss tomorrow and " + streak + " days are gone. Cover starts at 1 CHAT.",
      coverPips: Array.from({ length: Math.min(insuredLeft, 7) }, () => ({
        ink: "var(--status-online,#2EE6A8)",
        opacity: "1",
      })),
      onInsurance: () => { if (this.props.onAction) this.props.onAction("insurance"); },
      pzState: this.props.puzzleState ?? "new", pzSubProp: this.props.puzzleSub, pzCountdown: this.props.countdown, pzRemindB: !!this.props.puzzleRemind, pzAction: k => { if (this.props.onAction) this.props.onAction(k); },

      links: [
        { label: "Ways to earn CHIT", hint: "51 achievements · 12 left to try", mask: SPARK,
          actionable: true, cursor: "pointer", hoverBg: "var(--overlay-2,rgba(255,255,255,.09))",
          onPress: () => { if (this.props.onAction) this.props.onAction("earn"); } },
      ],

      onClose: () => this._close(),
      veilAnim: st.closing ? "oc-veil-out 170ms var(--ease-standard) both" : "oc-veil-in var(--duration-base,200ms) var(--ease-out) both",
      cardAnim: st.closing ? "oc-dlg-out 170ms var(--ease-standard) both" : "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both",
    };
  }
}

export default Component;

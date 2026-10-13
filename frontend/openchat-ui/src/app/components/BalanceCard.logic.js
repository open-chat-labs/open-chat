// Logic for BalanceCard.svelte — carried over from lib/BalanceCard.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const EYE = "var(--icon-eye) center/contain no-repeat";
const EYE_OFF = "var(--icon-eye-off) center/contain no-repeat";
const CYCLE = "var(--icon-refresh) center/contain no-repeat";
const RECEIVE = "var(--icon-receive) center/contain no-repeat";
const SEND = "var(--icon-wallet-send) center/contain no-repeat";
const SWAP = "var(--icon-swap) center/contain no-repeat";

class Component extends DCLogic {
  state = { seg: null };

  renderVals() {
    const p = this.props;
    const veiled = !!p.veiled;
    // an allocation bar is optional: the token-level card has nothing to split
    const allocation = p.allocation ?? [];
    let seg = this.state.seg;
    // hiding a token can shrink the bar out from under the pointer
    if (seg !== null && seg >= allocation.length) seg = null;
    const shares = allocation.map(s => Math.max(s.share || 0, 0.001));
    const totalShare = shares.reduce((sum, v) => sum + v, 0) || 1;

    return {
      label: p.label ?? "TOTAL BALANCE",
      amount: p.amount ?? "",
      fiat: p.fiat ?? "",
      hasFiat: !!p.fiat,
      veilBlur: veiled ? "blur(9px)" : "none",

      hasVeilToggle: !!p.onToggleVeil,
      eyeMask: veiled ? EYE_OFF : EYE,
      veilTitle: veiled ? "Show balance" : "Hide balance",
      onToggleVeil: p.onToggleVeil,

      hasRefresh: !!p.onRefresh,
      cycleMask: CYCLE,
      spin: p.spinning ? "oc-spin 700ms linear" : "none",
      onRefresh: p.onRefresh,

      hasAllocation: allocation.length > 0,
      segments: allocation.map((s, i) => ({
        share: veiled ? 1000 : Math.round(shares[i] / totalShare * 1000),
        gradient: s.gradient,
        ring: s.ring ?? "none",
        onEnter: () => this.setState({ seg: i }),
      })),
      onLeaveSegment: () => this.setState({ seg: null }),
      tipShown: seg !== null,
      tipLabel: seg !== null ? allocation[seg].tipLabel ?? allocation[seg].label ?? "" : "",
      tipValue: seg !== null ? allocation[seg].tipValue ?? "" : "",
      tipGradient: seg !== null ? allocation[seg].gradient : "transparent",
      tipRing: seg !== null ? allocation[seg].ring ?? "none" : "none",
      tipLeft: (() => {
        if (seg === null) return "0px";
        const before = shares.slice(0, seg).reduce((sum, v) => sum + v, 0);
        const centre = (veiled
          ? (seg + 0.5) / allocation.length
          : (before + shares[seg] / 2) / totalShare) * 100;
        return "clamp(0px, calc(" + centre.toFixed(1) + "% - 79px), calc(100% - 158px))";
      })(),

      sendMask: SEND,
      receiveMask: RECEIVE,
      swapMask: SWAP,
      onSend: p.onSend,
      onReceive: p.onReceive,
      onSwap: p.onSwap,
    };
  }
}

export default Component;

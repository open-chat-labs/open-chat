// Logic for PrizeMessage.svelte — carried over from lib/PrizeMessage.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Prize message. Built only on what a prize carries: token, winners, time left, claimed count and gates.
// The amount is revealed on claim ("You won 6.2 ICP"). 3D spinning coin with the token mark (paused with reduced motion); confetti bursts from Claim.
// state: open | claimed | ended. gates: [{ label, met }]. Any unmet gate → "Requirements not met".
class Component extends DCLogic {
  state = { claimed: false };


  renderVals() {
    const p = this.props;
    const t = p.token ?? { symbol: "ICP", mark: "\u221E", gradient: "linear-gradient(140deg,#ff5f9e,#6a2bff)", edge: "#7a2f8f", edge2: "#5c2370" };
    const tok = Object.assign({ edge: "#555", edge2: "#444", gradient: "linear-gradient(140deg,#2EE6A8,#1FB6FF)" }, t, { mark: t.mark ?? t.symbol[0] });
    const gates = p.gates ?? [];
    const blocked = gates.some(g => !g.met);
    const st = p.state ?? "open", ended = st === "ended", won = st === "claimed" || this.state.claimed;
    const winners = p.winners ?? 20, claimed = (p.claimed ?? 0) + (this.state.claimed && st !== "claimed" ? 1 : 0);
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    return {
      coinSym: tok.symbol, coinMark: tok.mark, coinGrad: tok.gradient, coinEdge: tok.edge, coinEdge2: tok.edge2, headline: "Win " + tok.symbol,
      winnersLine: winners + " winners", endsLine: ended ? "Ended" : "Ends in " + (p.endsIn ?? ""),
      endsInk: p.endingSoon && !ended ? "var(--status-warning,#FFB03D)" : "var(--ink-3,#9A9AA8)",
      left: claimed >= winners ? "All prizes claimed" : (winners - claimed) + " of " + winners + " left", claimedLabel: claimed + "/" + winners, w: Math.min(100, claimed / winners * 100) + "%",
      hasGates: gates.length > 0 && !ended,
      gates: gates.map(g => g.met ? { state: "met", label: g.label, mask: "var(--icon-check) center/contain no-repeat", bg: "color-mix(in oklch,var(--status-online,#2EE6A8) 13%,transparent)", ink: "var(--status-online,#2EE6A8)" } : { state: "unmet", label: g.label, mask: "var(--icon-lock) center/contain no-repeat", bg: "color-mix(in oklch,var(--status-warning,#FFB03D) 14%,transparent)", ink: "var(--status-warning,#FFB03D)" }),
      canClaim: !won && !ended && !blocked, isBlocked: !won && !ended && blocked, isEnded: ended && !won, isWon: won,
      burst: this.state.burst || 0, wonText: "You won " + (p.wonAmount ?? ""),
      claim: () => { this.setState(s => ({ burst: (s.burst || 0) + 1 })); if (p.onClaim) p.onClaim(); else this.setState({ claimed: true }); },
      op: ended ? ".7" : "1", shellR: XS + " 22px 22px " + (last ? "22px" : XS),
      note: p.note ?? "", hasNote: !!p.note, noNote: !p.note, time: p.time ?? "11:15",
    };
  }
}

export default Component;

// Logic for ProposalMessage.svelte — carried over from lib/ProposalMessage.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Governance proposal. Outcome pill in the header (Open, Passing, Adopted, You voted to adopt/reject, Rejected, Expired) coloured by state.
// Native's two-threshold bar: ▾ softThreshold = passes when voting ends, ▼ hardThreshold = adopted immediately. Adopt/Reject only while you can vote.
class Component extends DCLogic {
  state = { vote: null };
  renderVals() {
    const v = this._vals(), f = x => (parseFloat(x) || 0) / 100;
    return Object.assign(v, { tbYes: f(v.yesW), tbNo: f(v.noW), tbMarks: [{ at: f(v.softAt), label: v.softLabel }, { at: f(v.hardAt), label: v.hardLabel, strong: true }] });
  }
  _vals() {
    const p = this.props;
    const st = p.state ?? "open", open = st === "open";
    const mine = p.myVote ?? this.state.vote;
    const yes = p.adopt ?? 40.64, no = p.reject ?? 0.98;
    const soft = p.softThreshold ?? (p.critical ? 20 : 3), hard = p.hardThreshold ?? (p.critical ? 67 : 50);
    const passing = yes >= soft, adopted = yes >= hard, voted = !!mine;
    const GREEN = "var(--status-online,#2EE6A8)", RED = "var(--status-danger,#FF4D4D)", BLUE = "var(--status-verified,#3D9BFF)", GREY = "var(--ink-3,#9A9AA8)";
    const tone = voted ? (mine === "adopt" ? "g" : "r") : st === "rejected" ? "r" : st === "expired" ? "x" : adopted || passing ? "g" : "b";
    const INK = { g: GREEN, r: RED, b: BLUE, x: GREY }[tone];
    const BG = { g: "color-mix(in oklch,var(--status-online,#2EE6A8) 14%,transparent)", r: "var(--status-danger-soft,rgba(255,77,77,.12))", b: "color-mix(in oklch,var(--status-verified,#3D9BFF) 15%,transparent)", x: "var(--overlay-2,rgba(255,255,255,.08))" }[tone];
    const label = open ? (voted ? (mine === "adopt" ? "You voted to adopt" : "You voted to reject") : adopted ? "Adopted" : passing ? "Passing" : "Open") : st === "rejected" ? "Rejected" : st === "executed" ? "Executed" : "Expired";
    const mask = voted || st === "executed" ? "var(--icon-check) center/contain no-repeat" : st === "rejected" ? "var(--icon-close) center/contain no-repeat" : st === "expired" ? "var(--icon-clock) center/contain no-repeat" : "var(--icon-dot) center/contain no-repeat";
    const cast = side => () => { if (!open || voted) return; if (p.myVote == null) this.setState({ vote: side }); if (p.onVote) p.onVote(side); };
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    return {
      oLabel: label, oInk: INK, oBg: BG, oMask: mask, critical: !!p.critical,
      title: p.title ?? "OpenChat Labs funding part 3", kind: p.kind ?? "Transfer SNS treasury funds", proposer: p.proposer ?? "ProposalsBot",
      yes: yes.toFixed(2) + "%", no: no.toFixed(2) + "%", yesW: yes + "%", noW: no + "%",
      softAt: soft + "%", hardAt: hard + "%", softLabel: "Passes when voting ends (" + soft + "%)", hardLabel: "Passes immediately (" + hard + "%)",
      barLabel: yes.toFixed(2) + "% adopt, " + no.toFixed(2) + "% reject",
      when: p.when ?? (open ? "Voting ends in 2d 4h" : "Voting ended"), whenInk: open ? "var(--ink-2,#C9C9D4)" : "var(--ink-4,#8A8A99)",
      canVote: open && !voted && (p.canVote ?? true), adopt: cast("adopt"), reject: cast("reject"), onDetails: p.onDetails,
      op: st === "expired" ? ".75" : "1", shellR: XS + " 22px 22px " + (last ? "22px" : XS), time: p.time ?? "10:11",
    };
  }
}

export default Component;

// Logic for PollMessage.svelte — carried over from lib/PollMessage.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Poll: header tile (question + rule chips), option rows with slim bars (voter avatars on public polls), footer tile.
// Results stay hidden until you vote. Radios for single choice, checkboxes for multiple. Controlled via `myVotes` + onVote(indexes), or uncontrolled.
const R = {
  pub: { label: "Public votes", mask: "var(--icon-eye) center/contain no-repeat" }, anon: { label: "Anonymous", mask: "var(--icon-eye-off) center/contain no-repeat" },
  multi: { label: "Pick any", mask: "var(--icon-check-double) center/contain no-repeat" }, single: { label: "Pick one", mask: "var(--icon-check) center/contain no-repeat" },
  change: { label: "Can change vote", mask: "var(--icon-rotate-back) center/contain no-repeat" },
};
class Component extends DCLogic {
  state = { mine: null };
  renderVals() {
    const p = this.props, sent = (p.side ?? "received") === "sent";
    const multi = !!p.multiple, pub = !!p.publicVotes, canChange = p.canChange ?? true, closed = !!p.closed;
    const options = p.options ?? [{ label: "Tuesday evening", votes: 12 }, { label: "Wednesday lunch", votes: 31 }, { label: "Thursday evening", votes: 7 }];
    const mine = p.myVotes ?? this.state.mine ?? [];
    const counts = options.map((o, j) => (o.votes || 0) + (p.myVotes == null && mine.indexOf(j) >= 0 ? 1 : 0));
    const total = counts.reduce((a, b) => a + b, 0), voted = mine.length > 0, show = voted || closed;
    const locked = closed || (voted && !canChange);
    const pick = j => () => {
      if (locked) return;
      const at = mine.indexOf(j);
      const next = multi ? (at >= 0 ? mine.filter(x => x !== j) : mine.concat([j])) : (at >= 0 ? [] : [j]);
      if (p.myVotes == null) this.setState({ mine: next });
      if (p.onVote) p.onVote(next);
    };
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    const rules = [pub ? R.pub : R.anon, multi ? R.multi : R.single].concat(canChange ? [R.change] : []);
    return {
      bg: sent ? "var(--bubble-send-bg,#B83E52)" : "var(--bubble-recv-bg,#191921)",
      ring: sent ? "none" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))",
      ink: sent ? "var(--bubble-text,#fff)" : "var(--bubble-recv-text,#E4E4EC)",
      soft: sent ? "var(--bubble-text-soft,rgba(255,255,255,.82))" : "var(--ink-4,#8A8A99)",
      seg: sent ? "rgba(0,0,0,.18)" : "var(--overlay-1,rgba(255,255,255,.045))",
      chip: sent ? "rgba(0,0,0,.2)" : "var(--overlay-2,rgba(255,255,255,.07))",
      track: sent ? "rgba(0,0,0,.25)" : "var(--overlay-2,rgba(255,255,255,.08))",
      link: sent ? "var(--bubble-text,#fff)" : "var(--accent-bright,#FF8298)",
      onMark: sent ? "var(--bubble-send-bg,#B83E52)" : "var(--on-accent,#2E0512)",
      shellR: XS + " 22px 22px " + (last ? "22px" : XS),
      question: p.question ?? "When should we hold the community call?", rules,
      groupRole: multi ? "group" : "radiogroup", markR: multi ? "5px" : "50%", cursor: locked ? "default" : "pointer",
      opts: options.map((o, j) => {
        const on = mine.indexOf(j) >= 0, pct = total ? Math.round(counts[j] / total * 100) : 0;
        return {
          label: o.label, role: multi ? "checkbox" : "radio", checked: String(on), pick: pick(j),
          w: show ? pct + "%" : "0%", pct: pct + "%", showPct: show ? "block" : "none",
          bar: on ? (sent ? "#fff" : "var(--accent,#FF5672)") : (sent ? "rgba(255,255,255,.45)" : "var(--ink-4,#8A8A99)"),
          markRing: on ? "none" : (sent ? "inset 0 0 0 1.5px rgba(255,255,255,.6)" : "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.3))"),
          markBg: on ? (sent ? "#fff" : "var(--accent,#FF5672)") : "transparent", tick: on ? "block" : "none", weight: on ? "600" : "500",
          voters: (o.voters || []).slice(0, 3), showVoters: show && pub && (o.voters || []).length ? "flex" : "none",
        };
      }),
      foot: closed ? total + " votes · closed" : (voted ? total + " votes · " : "Vote to see results · ") + (p.endsIn ? "ends in " + p.endsIn : "open"),
      canView: pub && show, onViewVotes: p.onViewVotes, time: p.time ?? "13:58",
    };
  }
}

export default Component;

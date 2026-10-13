// Logic for ProgressTimeline.svelte — carried over from lib/ProgressTimeline.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const CHECK = "var(--icon-check) center/contain no-repeat";
const CROSS = "var(--icon-close) center/contain no-repeat";
const DOT = "var(--icon-dot-heavy) center/contain no-repeat";
const NONE = "none";
const DONE_INK = "var(--status-online,#2EE6A8)", FAIL_INK = "var(--status-danger,#F5493D)";

// Multi-step progress for on-chain flows. Phases group technical steps so 5–7 steps read as 3:
//   phases: [{ title, sub?, steps?: [{ label, state }], state?, error? }]  state: "done" | "active" | "todo" | "failed"
// A phase's state is derived from its steps when omitted. Sub-steps show only on the active/failed phase (or when expanded).
// collapseDone: once everything is done, fold into "N steps done · View details". density "compact" tightens rows.
class Component extends DCLogic {
  state = { expanded: false };
  renderVals() {
    const p = this.props, compact = (p.density ?? "regular") === "compact";
    const src = p.phases ?? [];
    const derive = ph => {
      if (ph.state) return ph.state;
      const ss = (ph.steps || []).map(s => s.state);
      if (ss.indexOf("failed") >= 0) return "failed";
      if (ss.length && ss.every(s => s === "done")) return "done";
      if (ss.some(s => s === "active" || s === "done")) return "active";
      return "todo";
    };
    const states = src.map(derive);
    const allDone = states.length > 0 && states.every(s => s === "done");
    const totalSteps = src.reduce((n, ph) => n + Math.max(1, (ph.steps || []).length), 0);
    const exp = this.state.expanded;
    const collapsed = !!p.collapseDone && allDone && !exp;
    return { 
      dot: compact ? "24px" : "28px", gapMin: compact ? "12px" : "18px", rowPad: compact ? "3px 0 12px" : "5px 0 18px",
      checkMask: CHECK,
      showSummary: collapsed, showList: !collapsed, canHide: !!p.collapseDone && allDone && exp,
      summary: totalSteps + " steps done", expanded: exp, toggle: () => this.setState(s => ({ expanded: !s.expanded })),
      phases: src.map((ph, i) => {
        const st = states[i], last = i === src.length - 1;
        const open = st === "active" || st === "failed" || (exp && allDone);
        const sub = st === "failed" ? (ph.error || ph.sub || "") : ph.sub || "";
        return {
          title: ph.title, sub, hasSub: !!sub && (st !== "done" || exp),
          subInk: st === "failed" ? FAIL_INK : "var(--ink-4,#8A8A99)",
          titleInk: st === "todo" ? "var(--ink-4,#8A8A99)" : "var(--ink,#ECECF1)",
          bg: st === "done" ? "rgba(46,230,168,.14)" : st === "failed" ? "rgba(245,73,61,.14)" : st === "active" ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))",
          ring: st === "active" ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : NONE,
          ink: st === "done" ? DONE_INK : st === "failed" ? FAIL_INK : st === "active" ? "var(--accent-bright,#FF8298)" : "var(--ink-5,#6E6E7C)",
          mask: st === "done" ? CHECK : st === "failed" ? CROSS : DOT,
          line: last ? "transparent" : st === "done" ? DONE_INK : "var(--line-2,rgba(255,255,255,.1))",
          showSteps: open && (ph.steps || []).length > 0,
          steps: (ph.steps || []).map(s => {
            const k = s.state || "todo";
            return { label: s.label,
              size: k === "active" || k === "todo" ? "8px" : "13px",
              fill: k === "done" ? DONE_INK : k === "failed" ? FAIL_INK : k === "active" ? "var(--accent,#FF5672)" : "transparent",
              ring: k === "todo" ? "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.24))" : NONE,
              mask: k === "done" ? CHECK : k === "failed" ? CROSS : NONE,
              font: k === "active" ? "600 13px/1.3 var(--font-sans)" : "400 13px/1.3 var(--font-sans)",
              ink: k === "todo" ? "var(--ink-4,#8A8A99)" : k === "failed" ? FAIL_INK : "var(--ink-2,#C9C9D4)" };
          }),
        };
      }),
    };
  }
}

export default Component;

// Logic for PollBuilderDialog.svelte — carried over from lib/PollBuilderDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Poll builder dialog (composer + → Poll). Question first; answers keep one empty row at the end (up to 10, drag/remove);
// duration pills; settings in a summary row that expands in place; live preview beside the form at ≥960px.
// Publish → onPublish(poll) (host closes and shows "Poll sent · Undo"). Closing with content asks "Discard this poll?". Ctrl/⌘+Enter publishes.
const Q_MAX = 250, A_MAX = 75;
const DURS = [["1 hour", 3600e3], ["6 hours", 6 * 3600e3], ["1 day", 86400e3], ["3 days", 3 * 86400e3], ["1 week", 7 * 86400e3], ["1 month", 30 * 86400e3]];
// answers always end with exactly one empty row (up to 10); emptied rows in the middle collapse away
const norm = ans => { const f = ans.filter((x, i) => x !== "" || i === ans.length - 1).filter(x => x !== ""); while (f.length < 2) f.push(""); if (f.length < 10 && f[f.length - 1] !== "") f.push(""); return f; };
const fresh = () => ({ q: "", ans: ["", ""], dur: 2, pub: false, multi: false, lock: false, hide: false, published: false });
class Component extends DCLogic {
  state = { d: fresh(), vw: typeof window === "undefined" ? 1200 : window.innerWidth };
  boxRef = React.createRef();
  // question field grows with its content (no fixed rows)
  _grow(t) { if (!t) return; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  componentDidMount() {
    this._sizeAll = () => { document.querySelectorAll("textarea[data-autogrow]").forEach(t => this._grow(t)); this.setState({ vw: window.innerWidth }); };
    window.addEventListener("resize", this._sizeAll);
    setTimeout(() => { this._sizeAll(); const t = this.boxRef.current && this.boxRef.current.querySelector("textarea"); if (t) t.focus(); }, 60);
  }
  componentWillUnmount() { window.removeEventListener("resize", this._sizeAll); }
  _set(k, patch) { this.setState(s => ({ [k]: Object.assign({}, s[k], typeof patch === "function" ? patch(s[k]) : patch) })); }
  _vals(k, id, name, caption, preview, mode) {
    mode = mode || "full";
    const d = this.state[k];
    const clean = d.ans.map(x => x.trim());
    const filled = clean.filter(Boolean);
    const dup = (x, i) => !!x && clean.findIndex(y => y.toLowerCase() === x.toLowerCase()) !== i;
    const hasDup = clean.some(dup);
    const ok = !!d.q.trim() && filled.length >= 2 && !hasDup;
    const D = DURS[d.dur ?? 2];
    const end = new Date(Date.now() + D[1]);
    const reason = d.published ? "Poll sent to the chat" : !d.q.trim() ? "Add a question" : filled.length < 2 ? "Add at least two answers" : hasDup ? "Answers must be different" : "Ready · ends " + end.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + ", " + end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const publish = () => { if (!ok) return; if (this.props.onPublish) this.props.onPublish({ question: d.q.trim(), options: filled.map(label => ({ label, votes: 0 })), multiple: d.multi, publicVotes: d.pub, canChange: !d.lock, hideResults: d.hide, endsIn: D[0], endsAt: end.getTime() }); };
    const onAns = i => e => { const v = e.target.value.slice(0, A_MAX); this._set(k, s => { const ans = s.ans.slice(); ans[i] = v; return { ans: v === "" ? ans : norm(ans), published: false }; }); };
    return {
      id, name, caption, colW: preview ? "900px" : "540px", grid: preview ? "minmax(0,1fr) 374px" : "minmax(0,1fr)", hasPreview: preview,
      q: d.q, onQ: e => { this._grow(e.target); this._set(k, { q: e.target.value.slice(0, Q_MAX), published: false }); }, qLeft: Q_MAX - d.q.length, qCountShow: Q_MAX - d.q.length <= 40 ? "block" : "none",
      ansHint: filled.length < 2 ? "At least 2" : filled.length + " of 10",
      ansValues: d.ans, ansMax: A_MAX, onAnsList: vals => this._set(k, { ans: vals.concat(""), published: false }),
      answers: d.ans.map((v, i) => {
        const last = i === d.ans.length - 1 && !v;
        return { value: v, onInput: onAns(i), onBlur: () => this._set(k, s => ({ ans: norm(s.ans) })), placeholder: i < 2 ? "Answer " + (i + 1) : "Another answer (optional)", aria: "Answer " + (i + 1),
          left: A_MAX - v.length, countShow: A_MAX - v.length <= 15 ? "block" : "none", dupShow: dup(clean[i], i) ? "block" : "none",
          ring: dup(clean[i], i) ? "inset 0 0 0 1px var(--status-warning,#FFB03D)" : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))",
          handleOp: "1", removeShow: d.ans.length > 2 ? "flex" : "none",
          remove: () => this._set(k, s => ({ ans: norm(s.ans.filter((_, j) => j !== i)) })) };
      }),
      durations: DURS.map((x, i) => { const on = i === (d.dur ?? 2); return { label: x[0], checked: String(on), pick: () => this._set(k, { dur: i }), bg: on ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))", ring: on ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: on ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)" }; }),
      isFull: mode === "full", isDisclosure: mode === "disclosure", isChips: mode === "chips",
      open: !!d.open, openStr: String(!!d.open), chev: d.open ? "rotate(180deg)" : "none", toggleOpen: () => this._set(k, s => ({ open: !s.open })),
      summary: [d.pub ? "Public votes" : "Anonymous", d.multi ? "Multiple answers" : "One answer", d.lock ? "Votes locked" : "Can change vote", d.hide ? "Results hidden until it ends" : "Results visible"].join(" · "),
      chipNote: "Off by default: anonymous, one answer, votes can change, results visible. Hover a setting for details.",
      settings: [
        { label: "Public votes", help: "Everyone can see who voted for what. Off: votes are anonymous.", on: d.pub, toggle: () => this._set(k, s => ({ pub: !s.pub })), onStr: String(!!d.pub), bg: d.pub ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))", ring: d.pub ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: d.pub ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)", mask: d.pub ? "var(--icon-check) center/contain no-repeat" : "var(--icon-plus) center/contain no-repeat" },
        { label: "Allow multiple answers", help: "People can pick more than one answer.", on: d.multi, toggle: () => this._set(k, s => ({ multi: !s.multi })), onStr: String(!!d.multi), bg: d.multi ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))", ring: d.multi ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: d.multi ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)", mask: d.multi ? "var(--icon-check) center/contain no-repeat" : "var(--icon-plus) center/contain no-repeat" },
        { label: "Lock votes", help: "Once someone votes, they can't change it.", on: d.lock, toggle: () => this._set(k, s => ({ lock: !s.lock })), onStr: String(!!d.lock), bg: d.lock ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))", ring: d.lock ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: d.lock ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)", mask: d.lock ? "var(--icon-check) center/contain no-repeat" : "var(--icon-plus) center/contain no-repeat" },
        { label: "Hide results until it ends", help: "Nobody sees the results until the poll closes.", on: d.hide, toggle: () => this._set(k, s => ({ hide: !s.hide })), onStr: String(!!d.hide), bg: d.hide ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))", ring: d.hide ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: d.hide ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)", mask: d.hide ? "var(--icon-check) center/contain no-repeat" : "var(--icon-plus) center/contain no-repeat" },
      ],
      pq: d.q.trim() || "Your question", pOpts: (filled.length ? filled : ["Answer 1", "Answer 2"]).map(l => ({ label: l, votes: 0 })),
      multi: d.multi, pub: d.pub, change: !d.lock, endsIn: D[0],
      reason, reasonInk: d.published ? "var(--status-online,#2EE6A8)" : ok ? "var(--ink-3,#9A9AA8)" : "var(--status-warning,#FFB03D)",
      pubLabel: d.published ? "Sent" : "Publish", pubBg: ok && !d.published ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.08))", pubInk: ok && !d.published ? "var(--on-accent,#2E0512)" : "var(--ink-4,#8A8A99)",
      pubCursor: ok && !d.published ? "pointer" : "not-allowed", pubTab: ok ? "0" : "-1", pubDisabled: String(!ok),
      publish,
      // after publishing: dialog would close; here the toast offers Undo for 5s
      toast: !!d.toast, undo: () => { clearTimeout(this["_t" + k]); this._set(k, { published: false, toast: false }); }, closeToast: () => this._set(k, { toast: false }),
      // closing with content asks first; an empty poll just closes
      confirming: !!d.confirm, onClose: () => { if (d.q.trim() || filled.length) this._set(k, { confirm: true }); else if (this.props.onClose) this.props.onClose(); },
      keep: () => this._set(k, { confirm: false }), discard: () => { if (this.props.onClose) this.props.onClose(); },
      onKey: e => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); publish(); return; }
        if (e.key === "Enter" && e.target.tagName === "INPUT") {
          e.preventDefault();
          const dlg = e.currentTarget, ins = [...dlg.querySelectorAll('input[aria-label^="Answer"]')], i = ins.indexOf(e.target);
          setTimeout(() => { const all = [...dlg.querySelectorAll('input[aria-label^="Answer"]')]; if (all[i + 1]) all[i + 1].focus(); }, 0);
        }
        if (e.key === "Escape") { e.stopPropagation(); if (d.confirm) this._set(k, { confirm: false }); else if (d.q.trim() || filled.length) this._set(k, { confirm: true }); else if (this.props.onClose) this.props.onClose(); }
      },
    };
  }
  renderVals() {
    const wide = this.state.vw >= 960 && this.props.preview !== false;
    const v = this._vals("d", "", "", "", wide, "disclosure");
    return Object.assign(v, { boxRef: this.boxRef, z: String(this.props.z ?? 80), dlgW: wide ? "900px" : "540px" });
  }
}

export default Component;

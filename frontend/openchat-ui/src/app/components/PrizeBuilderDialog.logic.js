// Logic for PrizeBuilderDialog.svelte — carried over from lib/PrizeBuilderDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Prize builder (composer + → Prize). Amount first; winners, expiry and claim restrictions as summary rows that open in place.
// Preview + cost column beside the form at ≥960px. "Attach prize" → onAttach(prize): the host puts it in the composer,
// where the user adds a caption and sends. Pass `initial` (a previous onAttach value) to edit. Ctrl/⌘+Enter attaches, Esc closes.
const TOK = {
  CHAT: { symbol: "CHAT", mark: "C", gradient: "linear-gradient(140deg,#ff5f9e,#ffb03d)", bal: 132.332136, fee: 0.001, minPer: 0.1, dp: 4 },
  ICP: { symbol: "ICP", mark: "\u221E", gradient: "linear-gradient(140deg,#ff5f9e,#6a2bff)", bal: 4.2153, fee: 0.0001, minPer: 0.01, dp: 4 },
  ckBTC: { symbol: "ckBTC", mark: "\u20BF", gradient: "linear-gradient(140deg,#ffb03d,#f7931a)", bal: 0.00213, fee: 0.0000001, minPer: 0.000001, dp: 8 },
  ckUSDC: { symbol: "ckUSDC", mark: "$", gradient: "linear-gradient(140deg,#2775ca,#1FB6FF)", bal: 48.5, fee: 0.01, minPer: 0.1, dp: 2 },
};
const DURS = [["1 hour", "1h", 3600e3], ["6 hours", "6h", 6 * 3600e3], ["1 day", "1d", 86400e3], ["7 days", "7d", 7 * 86400e3], ["30 days", "30d", 30 * 86400e3], ["90 days", "90d", 90 * 86400e3]];
const GATES = [
  { k: "auth", label: "Authenticated", icon: "passkey" },
  { k: "diamond", label: "Diamond", icon: "diamond-outline" },
  { k: "lifetime", label: "Lifetime Diamond", icon: "diamond" },
  { k: "chit", label: "CHIT earned", icon: "chit", pick: "chit" },
  { k: "streak", label: "Streak", icon: "flame", pick: "streak" },
];
const PICKS = {
  streak: { title: "Minimum streak", opts: [3, 7, 14, 30, 100, 365], fmt: n => n + " days" },
  chit: { title: "Minimum CHIT earned", opts: [1000, 5000, 10000, 50000, 100000], fmt: n => (n >= 1000 ? n / 1000 + "k" : n) + " CHIT" },
};
const M = n => "var(--icon-" + n + ") center/contain no-repeat";
const fmt = (n, dp) => Number(n.toFixed(dp)).toLocaleString("en-US", { maximumFractionDigits: dp });
const ON = { bg: "color-mix(in oklch,var(--accent,#FF5672) 16%,transparent)", ring: "color-mix(in oklch,var(--accent,#FF5672) 55%,transparent)", ink: "var(--accent-bright,#FF8298)" };
const OFF = { bg: "transparent", ring: "var(--line-2,rgba(255,255,255,.1))", ink: "var(--ink-2,#C9C9D4)" };
const WARN = "var(--status-warning,#FFB03D)";

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const i = props.initial && props.initial.draft;
    this.state = Object.assign({ tok: "CHAT", amt: "", win: "20", dur: 2, even: false, gates: {}, streak: 7, chit: 10000, pick: null, tokOpen: false, row: null }, i || {}, { vw: typeof window === "undefined" ? 1200 : window.innerWidth });
  }
  boxRef = React.createRef(); amtRef = React.createRef();
  componentDidMount() {
    this._rs = () => this.setState({ vw: window.innerWidth });
    window.addEventListener("resize", this._rs);
    setTimeout(() => { if (this.amtRef.current) this.amtRef.current.focus(); }, 60);
  }
  componentWillUnmount() { window.removeEventListener("resize", this._rs); }
  renderVals() {
    const p = this.props, s = this.state, set = o => this.setState(o);
    const T = TOK[s.tok], a = parseFloat(s.amt) || 0, w = parseInt(s.win, 10) || 0;
    const fee = T.fee * (Math.max(w, 1) + 1), min = T.minPer * Math.max(w, 1), max = Math.max(0, T.bal - fee);
    const sym = T.symbol, F = n => fmt(n, T.dp);
    let reason = "";
    if (w < 1 || w > 1000) reason = "Choose 1 to 1,000 winners";
    else if (!a) reason = "Enter an amount";
    else if (a < min) reason = "Minimum for " + w + " winners is " + F(min) + " " + sym;
    else if (a > max) reason = "Not enough " + sym + " (max " + F(max) + " after fees)";
    const ok = !reason;
    const gateOn = GATES.filter(g => s.gates[g.k]);
    const gateLabel = g => g.k === "streak" ? s.streak + "+ day streak" : g.k === "chit" ? PICKS.chit.fmt(s.chit) + "+" : g.k === "diamond" ? "Diamond members" : g.k === "auth" ? "Authenticated users" : g.label;
    const who = gateOn.length ? gateOn.map(gateLabel).join(" · ") : "Anyone in this chat";
    const per = w ? a / w : 0;
    const perWinner = !a || !w ? "a share of the prize" : s.even ? F(per) + " " + sym + " each" : "a random amount, avg " + F(per) + " " + sym;
    const toggleGate = g => {
      if (s.gates[g.k]) { const n = Object.assign({}, s.gates); delete n[g.k]; return set({ gates: n, pick: null }); }
      if (g.pick) return set({ pick: s.pick === g.pick ? null : g.pick });
      const n = Object.assign({}, s.gates, { [g.k]: true });
      // Lifetime already counts as Diamond, so the two replace each other
      if (g.k === "diamond") delete n.lifetime; if (g.k === "lifetime") delete n.diamond;
      set({ gates: n, pick: null });
    };
    const P = s.pick ? PICKS[s.pick] : null;
    const total = a + fee;
    const attach = () => {
      if (!ok || !p.onAttach) return;
      p.onAttach({
        token: { symbol: sym, mark: T.mark, gradient: T.gradient }, amount: a, amountText: F(a) + " " + sym,
        winners: w, even: s.even, endsIn: DURS[s.dur][1], endsInLabel: DURS[s.dur][0], endsAt: Date.now() + DURS[s.dur][2],
        gates: gateOn.map(g => ({ label: gateLabel(g), met: true })), fee, feeText: F(fee) + " " + sym, totalText: F(total) + " " + sym,
        summary: [w + (w === 1 ? " winner" : " winners"), DURS[s.dur][1]].concat(gateOn.length ? [gateOn.length + (gateOn.length > 1 ? " rules" : " rule")] : []).join(" · "),
        draft: { tok: s.tok, amt: s.amt, win: s.win, dur: s.dur, even: s.even, gates: s.gates, streak: s.streak, chit: s.chit },
      });
    };
    const wide = s.vw >= 960;
    const rowDefs = [
      { k: "win", mask: M("trophy"), label: "Winners", value: w + " · " + (s.even ? "even split" : "random amounts") },
      { k: "dur", mask: M("timer"), label: "Ends after", value: DURS[s.dur][0] },
      { k: "who", mask: M("shield"), label: "Who can claim", value: who },
    ];
    return {
      title: p.initial ? "Edit prize" : "Create a prize", cta: p.initial ? "Update prize" : "Attach prize",
      z: String(p.z ?? 80), dlgW: wide ? "900px" : "540px", grid: wide ? "minmax(0,1fr) 360px" : "minmax(0,1fr)", wide,
      boxRef: this.boxRef, amtRef: this.amtRef,
      onClose: () => { if (p.onClose) p.onClose(); },
      onKey: e => {
        if (e.key === "Escape") { e.stopPropagation(); if (s.tokOpen) set({ tokOpen: false }); else if (p.onClose) p.onClose(); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); attach(); }
      },
      tok: { symbol: sym, mark: T.mark, gradient: T.gradient }, amt: s.amt, win: s.win, winN: Math.max(1, w), even: s.even,
      onAmt: e => set({ amt: e.target.value.replace(/[^0-9.]/g, "") }),
      onWin: e => set({ win: e.target.value.replace(/\D/g, "").slice(0, 4) }),
      winDown: () => set({ win: String(Math.max(1, w - 1)) }), winUp: () => set({ win: String(Math.min(1000, w + 1)) }),
      onEven: v => set({ even: typeof v === "boolean" ? v : !s.even }),
      onQuick: v => { const f = typeof v === "number" ? v : v && (v.value ?? v.fraction); if (typeof f === "number") set({ amt: String(Number((max * f).toFixed(T.dp))) }); },
      balText: F(T.bal) + " " + sym,
      amtHint: ok ? "Fee " + F(fee) + " " + sym + " (" + (Math.max(w, 1) + 1) + " transfers) is added on top" : reason,
      amtHintInk: ok || reason === "Enter an amount" ? "var(--ink-4,#8A8A99)" : WARN,
      perWinnerLong: "Each winner gets " + perWinner + ". Unclaimed prizes return to you when it ends.",
      durs: DURS.map((d, i) => Object.assign({ label: d[0], sel: i === s.dur, onClick: () => set({ dur: i }) }, i === s.dur ? ON : OFF)),
      durShort: DURS[s.dur][1],
      chips: GATES.map(g => { const on = !!s.gates[g.k]; return Object.assign({ on, label: on ? gateLabel(g) : g.label, mask: M(g.icon), trail: M(on ? "close" : g.pick ? "chevron-down" : "plus"), onClick: () => toggleGate(g) }, on ? ON : OFF); }),
      pickOpen: !!P, pickTitle: P ? P.title : "",
      pickOpts: P ? P.opts.map(n => Object.assign({ label: P.fmt(n) + " or more", onClick: () => set({ [s.pick]: n, gates: Object.assign({}, s.gates, { [s.pick]: true }), pick: null }) }, n === s[s.pick] ? ON : OFF)) : [],
      gates: gateOn.map(g => ({ label: gateLabel(g), met: true })),
      costRows: [
        { label: "Prize", value: F(a) + " " + sym }, { label: "Fees", value: F(fee) + " " + sym },
        { label: "Total", value: F(total) + " " + sym, strong: true }, { label: "Balance after", value: F(Math.max(0, T.bal - total)) + " " + sym },
      ].map((r, i) => ({ label: r.label, value: r.value, weight: r.strong ? 700 : 500, pad: i === 2 ? "10px" : "0", line: i === 2 ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "0",
        labelInk: r.strong ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)", valueInk: i === 3 && T.bal - total < 0 ? WARN : r.strong ? "var(--ink,#ECECF1)" : "var(--ink-2,#C9C9D4)" })),
      rows: rowDefs.map((r, i) => ({ mask: r.mask, label: r.label, value: r.value, open: s.row === r.k, rot: s.row === r.k ? "180deg" : "0deg", line: i ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "0",
        isWin: s.row === r.k && r.k === "win", isDur: s.row === r.k && r.k === "dur", isWho: s.row === r.k && r.k === "who", onClick: () => set({ row: s.row === r.k ? null : r.k, pick: null }) })),
      tokOpen: s.tokOpen, openTok: () => set({ tokOpen: true }), closeTok: () => set({ tokOpen: false }),
      toks: Object.values(TOK).map(t => ({ symbol: t.symbol, mark: t.mark, gradient: t.gradient, bal: fmt(t.bal, t.dp), bg: t.symbol === sym ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent", onClick: () => set({ tok: t.symbol, tokOpen: false }) })),
      notOk: !ok, attach,
      footText: ok ? "Total " + F(total) + " " + sym + " incl. fees" : reason, footInk: ok ? "var(--ink-3,#9A9AA8)" : reason === "Enter an amount" ? "var(--ink-4,#8A8A99)" : WARN,
    };
  }
}

export default Component;

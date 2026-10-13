// Logic for SwapOfferDialog.svelte — carried over from lib/SwapOfferDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Swap offer builder (composer + → Swap crypto). You offer / You want cards (wallet Swap parts) with flip,
// price chips (Market / +2 / +5 / +10% fill "You want"), expiry pills, escrow line by the button. No review step.
// "Attach offer" → onAttach(offer); host shows the composer chip and posts a SwapOffer on send. `initial` edits a previous value.
const TOK = {
  CHAT: { symbol: "CHAT", name: "OpenChat", mark: "C", gradient: "linear-gradient(140deg,#ff5f9e,#ffb03d)", bal: 132.332136, fee: 0.001, min: 0.01, usd: 0.053, dp: 4 },
  ICP: { symbol: "ICP", name: "Internet Computer", mark: "\u221E", gradient: "linear-gradient(140deg,#ff5f9e,#6a2bff)", bal: 4.2153, fee: 0.0001, min: 0.001, usd: 2.84, dp: 5 },
  ckBTC: { symbol: "ckBTC", name: "Chain-key Bitcoin", mark: "\u20BF", gradient: "linear-gradient(140deg,#ffb03d,#f7931a)", bal: 0.00213, fee: 0.0000001, min: 0.000001, usd: 62000, dp: 8 },
  ckUSDC: { symbol: "ckUSDC", name: "Chain-key USDC", mark: "$", gradient: "linear-gradient(140deg,#2775ca,#1FB6FF)", bal: 48.5, fee: 0.01, min: 0.1, usd: 1, dp: 2 },
  STK: { symbol: "STK", name: "Stake", mark: "S", gradient: "linear-gradient(140deg,#1b2a6b,#4fc3ff)", bal: 0, fee: 0.0001, min: 1, usd: 0.0021, dp: 2 },
};
const DURS = [["1 hour", "1h"], ["6 hours", "6h"], ["1 day", "1d"], ["7 days", "7d"], ["30 days", "30d"], ["90 days", "90d"]];
const PRICES = [["Market", 0], ["+2%", 0.02], ["+5%", 0.05], ["+10%", 0.1]];
const fmt = (n, dp) => Number(n.toFixed(dp)).toLocaleString("en-US", { maximumFractionDigits: dp });
const usdFmt = v => !v ? "$0.00" : v < 0.01 ? "$" + v.toPrecision(2) : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ON = { bg: "color-mix(in oklch,var(--accent,#FF5672) 16%,transparent)", ring: "color-mix(in oklch,var(--accent,#FF5672) 55%,transparent)", ink: "var(--accent-bright,#FF8298)" };
const OFF = { bg: "transparent", ring: "var(--line-2,rgba(255,255,255,.1))", ink: "var(--ink-2,#C9C9D4)" };
const WARN = "var(--status-warning,#FFB03D)", MUTED = "var(--ink-3,#9A9AA8)", QUIET = "var(--ink-4,#8A8A99)";
const q4 = n => String(Number(n.toPrecision(4)));

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const d = props.initial && props.initial.draft;
    this.state = Object.assign({ give: "CHAT", get: "ICP", amt: "", want: "", dur: 2, prem: 0, picker: null }, d || {});
  }
  boxRef = React.createRef();
  componentDidMount() { setTimeout(() => { const el = this.boxRef.current && this.boxRef.current.querySelector("input"); if (el) el.focus(); }, 60); }
  renderVals() {
    const p = this.props, s = this.state, set = o => this.setState(o);
    const G = TOK[s.give], R = TOK[s.get];
    const a = parseFloat(s.amt) || 0, w = parseFloat(s.want) || 0;
    const fees = G.fee * 2, lock = a + fees, max = Math.max(0, G.bal - fees);
    const mkt = n => n * G.usd / R.usd;
    const market = mkt(a);
    let reason = "";
    if (!a) reason = "Enter what you offer";
    else if (a < G.min) reason = "Minimum is " + fmt(G.min, G.dp) + " " + G.symbol;
    else if (a > max) reason = "Not enough " + G.symbol + " (max " + fmt(max, G.dp) + " after fees)";
    else if (!w) reason = "Enter what you want in return";
    const ok = !reason;
    const pct = market && w ? Math.round((w / market - 1) * 100) : 0;
    const vs = !a || !w ? "" : Math.abs(pct) < 1 ? "At market price" : Math.abs(pct) + "% " + (pct > 0 ? "above" : "below") + " market";
    // amount edits keep the chosen price chip in sync
    const withPrem = (v, prem) => prem == null ? {} : { want: v ? q4(mkt(v) * (1 + prem)) : "" };
    const attach = () => {
      if (!ok || !p.onAttach) return;
      const giveT = { amount: fmt(a, G.dp), symbol: G.symbol, mark: G.mark, gradient: G.gradient, usd: "≈ " + usdFmt(a * G.usd) };
      const getT = { amount: fmt(w, R.dp), symbol: R.symbol, mark: R.mark, gradient: R.gradient, usd: "≈ " + usdFmt(w * R.usd) };
      p.onAttach({
        type: "swap", give: giveT, get: getT, pair: [{ symbol: G.symbol, mark: G.mark, gradient: G.gradient }, { symbol: R.symbol, mark: R.mark, gradient: R.gradient }],
        expiresIn: DURS[s.dur][1], title: giveT.amount + " " + G.symbol + " → " + getT.amount + " " + R.symbol,
        summary: DURS[s.dur][1] + " · locks " + fmt(lock, G.dp) + " " + G.symbol,
        hint: "Expires in " + DURS[s.dur][0] + ". Locks " + fmt(lock, G.dp) + " " + G.symbol + " in escrow incl. 2 fees.",
        draft: { give: s.give, get: s.get, amt: s.amt, want: s.want, dur: s.dur, prem: s.prem },
      });
    };
    const picking = s.picker;
    return {
      title: p.initial ? "Edit swap offer" : "Create swap offer", cta: p.initial ? "Update offer" : "Attach offer",
      z: String(p.z ?? 80), boxRef: this.boxRef,
      onClose: () => { if (p.onClose) p.onClose(); },
      onKey: e => {
        if (e.key === "Escape") { e.stopPropagation(); if (s.picker) set({ picker: null }); else if (p.onClose) p.onClose(); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); attach(); }
      },
      give: { symbol: G.symbol, mark: G.mark, gradient: G.gradient }, get: { symbol: R.symbol, mark: R.mark, gradient: R.gradient },
      amt: s.amt, want: s.want, giveBal: fmt(G.bal, G.dp) + " " + G.symbol, getBal: fmt(R.bal, R.dp) + " " + R.symbol,
      giveNote: "≈ " + usdFmt(a * G.usd), getNote: "≈ " + usdFmt(w * R.usd), amtTone: a > max ? "danger" : "default",
      onAmt: e => { const v = e.target.value.replace(/[^0-9.]/g, ""); set(Object.assign({ amt: v }, withPrem(parseFloat(v) || 0, s.prem))); },
      onWant: e => set({ want: e.target.value.replace(/[^0-9.]/g, ""), prem: null }),
      onQuick: f => { if (typeof f === "number") { const v = Number((max * f).toFixed(G.dp)); set(Object.assign({ amt: String(v) }, withPrem(v, s.prem))); } },
      flip: () => { if (!R.bal) return; set({ give: s.get, get: s.give, amt: s.want, want: s.amt, prem: null }); },
      rate: a && w ? "1 " + G.symbol + " = " + q4(w / a) + " " + R.symbol : "Market: 1 " + G.symbol + " = " + q4(G.usd / R.usd) + " " + R.symbol,
      vs, vsInk: pct <= -5 ? WARN : MUTED,
      prices: PRICES.map(([label, k]) => Object.assign({ label, sel: s.prem === k, onClick: () => set(Object.assign({ prem: k }, withPrem(a, k))) }, s.prem === k ? ON : OFF)),
      durs: DURS.map((d, i) => Object.assign({ label: d[0], sel: i === s.dur, onClick: () => set({ dur: i }) }, i === s.dur ? ON : OFF)),
      foot: ok ? "Locks " + fmt(lock, G.dp) + " " + G.symbol + " in escrow (incl. 2 fees) until it's accepted, cancelled or expires" : reason,
      footInk: ok ? MUTED : reason.indexOf("Enter") === 0 ? QUIET : WARN, notOk: !ok, attach,
      pickGive: () => set({ picker: "give" }), pickGet: () => set({ picker: "get" }),
      pickerOpen: !!picking, pickerTitle: picking === "give" ? "Token to offer" : "Token to ask for", closePicker: () => set({ picker: null }),
      pickerTokens: Object.values(TOK).map(t => ({ symbol: t.symbol, name: t.name, mark: t.mark, gradient: t.gradient, held: fmt(t.bal, t.dp), owned: t.bal > 0,
        disabled: picking === "give" ? !t.bal || t.symbol === s.get : t.symbol === s.give, current: t.symbol === (picking === "give" ? s.give : s.get), title: picking === "give" && !t.bal ? "You don't hold any " + t.symbol : "" })),
      onPicked: sym => set(Object.assign(picking === "give" ? { give: sym } : { get: sym }, { picker: null, prem: s.prem == null ? null : s.prem }, s.prem == null ? {} : { want: "" })),
    };
  }
}

export default Component;

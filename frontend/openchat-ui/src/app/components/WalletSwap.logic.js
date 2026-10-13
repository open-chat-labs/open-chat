// Logic for WalletSwap.svelte — carried over from lib/WalletSwap.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  back: "var(--icon-back) center/contain no-repeat", caret: "var(--icon-chevron-down) center/contain no-repeat",
  swap: "var(--icon-swap) center/contain no-repeat",
  refresh: "var(--icon-refresh) center/contain no-repeat",
  dot: "var(--icon-dot) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
};
let TK = [];
const useTokens = p => { TK = (p.tokens || []).filter(t => t.price > 0).slice().sort((x, y) => (y.held > 0) - (x.held > 0)); };
const tokIdx = (sym, dflt) => { const i = TK.findIndex(x => x.symbol === sym); return i >= 0 ? i : Math.max(0, TK.findIndex(x => x.symbol === dflt)); };
const DEX = [{ name: "KongSwap", fee: "0.30%" }, { name: "ICPSwap", fee: "0.30%" }, { name: "Sonic", fee: "0.25%" }];
const SLIPS = [0.1, 0.5, 1, 3];
const QUOTE_SECS = 30;
const fmt = (v, dp) => v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: dp });
const usd = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// In-place Swap for the wallet main column: Details → Quote (30s, single best DEX) → Swap (three on-chain steps).
// Editing amount/tokens drops a live quote; slippage doesn't (min. received recomputes).
class Component extends DCLogic {
  constructor(p) {
    super(p);
    useTokens(p);
    const from = tokIdx(p.token, "ICP"), usdt = tokIdx("USDT", "USDT");
    this.state = { narrow: false, from, to: from === usdt ? tokIdx("ICP", "ICP") : usdt, amt: "", slip: 1, stage: "form", left: QUOTE_SECS, prog: 0, dex: 0, pick: null };
    this.rootRef = React.createRef();
  }
  componentDidMount() { this._observe(); }
  componentDidUpdate() { this._observe(); }
  _observe() {
    const el = this.rootRef.current;
    if (!el || this._roEl === el || typeof ResizeObserver === "undefined") return;
    if (this._ro) this._ro.disconnect();
    this._roEl = el;
    const n0 = el.getBoundingClientRect().width < 760; if (n0 !== this.state.narrow) this.setState({ narrow: n0 });
    this._ro = new ResizeObserver(([e]) => { const n = e.contentRect.width < 760; if (n !== this.state.narrow) this.setState({ narrow: n }); });
    this._ro.observe(el);
  }
  componentWillUnmount() { if (this._ro) this._ro.disconnect(); clearInterval(this._iv); clearInterval(this._pv); clearTimeout(this._qt); }
  _quote() {
    clearInterval(this._iv); clearTimeout(this._qt);
    this.setState({ stage: "quoting" });
    this._qt = setTimeout(() => {
      this.setState({ stage: "quoted", left: QUOTE_SECS, dex: Math.floor(Math.random() * DEX.length) });
      this._iv = setInterval(() => this.setState(st => st.left > 0 ? { left: st.left - 1 } : null), 1000);
    }, 1300);
  }
  _swap() {
    clearInterval(this._iv); this.setState({ stage: "progress", prog: 0 });
    this._pv = setInterval(() => this.setState(st => { const n = st.prog + 1; if (n >= 5) clearInterval(this._pv); return { prog: n, stage: n >= 5 ? "done" : "progress" }; }), 900);
  }
  renderVals() {
    useTokens(this.props);
    if (!TK.length) return { title: "Swap", noTokens: true, rootRef: this.rootRef };
    const s = this.state, set = p => this.setState(p);
    const f = TK[s.from], t = TK[s.to], n = parseFloat(String(s.amt).replace(/,/g, "")) || 0;
    const usdIn = n * f.price, impactPct = Math.min(9, usdIn / 40000 * 100);
    const out = usdIn / t.price * (1 - impactPct / 100) * 0.997;
    const slip = SLIPS[s.slip];
    const over = n > f.held, ok = n > 0 && !over;
    const next = (i, skip) => { let j = (i + 1) % TK.length; if (j === skip) j = (j + 1) % TK.length; return j; };
    const impact = (impactPct < 0.01 ? "<0.01" : impactPct.toFixed(2)) + "%";
    const impactInk = impactPct > 3 ? "var(--status-danger,#F5493D)" : impactPct > 1 ? "#FFB03D" : "#2EE6A8";
    const dex = DEX[s.dex];
    const rows = [
      { k: "Via", v: dex.name, ink: "var(--ink,#ECECF1)" },
      { k: "Price impact", v: impact, ink: impactInk },
      { k: "Min. received", v: fmt(out * (1 - slip / 100), t.dp) + " " + t.symbol, ink: "var(--ink,#ECECF1)" },
      { k: "DEX fee", v: dex.fee, ink: "var(--ink,#ECECF1)" },
      { k: "Network fees", v: "~$0.01", ink: "var(--ink,#ECECF1)" },
    ].map((r, i, a) => Object.assign(r, { div: i < a.length - 1 ? "1px solid var(--line-1)" : "none", rule: i < a.length - 1 ? "bottom" : "none" }));
    const stg = s.stage, quoted = stg === "quoted", done = stg === "done", busy = stg === "progress" || done;
    const drop = p => { if (stg === "quoted" || stg === "quoting") { clearInterval(this._iv); clearTimeout(this._qt); return Object.assign({ stage: "form" }, p); } return p; };
    const stepIdx = stg === "form" || stg === "quoting" ? 0 : quoted ? 1 : 2;
    const showOut = quoted || busy;
    // the real swap is 5 on-chain steps; grouped into the 3 phases people care about
    const amtIn = (n > 0 ? fmt(n, f.dp) : "0") + " " + f.symbol, amtOut = (n > 0 ? fmt(out, t.dp) : "0") + " " + t.symbol;
    const SUB = ["Get deposit account", "Transfer " + amtIn + " to " + dex.name, "Notify " + dex.name + " of the deposit", "Swap " + f.symbol + " for " + t.symbol, "Withdraw " + amtOut + " from " + dex.name];
    const PH = [["Send to " + dex.name, [0, 1, 2]], ["Swap", [3]], ["Return to your wallet", [4]]];
    const subState = k => done || k < s.prog ? "done" : k === s.prog ? "active" : "todo";
    const phases = PH.map(([title, ks]) => ({ title, steps: ks.map(k => ({ label: SUB[k], state: subState(k) })) }));
    const close = () => { if (this.props.onClose) this.props.onClose(); };
    const narrow = s.narrow;
    const money = v => usd(v);
    // pay: only what you hold. Get: anything swappable, yours first. Picking the other side's token flips the pair.
    const pickList = !s.pick ? [] : TK.map((x, i) => ({ x, i })).filter(({ x }) => s.pick === "to" || x.held > 0).map(({ x }) => ({
      symbol: x.symbol, name: x.name, mark: x.mark, gradient: x.grad, owned: x.held > 0,
      held: x.held > 0 ? fmt(x.held, x.dp) + " " + x.symbol : undefined, note: x.held > 0 ? money(x.held * x.price) : undefined }));
    const onPick = sym => {
      const i = TK.findIndex(x => x.symbol === sym); if (i < 0) return;
      const side = s.pick, other = side === "from" ? s.to : s.from;
      const p = i === other ? { from: s.to, to: s.from } : side === "from" ? { from: i } : { to: i };
      if (p.from != null && TK[p.from].held <= 0) { p.from = s.from; p.to = i === s.from ? s.to : i; }
      set(Object.assign(drop(p), { pick: null }));
    };
    return {
      pickOpen: !!s.pick, pickTitle: s.pick === "from" ? "Pay with which token?" : "Get which token?",
      pickPlaceholder: s.pick === "from" ? "Search your tokens" : "Search tokens",
      pickTokens: pickList, pickHeadings: s.pick === "from" ? ["IN YOUR WALLET", ""] : ["IN YOUR WALLET", "ALL TOKENS"],
      onPickToken: onPick, cancelPick: () => set({ pick: null }), m: M, rootRef: this.rootRef,
      title: "Swap " + f.symbol,
      cols: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 340px",
      pad: narrow ? "24px 22px 28px" : "28px 32px",
      panelMin: narrow ? "0" : "560px",
      back: () => { if (stg === "progress") return close(); close(); },
      w: {
        out: showOut ? (n > 0 ? fmt(out, t.dp) : "0") : "\u2014", outInk: showOut ? "var(--ink,#ECECF1)" : "var(--ink-5,#6E6E7C)",
        outFiat: showOut ? "\u2248 " + usd(out * t.price) : "Get a quote to see this",
        getLabel: quoted ? "YOU GET (QUOTED)" : "YOU GET",
        isForm: stg === "form", isQuoting: stg === "quoting", isQuoted: quoted, isProgress: busy, isDone: done, running: stg === "progress",
        formDim: busy ? ".45" : "1", formHits: busy || stg === "quoting" ? "none" : "auto",
        qLabel: ok ? "Get quote" : over ? "Not enough " + f.symbol : "Enter an amount", qDisabled: !ok,
        qBg: ok ? "var(--accent,#FF5672)" : "var(--overlay-2)", qInk: ok ? "var(--on-accent,#2E0512)" : "#7C7C8C", qCursor: ok ? "pointer" : "default",
        getQuote: () => { if (ok) this._quote(); },
        live: quoted && s.left > 0, expired: quoted && s.left <= 0,
        timer: s.left > 0 ? "0:" + String(s.left).padStart(2, "0") : "Expired",
        timerTone: s.left > 10 ? "neutral" : s.left > 0 ? "warning" : "danger",
        timerBg: s.left > 10 ? "var(--overlay-2)" : s.left > 0 ? "rgba(255,176,61,.12)" : "rgba(245,73,61,.12)",
        timerInk: s.left > 10 ? "var(--ink-2,#C9C9D4)" : s.left > 0 ? "#FFB03D" : "var(--status-danger,#F5493D)",
        swap: () => this._swap(),
        progKicker: done ? "SWAP COMPLETE" : "SWAPPING",
        progHead: done ? "Swapped " + amtIn + " for " + amtOut : amtIn + " \u2192 " + amtOut,
        phases, stepLabels: ["Details", "Quote", "Swap"], stepIdx, compactSteps: narrow,
        outVal: showOut ? (n > 0 ? fmt(out, t.dp) : "0") : "",
        progNote: done ? "It's in your wallet now." : "Step " + Math.min(s.prog + 1, 5) + " of 5 \u00B7 " + SUB[Math.min(s.prog, 4)],
        finish: () => { if (this.props.onSwapped) this.props.onSwapped({ from: f.symbol, to: t.symbol, amount: n, out, fiat: usdIn, fromDp: f.dp, toDp: t.dp }); close(); },
      },
      q: {
        from: f, to: t, amt: s.amt, onAmt: e => set(drop({ amt: e.target.value.replace(/[^0-9.,]/g, "") })),
        amtInk: over ? "var(--status-danger,#F5493D)" : "var(--ink,#ECECF1)", amtTone: over ? "danger" : "default",
        onChip: k => set(drop({ amt: String(Math.floor(f.held * k * Math.pow(10, Math.min(f.dp, 6))) / Math.pow(10, Math.min(f.dp, 6))) })),
        fromBal: fmt(f.held, f.dp) + " " + f.symbol, toBal: fmt(t.held, t.dp) + " " + t.symbol,
        fromFiat: over ? "More than your balance" : "\u2248 " + usd(usdIn), fromFiatInk: over ? "var(--status-danger,#F5493D)" : "var(--ink-3,#9A9AA8)",
        cycleFrom: () => set({ pick: "from" }), cycleTo: () => set({ pick: "to" }),
        flip: () => set(drop({ from: s.to, to: s.from, amt: n > 0 && showOut ? String(+out.toFixed(Math.min(t.dp, 6))) : s.amt })),
        chips: [["25%", .25], ["50%", .5], ["75%", .75], ["Max", 1]].map(([label, k]) => ({ label, pick: () => set(drop({ amt: String(Math.floor(f.held * k * Math.pow(10, Math.min(f.dp, 6))) / Math.pow(10, Math.min(f.dp, 6))) })) })),
        slipLabels: SLIPS.map(v => v + "%"), slipIdx: s.slip, onSlip: i => set({ slip: i }),
        slip: slip + "%",
        pair: (n > 0 ? fmt(n, f.dp) : "0") + " " + f.symbol + " \u2192 " + (n > 0 ? fmt(out, t.dp) : "0") + " " + t.symbol,
        rate: "1 " + f.symbol + " \u2248 " + fmt(f.price / t.price, t.symbol === "BTC" ? 8 : 4) + " " + t.symbol,
        rows,
      },
    };
  }
}

export default Component;

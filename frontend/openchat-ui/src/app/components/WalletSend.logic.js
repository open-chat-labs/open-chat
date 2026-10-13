// Logic for WalletSend.svelte — carried over from lib/WalletSend.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  up: "var(--icon-arrow-up) center/contain no-repeat", down: "var(--icon-arrow-down) center/contain no-repeat",
  plus: "var(--icon-plus) center/contain no-repeat",
  clock: "var(--icon-clock) center/contain no-repeat",
  back: "var(--icon-back) center/contain no-repeat", caret: "var(--icon-chevron-down) center/contain no-repeat", close: "var(--icon-close) center/contain no-repeat",
  user: "var(--icon-user) center/contain no-repeat",
  wallet: "var(--icon-wallet) center/contain no-repeat",
  search: "var(--icon-search) center/contain no-repeat",
  swap: "var(--icon-swap) center/contain no-repeat",
  note: "var(--icon-dm) center/contain no-repeat", check: "var(--icon-check) center/contain no-repeat",
  paste: "var(--icon-paste) center/contain no-repeat",
  bookmark: "var(--icon-bookmark) center/contain no-repeat",
  qr: "var(--icon-qr) center/contain no-repeat",
};
const UG = ["linear-gradient(140deg,#FFB35C,#FF6B6B)", "linear-gradient(140deg,#8B7BFF,#FF6FD8)", "linear-gradient(140deg,#5CD0FF,#4B7BFF)", "linear-gradient(140deg,#63E6A8,#2AA6FF)", "linear-gradient(140deg,#FFD166,#F2795C)"];
const PEOPLE = [["Jane Doe", "Recent"], ["Annie Schwartz", "Recent"], ["Nikki Laudia", "@the_pineal"], ["Chris Hanls", "@guru"], ["Neil Armstrong", "@moon"]];
let TK = [];
const useTokens = p => { TK = (p.tokens || []).filter(t => t.held > 0).map(t => Object.assign({}, t, { dp: t.inputDp ?? t.dp })); };
const tokIdx = (sym, dflt) => { const i = TK.findIndex(x => x.symbol === sym); return i >= 0 ? i : Math.max(0, TK.findIndex(x => x.symbol === dflt)); };
const HANDLES = ["@common_jane", "@anti_ice_cold", "@the_pineal", "@guru_of_thunder", "@i_walked_on_moon"];
const SAMPLE = { ICP: "6fe2b-qpkus-3dzpo-iuc7d-nwyfk-7tqaf-2lhi4-cpm5c-ys7gz-wbf3a-dae", BTC: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", CHAT: "5sj6i-pqaaa-aaaaf-a3cmq-cai", ETH: "0x4E2a9F07c1B3dD58e7A9b2c06F1d3E8a5C7b9D21", USDT: "0x4E2a9F07c1B3dD58e7A9b2c06F1d3E8a5C7b9D21", XRP: "rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY" };
const fmt = (v, dp) => v.toLocaleString("en-US", { maximumFractionDigits: dp });
const money = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const detectNet = a => { const v = (a || "").trim(); if (!v) return null;
  if (/^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v)) return "BTC";
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return "ETH";
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(v)) return "XRP";
  if (/^([a-z0-9]{5}-){2,10}[a-z0-9]{3}$/.test(v) || /^[0-9a-f]{64}$/.test(v)) return "ICP";
  return "unknown"; };
const NET_NAME = { BTC: "Bitcoin", ETH: "Ethereum", XRP: "XRP Ledger", ICP: "Internet Computer" };
const ADDR_NAME = { BTC: "Bitcoin", ETH: "Ethereum", XRP: "XRP", ICP: "ICP" };

// Send in the wallet main column: form + live summary side by side; below 760px the summary becomes a sticky footer.
class Component extends DCLogic {
  constructor(p) {
    super(p);
    useTokens(p);
    const i = tokIdx(p.token, "ICP");
    this.state = { narrow: false, s2: { tk: i, mode: p.address ? "address" : "user", user: null, address: p.address || "", amt: "", msg: "", msgOpen: false, inUsd: false, netOpen: false, footOpen: false, net: 0, step: "form", pin: 0 } };
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
  componentWillUnmount() { if (this._ro) this._ro.disconnect(); }
  _s2() {
    const s = this.state.s2, set = p => this.setState(st => ({ s2: Object.assign({}, st.s2, p) }));
    const tk = TK[s.tk], typed = parseFloat(String(s.amt).replace(/,/g, "")) || 0;
    const n = s.inUsd ? typed / tk.price : typed;
    const det = s.mode === "address" ? detectNet(s.address) : null;
    const multi = s.mode === "address" && tk.symbol === "BTC" && det === "BTC";
    const nets = [
      { label: "Bitcoin", short: "Native BTC", time: "10\u201360 min", fee: "~0.0000042 BTC", f: 0.0000042 },
      { label: "ckBTC on ICP", short: "Needs an ICP wallet", time: "Seconds", fee: "0.0000001 BTC", f: 0.0000001 },
    ];
    const fee = multi ? nets[s.net].f : tk.fee;
    const user = s.user != null ? { name: PEOPLE[s.user][0], handle: HANDLES[s.user], grad: UG[s.user] } : null;
    const wrongNet = det && det !== "unknown" && det !== (tk.net || tk.symbol);
    const recipOk = s.mode === "user" ? !!user : (!!det && det !== "unknown" && !wrongNet);
    const over = n + fee > tk.held;
    const ok = recipOk && n > 0 && !over;
    const toLabel = s.mode === "user" ? (user ? user.name : "\u2014") : (s.address ? s.address.slice(0, 10) + "\u2026" + s.address.slice(-6) : "\u2014");
    const avail = Math.max(0, tk.held - fee);
    return {
      title: "Send " + tk.symbol,
      isForm: s.step === "form", notForm: s.step !== "form", showFormHead: s.step !== "done",
      inUsd: !!s.inUsd, unitLabel: s.inUsd ? "USD" : tk.symbol,
      toggleUnit: () => set({ inUsd: !s.inUsd, amt: typed > 0 ? (s.inUsd ? String(Math.round(n * Math.pow(10, Math.min(tk.dp, 6))) / Math.pow(10, Math.min(tk.dp, 6))) : (n * tk.price).toFixed(2)) : "" }),
      msgCollapsed: !s.msgOpen && !s.msg, msgOpen: !!s.msgOpen || !!s.msg, openMsg: () => set({ msgOpen: true }), isPin: s.step === "pin", isDone: s.step === "done",
      back: () => { if (s.step === "pin") return set({ step: "form", pin: 0 }); if (this.props.onClose) this.props.onClose(); },
      headMark: s.step === "done" ? "" : tk.mark,
      tok: { symbol: tk.symbol, mark: tk.mark, grad: tk.grad, balance: fmt(tk.held, tk.dp) + " " + tk.symbol + " \u00B7 " + money(tk.held * tk.price) },
      cycleToken: () => set({ tk: (s.tk + 1) % TK.length, amt: "", address: "", net: 0, inUsd: false }),
      modes: [["user", "OpenChat user", M.user], ["address", "Wallet address", M.wallet]].map(([k, label, mask]) => { const on = s.mode === k; return { label, mask, on,
        bg: on ? "var(--btn-hover)" : "transparent", ink: on ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)", pick: () => set({ mode: k }) }; }),
      isUser: s.mode === "user", isAddr: s.mode === "address",
      hasUser: !!user, noUser: !user, user: user || { name: "", handle: "", grad: "transparent" },
      clearUser: () => set({ user: null }),
      quick: PEOPLE.map(([name], i) => { const on = s.user === i; return { first: name.split(" ")[0], grad: UG[i],
        bg: on ? "rgba(255,86,114,.1)" : "var(--overlay-1)", ring: on ? "inset 0 0 0 1px var(--accent,#FF5672)" : "none", pick: () => set({ user: i }) }; }),
      address: s.address, onAddress: e => set({ address: e.target.value.trim(), net: 0 }),
      addrLine: wrongNet || det === "unknown" ? "var(--status-danger,#F5493D)" : det ? "var(--accent,#FF5672)" : "var(--overlay-2)",
      hasDetect: !!det,
      detectLabel: det === "unknown" ? "Unrecognised address" : wrongNet ? det + " address \u2014 not " + tk.symbol : (ADDR_NAME[det] + " address"),
      detectBg: det === "unknown" || wrongNet ? "rgba(245,73,61,.12)" : "rgba(46,230,168,.12)",
      detectInk: det === "unknown" || wrongNet ? "var(--status-danger,#F5493D)" : "#2EE6A8",
      detectMask: det === "unknown" || wrongNet ? M.close : M.check,
      tools: [{ label: "Paste", mask: M.paste, go: () => set({ address: SAMPLE[tk.symbol], net: 0 }) }, { label: "Saved", mask: M.bookmark, go: () => set({ address: SAMPLE[tk.symbol], net: 0 }) }, { label: "Scan QR", mask: M.qr, go: () => {} }],
      showNets: multi,
      nets: nets.map((x, i) => { const on = s.net === i; return Object.assign({}, x, { on, div: i ? "1px solid var(--line-1)" : "none",
        radio: on ? "inset 0 0 0 5px var(--accent,#FF5672)" : "inset 0 0 0 1.5px rgba(255,255,255,.3)", dot: on ? "#fff" : "transparent", tick: on ? "var(--accent,#FF5672)" : "transparent", pick: () => set({ net: i, netOpen: false }) }); }),
      netSel: nets[s.net], netOpen: !!s.netOpen, toggleNet: () => set({ netOpen: !s.netOpen }),
      netCaret: s.netOpen ? "rotate(180deg)" : "none", netLine: s.netOpen ? "var(--accent,#FF5672)" : "var(--overlay-2)",
      footOpen: !!s.footOpen, toggleFoot: () => set({ footOpen: !s.footOpen }), footCaret: s.footOpen ? "none" : "rotate(180deg)",
      hasHistory: s.mode === "user" && !!user,
      histLabel: user ? "BETWEEN YOU AND " + user.name.split(" ")[0].toUpperCase() : "",
      history: user ? [
        { label: "You sent · 28 Sep", amount: "\u2212" + fmt(tk.held > 10 ? 50 : 0.002, tk.dp) + " " + tk.symbol, ink: "var(--ink,#ECECF1)", mask: M.up, v: tk.held > 10 ? 50 : 0.002 },
        { label: user.name.split(" ")[0] + " sent · 14 Sep", amount: "+" + fmt(tk.held > 10 ? 20 : 0.001, tk.dp) + " " + tk.symbol, ink: "#2EE6A8", mask: M.down, v: tk.held > 10 ? 20 : 0.001 },
        { label: "You sent · 2 Sep", amount: "\u2212" + fmt(tk.held > 10 ? 120 : 0.005, tk.dp) + " " + tk.symbol, ink: "var(--ink,#ECECF1)", mask: M.up, v: tk.held > 10 ? 120 : 0.005 },
      ].map(h => Object.assign(h, { reuse: () => set({ amt: s.inUsd ? (h.v * tk.price).toFixed(2) : String(h.v) }) })) : [],
      available: fmt(avail, tk.dp) + " " + tk.symbol,
      amount: s.amt, onAmount: e => set({ amt: e.target.value.replace(/[^0-9.,]/g, "") }),
      amtLine: over ? "var(--status-danger,#F5493D)" : n > 0 ? "rgba(255,255,255,.18)" : "var(--overlay-2)",
      chips: [["25%", .25], ["50%", .5], ["75%", .75], ["Max", 1]].map(([label, k]) => ({ label, pick: () => { const v = Math.floor(avail * k * Math.pow(10, Math.min(tk.dp, 6))) / Math.pow(10, Math.min(tk.dp, 6)); set({ amt: s.inUsd ? (v * tk.price).toFixed(2) : String(v) }); } })),
      amtNote: over ? "More than you can send" : n > 0 ? "\u2248 " + (s.inUsd ? fmt(n, tk.dp) + " " + tk.symbol : money(n * tk.price)) : (s.inUsd ? "Type an amount in USD" : "Type an amount in " + tk.symbol),
      amtNoteInk: over ? "var(--status-danger,#F5493D)" : "var(--ink-3,#9A9AA8)",
      message: s.msg, onMessage: e => set({ msg: e.target.value }),
      msgPlaceholder: s.mode === "user" && user ? "Add a note " + user.name.split(" ")[0] + " will see in your chat" : "A note for your own records",
      sumAmount: n > 0 ? fmt(n, tk.dp) + " " + tk.symbol : "0 " + tk.symbol, sumInk: n > 0 ? "var(--ink,#ECECF1)" : "var(--ink-5,#6E6E7C)",
      sumFiat: "\u2248 " + money(n * tk.price),
      sumHasAvatar: s.mode === "user" && !!user,
      toMain: s.mode === "user" ? (user ? user.name : "Not chosen yet") : (s.address ? s.address.slice(0, 10) + "\u2026" + s.address.slice(-6) : "Not entered yet"),
      toInk: recipOk ? "var(--ink,#ECECF1)" : "var(--ink-5,#6E6E7C)",
      hasToSub: s.mode === "user" ? !!user : !!det && det !== "unknown",
      toSub: s.mode === "user" ? (user ? user.handle : "") : "Wallet address",
      hasMsg: !!s.msg.trim(),
      total: fmt(n + fee, tk.dp) + " " + tk.symbol, totalFiat: "\u2248 " + money((n + fee) * tk.price), totalInk: over ? "var(--status-danger,#F5493D)" : "var(--ink,#ECECF1)",
      rows: [
        { k: "Network", v: s.mode === "user" ? "OpenChat" : multi ? nets[s.net].label : (det && det !== "unknown" ? NET_NAME[det] : "\u2014"), ink: "var(--ink,#ECECF1)" },
        { k: "Network fee", v: fmt(fee, tk.dp) + " " + tk.symbol, ink: "var(--ink,#ECECF1)" },
        { k: s.mode === "user" && user ? user.name.split(" ")[0] + " receives" : "They receive", v: fmt(n, tk.dp) + " " + tk.symbol, ink: n > 0 ? "var(--ink,#ECECF1)" : "var(--ink-5,#6E6E7C)" },
      ],
      blocked: !ok,
      ctaLabel: ok ? "Continue" : !recipOk ? (s.mode === "user" ? "Choose a recipient" : "Add a valid address") : n <= 0 ? "Enter an amount" : "Amount too high",
      ctaBg: ok ? "var(--accent,#FF5672)" : "var(--overlay-2)", ctaInk: ok ? "var(--on-accent,#2E0512)" : "#7C7C8C", ctaCursor: ok ? "pointer" : "default",
      ctaHint: ok ? "You'll confirm with your PIN next. Transfers can't be reversed." : "The summary fills in as you go.",
      go: () => { if (ok) set({ step: "pin", pin: 0 }); },
      pinSub: "Confirm sending " + fmt(n, tk.dp) + " " + tk.symbol + " to " + toLabel + ".",
      pinDots: [0, 1, 2, 3, 4, 5].map(i => ({ fill: i < s.pin ? "var(--ink,#ECECF1)" : "transparent", ring: i === s.pin ? "var(--accent,#FF5672)" : "var(--btn-hover)" })),
      pinCta: s.pin < 6 ? "Type PIN (demo)" : "Send",
      // confirming hands back to the wallet, which shows the pending row and a toast
      fakePin: () => { if (s.pin < 6) return set({ pin: 6 }); if (this.props.onSent) this.props.onSent({ symbol: tk.symbol, amount: n, fiat: n * tk.price, to: toLabel, dp: tk.dp, person: s.mode === "user" && !!user }); else set({ step: "done" }); },
      doneTitle: "Sent " + fmt(n, tk.dp) + " " + tk.symbol + " to " + toLabel,
      doneSub: multi && s.net === 0 ? "Bitcoin transfers take 10 to 60 minutes to confirm." : "It usually arrives within a few seconds.",
      reset: () => { if (this.props.onClose) this.props.onClose(); },
      backLabel: "Back to " + tk.symbol,
    };
  }
  renderVals() {
    useTokens(this.props);
    if (!TK.length) return { title: "Send", noTokens: true, rootRef: this.rootRef };
    const s2 = this._s2();
    s2.onChip = k => { const c = s2.chips[[0.25, 0.5, 0.75, 1].indexOf(k)]; if (c) c.pick(); };
    return { m: M, rootRef: this.rootRef, s2,
      // the PIN opens as a dialog over the form, which stays in place behind it
      wideForm: (s2.isForm || s2.isPin) && !this.state.narrow, narrowForm: (s2.isForm || s2.isPin) && this.state.narrow,
      cancelPin: () => this.setState(st => ({ s2: Object.assign({}, st.s2, { step: "form", pin: 0 }) })) };
  }
}

export default Component;

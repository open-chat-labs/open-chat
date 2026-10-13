// Logic for SendCryptoDialog.svelte — carried over from lib/SendCryptoDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Send crypto (composer + → Send crypto). Recipient at the top: fixed in a DM (`recipient`), picked from `members` in a group.
// Token pill + amount with live USD, quick chips, fee in the hint; irreversibility line by the button.
// "Attach" → onAttach(transfer): host puts it in the composer as a chip; caption + Send posts it. `initial` edits a previous value.
const TOK = {
  CHAT: { symbol: "CHAT", mark: "C", gradient: "linear-gradient(140deg,#ff5f9e,#ffb03d)", bal: 132.332136, fee: 0.001, min: 0.01, usd: 0.053, dp: 4 },
  ICP: { symbol: "ICP", mark: "\u221E", gradient: "linear-gradient(140deg,#ff5f9e,#6a2bff)", bal: 4.2153, fee: 0.0001, min: 0.0001, usd: 4.8, dp: 4 },
  ckBTC: { symbol: "ckBTC", mark: "\u20BF", gradient: "linear-gradient(140deg,#ffb03d,#f7931a)", bal: 0.00213, fee: 0.0000001, min: 0.0000001, usd: 62000, dp: 8 },
  ckUSDC: { symbol: "ckUSDC", mark: "$", gradient: "linear-gradient(140deg,#2775ca,#1FB6FF)", bal: 48.5, fee: 0.01, min: 0.01, usd: 1, dp: 2 },
};
const fmt = (n, dp) => Number(n.toFixed(dp)).toLocaleString("en-US", { maximumFractionDigits: dp });
const usdFmt = v => v === 0 ? "$0.00" : v < 0.01 ? "<$0.01" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WARN = "var(--status-warning,#FFB03D)", MUTED = "var(--ink-4,#8A8A99)";

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const d = props.initial && props.initial.draft;
    this.state = Object.assign({ tok: "CHAT", amt: "", to: null, toOpen: false, tokOpen: false, q: "" }, d || {});
  }
  boxRef = React.createRef(); amtRef = React.createRef(); qRef = React.createRef();
  componentDidMount() { setTimeout(() => { if (this.amtRef.current) this.amtRef.current.focus(); }, 60); }
  renderVals() {
    const p = this.props, s = this.state, set = o => this.setState(o);
    const T = TOK[s.tok], sym = T.symbol, F = n => fmt(n, T.dp);
    const members = p.members || [], fixed = p.recipient || null, canPick = !fixed && members.length > 0;
    const toM = fixed || members.find(m => m.handle === s.to) || null;
    const a = parseFloat(s.amt) || 0, max = Math.max(0, T.bal - T.fee);
    let reason = "";
    if (!toM) reason = "Choose who to send to";
    else if (!a) reason = "Enter an amount";
    else if (a < T.min) reason = "Minimum is " + F(T.min) + " " + sym;
    else if (a > max) reason = "Not enough " + sym + " (max " + F(max) + " after fee)";
    const ok = !reason;
    const attach = () => {
      if (!ok || !p.onAttach) return;
      const usd = a * T.usd;
      p.onAttach({
        type: "transfer", token: { symbol: sym, mark: T.mark, gradient: T.gradient }, amount: a, amountText: F(a) + " " + sym,
        usd, usdText: usdFmt(usd), recipient: { name: toM.name, handle: toM.handle }, fee: T.fee, feeText: F(T.fee) + " " + sym, totalText: F(a + T.fee) + " " + sym,
        title: F(a) + " " + sym, summary: "to " + toM.handle + " · " + usdFmt(usd),
        draft: { tok: s.tok, amt: s.amt, to: toM.handle },
      });
    };
    const q = s.q.trim().toLowerCase();
    const list = members.filter(m => !q || (m.name + " " + m.handle).toLowerCase().indexOf(q) >= 0);
    return {
      title: p.initial ? "Edit transfer" : "Send crypto", cta: p.initial ? "Update" : "Attach",
      z: String(p.z ?? 80), boxRef: this.boxRef, amtRef: this.amtRef, qRef: this.qRef,
      onClose: () => { if (p.onClose) p.onClose(); },
      onKey: e => {
        if (e.key === "Escape") { e.stopPropagation(); if (s.toOpen) set({ toOpen: false }); else if (s.tokOpen) set({ tokOpen: false }); else if (p.onClose) p.onClose(); }
        else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); attach(); }
      },
      canPick, toOpen: canPick && s.toOpen, toCursor: canPick ? "pointer" : "default",
      toRole: canPick ? "button" : "group", toTab: canPick ? "0" : "-1", toPopup: canPick ? "listbox" : undefined, toAria: canPick ? "Recipient: " + (toM ? toM.name : "none") : "Recipient",
      toggleTo: () => { if (canPick) this.setState({ toOpen: !s.toOpen, q: "" }, () => setTimeout(() => this.qRef.current && this.qRef.current.focus(), 0)); },
      to: toM ? { name: toM.name, handle: toM.handle, grad: toM.grad || "linear-gradient(140deg,#2EE6A8,#1FB6FF)", initial: (toM.name || "?")[0], ink: "var(--ink,#ECECF1)" }
        : { name: "Choose a member", handle: "Anyone in this chat", grad: "var(--overlay-2,rgba(255,255,255,.1))", initial: "?", ink: "var(--ink-3,#9A9AA8)" },
      q: s.q, onQ: e => set({ q: e.target.value }),
      members: list.map(m => ({ name: m.name, handle: m.handle, grad: m.grad || "linear-gradient(140deg,#2EE6A8,#1FB6FF)", initial: (m.name || "?")[0], sel: !!toM && m.handle === toM.handle,
        bg: toM && m.handle === toM.handle ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent", onClick: () => set({ to: m.handle, toOpen: false }) })),
      noMembers: list.length === 0,
      tok: { symbol: sym, mark: T.mark, gradient: T.gradient }, amt: s.amt,
      onAmt: e => set({ amt: e.target.value.replace(/[^0-9.]/g, "") }),
      onQuick: v => { const f = typeof v === "number" ? v : v && (v.value ?? v.fraction); if (typeof f === "number") set({ amt: String(Number((max * f).toFixed(T.dp))) }); },
      balText: F(T.bal) + " " + sym, usd: "≈ " + usdFmt(a * T.usd),
      hint: ok ? "Fee " + F(T.fee) + " " + sym + " added" : reason,
      hintInk: ok || reason === "Enter an amount" || reason === "Choose who to send to" ? MUTED : WARN,
      tokOpen: s.tokOpen, openTok: () => set({ tokOpen: true }), closeTok: () => set({ tokOpen: false }),
      toks: Object.values(TOK).map(t => ({ symbol: t.symbol, mark: t.mark, gradient: t.gradient, bal: fmt(t.bal, t.dp), bg: t.symbol === sym ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent", onClick: () => set({ tok: t.symbol, tokOpen: false }) })),
      notOk: !ok, attach,
    };
  }
}

export default Component;

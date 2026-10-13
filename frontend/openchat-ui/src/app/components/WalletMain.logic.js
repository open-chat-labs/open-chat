// Logic for WalletMain.svelte — carried over from lib/WalletMain.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  caret: "var(--icon-chevron-down) center/contain no-repeat", back: "var(--icon-back) center/contain no-repeat",
  send: "var(--icon-wallet-send) center/contain no-repeat",
  receive: "var(--icon-receive) center/contain no-repeat",
  swap: "var(--icon-swap) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
  copy: "var(--icon-copy) center/contain no-repeat",
  share: "var(--icon-share) center/contain no-repeat",
};
const G = { btc: "linear-gradient(140deg,#F7A63B,#F7931A)", chat: "linear-gradient(140deg,#2EE6A8,#1FB6FF)", eth: "linear-gradient(140deg,#B6C2F2,#7A8CE0)", icp: "linear-gradient(140deg,#ff5f9e,#6a2bff)", usdt: "linear-gradient(140deg,#4BD6A8,#1E9E7E)", xrp: "linear-gradient(140deg,#C9CFDA,#7A8492)" };
// same holdings as WalletPanel; names and decimals are only needed here
let TOKENS = [];
const num = (v, dp) => v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const usd = v => "$" + num(v, 2);
const price = v => v >= 100 ? "$" + num(v, 2) : v < 1 ? "$" + num(v, 4) : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const PEOPLE = [["Lucy Linden", "@lucy", "linear-gradient(140deg,#2EE6A8,#1FB6FF)"], ["Matt Rivers", "@mattr", "linear-gradient(140deg,#ffb03d,#ff4d4d)"], ["Ana Ferreira", "@ana", "linear-gradient(140deg,#ff5f9e,#6a2bff)"], ["Ryan Rogers", "@ryan", "linear-gradient(140deg,#5FA8FF,#8C6BFF)"]];
const NAMES = PEOPLE.map(p => p[0]);
// tokens you can receive without holding them yet
const RECEIVABLE = [
  ["ckBTC", "Chain-key Bitcoin", "\u20BF", "linear-gradient(140deg,#F9C97E,#E07A2F)"], ["USDC", "USD Coin", "$", "linear-gradient(140deg,#7EB7FF,#2775CA)"],
  ["SOL", "Solana", "S", "linear-gradient(140deg,#9CE7C8,#7B5BFF)"], ["LINK", "Chainlink", "L", "linear-gradient(140deg,#8CB4FF,#2A5ADA)"],
  ["MATIC", "Polygon", "M", "linear-gradient(140deg,#C9A8FF,#7B3FE4)"], ["AVAX", "Avalanche", "A", "linear-gradient(140deg,#FF9A8B,#E84142)"],
  ["DOT", "Polkadot", "\u2022", "linear-gradient(140deg,#FF9AD1,#E6007A)"], ["DOGE", "Dogecoin", "D", "linear-gradient(140deg,#F2D48A,#C2A633)"],
  ["SNS1", "SNS-1", "1", "linear-gradient(140deg,#9AE6FF,#3B82F6)"], ["KINIC", "Kinic", "K", "linear-gradient(140deg,#FFC58A,#FF7A45)"],
];
const LEDGER = { BTC: "mxzaz-hqaaa-aaaar-qaada-cai", CHAT: "2ouva-viaaa-aaaaq-aaamq-cai", ETH: "ss2fx-dyaaa-aaaar-qacoq-cai", ICP: "ryjl3-tyaaa-aaaaa-aaaba-cai", USDT: "cngnf-vqaaa-aaaar-qag4q-cai", XRP: "c6mxe-uqaaa-aaaar-qagnq-cai" };
const ORDER = ["Today", "Yesterday", "28 Sep", "21 Sep"];
const DIV = "1px solid var(--line-1,rgba(255,255,255,.06))";
const SOFT = "var(--accent,#FF5672)";

// sample history until the ledger index is wired
const history = (t, i) => {
  const q = t.symbol === "BTC" ? 0.0012 : Math.max(1, Math.round(t.held * 0.08 * 100) / 100);
  return [
    { title: "Received from " + NAMES[i % 4], when: "Today, 10:42 · in The Awesome Group", sign: "+", mask: M.receive, k: 1 },
    { title: "Sent to " + NAMES[(i + 1) % 4], when: "Yesterday, 18:05 · direct chat", sign: "\u2212", mask: M.send, k: 0.4 },
    { title: "Swapped to " + (t.symbol === "USDT" ? "ICP" : "USDT"), when: "28 Sep, 09:12", sign: "\u2212", mask: M.swap, k: 0.6 },
    { title: "Received from " + NAMES[(i + 2) % 4], when: "21 Sep, 14:30 · #general", sign: "+", mask: M.receive, k: 2 },
  ].filter(x => t.symbol !== "XRP" || x.sign === "+").map(x => { const a = q * x.k; return Object.assign({}, x, {
    when: x.when.replace(/\d\d:\d\d/, m => String((+m.slice(0, 2) + i) % 24).padStart(2, "0") + m.slice(2)),
    amount: x.sign + num(a, t.dp) + " " + t.symbol, fiat: usd(a * t.price), ink: x.sign === "+" ? "var(--status-online,#2EE6A8)" : "var(--ink,#ECECF1)" }); });
};

// The wallet's main column: All activity (home), a token page, and in-place Send / Receive / Swap.
// The host drives it with `request` ({ view, token, nonce }) from the wallet list on the left.
class Component extends DCLogic {
  state = { pick: null, toast: null, v: "all", tok: "CHAT", step: "form", amt: "", to: NAMES[0], swapTo: "USDT", copied: false, sent: [], filter: 0, fromAll: false, tokF: 0, ledgerCopied: false };
  componentDidMount() { this._apply(this.props.request); }
  componentDidUpdate(prev) { const r = this.props.request; if (r && (!prev.request || r.nonce !== prev.request.nonce)) this._apply(r); }
  _apply(r) {
    if (!r) return;
    const flow = r.view === "send" || r.view === "swap" || r.view === "receive";
    const cur = this.state;
    if (r.view === "token" && r.token && (cur.v === "send" || cur.v === "swap" || cur.v === "receive") && cur.step === "form") {
      this.setState({ tok: r.token, fromAll: false, amt: "", copied: false }, () => this._report());
      return;
    }
    // no token yet (e.g. Send in the summary card): ask which one first
    if ((r.view === "send" || r.view === "receive") && !r.token) { this.setState({ pick: { view: r.view } }); return; }
    const fromAll = flow && !r.token && this.state.v === "all";
    if (r.token && r.token !== this.state.tok) this.setState({ tokF: 0, ledgerCopied: false });
    this.setState({ v: r.view || "all", tok: r.token || this.state.tok, step: "form", amt: "", copied: false, fromAll: flow ? (fromAll || !!r.fromAll) : false }, () => this._report());
  }
  _report() { const s = this.state, flow = s.v === "send" || s.v === "swap" || s.v === "receive";
    if (this.props.onViewChange) this.props.onViewChange({ view: s.v, token: s.v === "all" || s.v === "recipients" || (flow && s.fromAll) ? null : s.tok }); }
  _set(p) { this.setState(p, () => this._report()); }

  renderVals() {
    TOKENS = (this.props.tokens || []).filter(t => t.held > 0);
    const s = this.state, set = p => this._set(p);
    const rows = TOKENS.map(t => Object.assign({}, t, { value: t.price * t.held }));
    const total = rows.reduce((n, t) => n + t.value, 0);
    const raw = rows.find(t => t.symbol === s.tok) || rows[0];
    const pct = v => (v / total * 100).toFixed(1) + "%";
    const flow = s.v === "send" || s.v === "swap";
    const n = parseFloat(String(s.amt).replace(/,/g, "")) || 0;
    const over = n > raw.held, ok = n > 0 && !over && (s.v !== "send" || !!s.to);
    const toTok = rows.find(t => t.symbol === (s.swapTo === raw.symbol ? (raw.symbol === "USDT" ? "ICP" : "USDT") : s.swapTo)) || rows[4];
    const out = n * raw.price / toTok.price * 0.997;
    const fee = raw.symbol === "BTC" ? 0.0000001 : 0.0001;
    const amtStr = num(n, raw.dp) + " " + raw.symbol;
    const idx = rows.indexOf(raw);
    const mine = s.sent.filter(e => e.sym === raw.symbol).map(e => Object.assign({}, e.row, { fresh: true, hasStatus: !!e.status,
      status: e.status === "pending" ? "Pending" : "Sent",
      statusBg: e.status === "pending" ? "rgba(255,176,61,.12)" : "rgba(46,230,168,.12)",
      statusInk: e.status === "pending" ? "var(--status-gold,#FFB03D)" : "var(--status-online,#2EE6A8)",
      statusTone: e.status === "pending" ? "warning" : "success" }));
    const activity = mine.concat(history(raw, idx)).map((x, i) => Object.assign({}, x, { divider: i ? DIV : "none",
      hl: x.fresh ? "rgba(46,230,168,.06)" : "transparent", hlRadius: x.fresh ? "12px" : "0", hlPad: x.fresh ? "10px" : "0" }));
    const titles = { all: "All activity", token: raw.name, send: "Send " + raw.symbol, receive: "Receive " + raw.symbol, swap: "Swap " + raw.symbol };
    const stepIdx = s.step === "form" ? 0 : s.step === "review" ? 1 : 2;
    // All activity
    const kindOf = title => title.indexOf("Received") === 0 ? 2 : title.indexOf("Sent") === 0 ? 1 : 3;
    const entries = s.sent.map(e => ({ sym: e.sym, row: Object.assign({}, e.row, { when: "Today, just now" }), fresh: true }));
    rows.forEach((tk, i) => { const h = history(tk, i); [i % 4, (i + 1) % 4].forEach(a => { if (h[a]) entries.push({ sym: tk.symbol, row: h[a] }); }); });
    const shown = entries.filter(e => !s.filter || kindOf(e.row.title) === s.filter);
    const allGroups = ORDER.map(label => ({ label: label.toUpperCase(), items: shown.filter(e => e.row.when.split(",")[0] === label).map(e => {
      const tk = rows.find(r => r.symbol === e.sym);
      const k = kindOf(e.row.title);
      return { symbol: tk.symbol, mark: tk.mark, grad: tk.grad, badge: k === 2 ? "receive" : k === 1 ? "send" : "swap", mask: e.row.mask, title: e.row.title, sub: tk.symbol + " · " + e.row.when.split(",").slice(1).join(",").trim(),
        amount: e.row.amount, fiat: e.row.fiat, ink: e.row.ink, hl: e.fresh ? "rgba(46,230,168,.06)" : "transparent",
        pick: () => set({ v: "token", tok: e.sym, step: "form", amt: "" }) };
    }) })).filter(g => g.items.length);
    // token page: day groups + filter, empty state when a filter has nothing
    const tokShown = activity.filter(x => !s.tokF || kindOf(x.title) === s.tokF);
    const dayOf = x => { const d = String(x.when || "").split(",")[0]; return ORDER.indexOf(d) >= 0 ? d : "Today"; };
    const tokGroups = ORDER.map(label => { const items = tokShown.filter(x => dayOf(x) === label);
      return { label: label.toUpperCase(), items: items.map((x, i) => Object.assign({}, x, { divider: i ? DIV : "none", hasDivider: i > 0 && !x.fresh, kind: ["receive", "send", "receive", "swap"][kindOf(x.title)] || "receive",
        sub: String(x.when || "").indexOf(",") >= 0 ? String(x.when).split(",").slice(1).join(",").trim() : (x.when || "Just now") })) }; }).filter(g => g.items.length);
    const EMPTY = [null,
      { icon: "send", title: "No " + raw.symbol + " sent yet", body: raw.symbol + " you send to people or addresses will show up here." },
      { icon: "receive", title: "No " + raw.symbol + " received yet", body: raw.symbol + " people send you will show up here." },
      { icon: "swap", title: "No " + raw.symbol + " swaps yet", body: "Swaps from or into " + raw.symbol + " will show up here." }][s.tokF];
    const CHG = [2.4, -0.8, 1.1, 3.2, 0.0, -1.6][idx % 6];
    if (this.props.onCount) { const c = entries.length; if (c !== this._lastCount) { this._lastCount = c; setTimeout(() => this.props.onCount(c)); } }
    const veiled = !!this.props.balanceHidden;
    return { allTokens: this.props.tokens || [], m: M,
      veiled, veilFilter: veiled ? "blur(8px)" : "none", veilSelect: veiled ? "none" : "auto", selShare: veiled ? "••••" : pct(raw.value),
      selShareShown: veiled ? 33 : raw.value / total * 100,
      title: titles[s.v],
      // send / receive / swap reuse the modal flows, rendered in place
      isSendView: s.v === "send", isReceiveView: s.v === "receive", isSwapView: s.v === "swap",
      notFlow: s.v !== "send" && s.v !== "receive" && s.v !== "swap" && s.v !== "recipients",
      isRecipientsView: s.v === "recipients",
      recipients: s.recipients || undefined, onRecipients: list => this.setState({ recipients: list }),
      leaveRecipients: () => set({ v: "all" }),
      sendAddress: s.v === "send" ? s.sendAddr || "" : "",
      // a saved recipient's own token lock wins; otherwise the network's native token
      sendToRecipient: r => { const sym = r.token || ({ BTC: "BTC", ETH: "ETH", XRP: "XRP" })[r.network] || "ICP";
        set({ v: "send", tok: sym, fromAll: false, backToRecipients: true, sendAddr: r.address, step: "form", amt: "", flowNonce: (s.flowNonce || 0) + 1 }); },
      flowToken: s.extTok && s.v === "receive" ? s.extTok : s.fromAll ? "" : raw.symbol,
      flowKey: s.v + ":" + (s.fromAll ? "-" : raw.symbol) + ":" + (s.flowNonce || 0),
      leaveFlow: () => set({ v: s.backToRecipients ? "recipients" : s.fromAll || s.backToAll ? "all" : "token", fromAll: false, backToAll: false, backToRecipients: false, sendAddr: "" }),
      // a send lands back on the token page: pending row at the top of Activity + a toast; no done screen
      onSent: x => {
        const id = Date.now();
        const amt = num(x.amount, Math.min(x.dp, 8)) + " " + x.symbol;
        this.setState(st => ({ v: st.fromAll || st.backToAll ? "all" : "token", fromAll: false, backToAll: false, tok: x.symbol,
          toast: { id, message: "Sent " + amt + " to " + x.to, person: !!x.person },
          sent: [{ id, sym: x.symbol, status: "pending", row: { title: "Sent to " + x.to, when: "Just now", mask: M.send, amount: "\u2212" + amt, fiat: usd(x.fiat), ink: "var(--ink,#ECECF1)" } }].concat(st.sent) }), () => this._report());
        clearTimeout(this._toastT); this._toastT = setTimeout(() => this.setState(st => st.toast && st.toast.id === id ? { toast: null } : null), 6000);
        setTimeout(() => this.setState(st => ({ sent: st.sent.map(e => e.id === id ? Object.assign({}, e, { status: "sent" }) : e) })), x.symbol === "BTC" ? 8000 : 2500);
        if (this.props.onSent) this.props.onSent(x);
      },
      hasToast: !!s.toast, toastKey: s.toast ? String(s.toast.id) : "",
      toastMessage: s.toast ? s.toast.message : "",
      toastAction: s.toast && s.toast.person ? "Message" : "View",
      onToastAction: () => { const tt = this.state.toast; this.setState({ toast: null, v: "token" }); if (tt && tt.person && this.props.onMessage) this.props.onMessage(tt.message); },
      dismissToast: () => this.setState({ toast: null }),
      pickPlaceholder: s.pick && s.pick.view === "receive" ? "Search any token" : "Search your tokens",
      pickOpen: !!s.pick, pickTitle: s.pick && s.pick.view === "receive" ? "Receive which token?" : "Send which token?",
      cancelPick: () => this.setState({ pick: null }),
      // sending: tokens you hold. Receiving: any supported token — yours first, then the rest (same catalogue as ReceiveDialog)
      pickTokens: rows.filter(tk => tk.held > 0).map(tk => ({ symbol: tk.symbol, name: tk.name, mark: tk.mark, gradient: tk.grad, owned: true,
        held: num(tk.held, tk.dp) + " " + tk.symbol, note: usd(tk.value) }))
        .concat(s.pick && s.pick.view === "receive" ? RECEIVABLE.map(x => ({ symbol: x[0], name: x[1], mark: x[2], gradient: x[3], owned: false })) : []),
      pickHeadings: s.pick && s.pick.view === "receive" ? ["IN YOUR WALLET", "ALL SUPPORTED TOKENS"] : ["IN YOUR WALLET", "ALL TOKENS"],
      onPickToken: sym => set({ pick: null, v: (this.state.pick && this.state.pick.view) || "send", tok: sym, extTok: rows.some(r => r.symbol === sym) ? null : sym, step: "form", amt: "", copied: false, fromAll: false, backToAll: this.state.v === "all", flowNonce: Date.now() }),
      isAll: s.v === "all", isToken: s.v === "token", isReceive: s.v === "receive",
      hasBack: s.v !== "all" && s.step !== "done",
      headBack: s.v !== "all" && s.step !== "done" ? () => (s.step === "review" ? set({ step: "form" }) : s.v === "token" ? set({ v: "all" }) : set({ v: s.fromAll ? "all" : "token", step: "form", amt: "", fromAll: false })) : null,
      headMark: s.v === "token" ? raw.mark : "",
      backLabel: "Back to " + (s.v === "token" || s.fromAll ? "All activity" : s.step === "review" ? "details" : raw.symbol),
      titlePad: s.v !== "all" && s.step !== "done" ? "0" : "var(--space-10)",
      back: () => s.step === "review" ? set({ step: "form" }) : s.v === "token" ? set({ v: "all" }) : set({ v: s.fromAll ? "all" : "token", step: "form", amt: "", fromAll: false }),
      hasSteps: flow,
      steps: ["Details", "Review", "Done"].map((label, i) => ({ n: i < stepIdx ? "\u2713" : String(i + 1), label, sep: i < 2 ? "block" : "none",
        bg: i <= stepIdx ? SOFT : "var(--overlay-2,rgba(255,255,255,.08))", numInk: i <= stepIdx ? "var(--on-accent,#2E0512)" : "var(--ink-3,#9A9AA8)", ink: i === stepIdx ? "var(--ink,#ECECF1)" : "var(--ink-4,#8A8A99)" })),
      filterTabs: ["All", "Sent", "Received", "Swaps"], filterIdx: s.filter, onFilter: i => set({ filter: i }),
      allGroups, allEmpty: allGroups.length === 0,
      colMax: s.v === "token" ? "960px" : "640px",
      tokGroups, tokEmpty: !tokGroups.length, tokFilterIdx: s.tokF, onTokFilter: i => this.setState({ tokF: i }),
      tokEmptyIcon: EMPTY ? EMPTY.icon : "", tokEmptyTitle: EMPTY ? EMPTY.title : "No activity yet", tokEmptyBody: EMPTY ? EMPTY.body : "Transactions for " + raw.symbol + " will show up here.",
      sel: { symbol: raw.symbol, name: raw.name, mark: raw.mark, grad: raw.grad, heldLong: num(raw.held, raw.dp) + " " + raw.symbol,
        heldNum: num(raw.held, raw.dp), value: usd(raw.value), share: pct(raw.value), shareNum: raw.value / total * 100, shareBar: Math.max(2, raw.value / total * 100).toFixed(1) + "%",
        changeToday: (CHG > 0 ? "+" : CHG < 0 ? "\u2212" : "") + Math.abs(CHG).toFixed(1) + "% today",
        changeTone: CHG > 0 ? "success" : CHG < 0 ? "danger" : "neutral",
        changeBg: CHG > 0 ? "rgba(46,230,168,.12)" : CHG < 0 ? "rgba(245,73,61,.12)" : "var(--overlay-2,rgba(255,255,255,.06))",
        changeInk: CHG > 0 ? "var(--status-online,#2EE6A8)" : CHG < 0 ? "var(--status-danger,#F5493D)" : "var(--ink-3,#9A9AA8)",
        facts: [{ k: "Price", v: price(raw.price) }, { k: "Transfer fee", v: (raw.symbol === "BTC" ? "0.0000001" : "0.0001") + " " + raw.symbol }, { k: "Standard", v: "ICRC-1" },
          { k: "Ledger", v: LEDGER[raw.symbol].slice(0, 5) + "\u2026" + LEDGER[raw.symbol].slice(-4), copy: true, copyValue: LEDGER[raw.symbol], copyTitle: s.ledgerCopied ? "Copied" : "Copy ledger ID", copyMask: s.ledgerCopied ? M.check : M.copy,
            onCopy: () => { try { navigator.clipboard.writeText(LEDGER[raw.symbol]); } catch (err) {} this.setState({ ledgerCopied: true }); clearTimeout(this._lc); this._lc = setTimeout(() => this.setState({ ledgerCopied: false }), 1600); } }],
        stats: [{ label: "VALUE", value: usd(raw.value) }, { label: "HOLDINGS", value: num(raw.held, raw.dp) }, { label: "PRICE", value: price(raw.price) }, { label: "SHARE", value: pct(raw.value) }] },
      actions: [
        { label: "Send", fullLabel: "Send " + raw.symbol, mask: M.send, bg: SOFT, ink: "var(--on-accent,#2E0512)", go: () => set({ v: "send", step: "form", amt: "", fromAll: false }) },
        { label: "Receive", fullLabel: "Receive " + raw.symbol, mask: M.receive, bg: "var(--overlay-2,rgba(255,255,255,.06))", ink: "var(--ink,#ECECF1)", go: () => set({ v: "receive", copied: false, fromAll: false }) },
        { label: "Swap", fullLabel: "Swap " + raw.symbol, mask: M.swap, bg: "var(--overlay-2,rgba(255,255,255,.06))", ink: "var(--ink,#ECECF1)", go: () => set({ v: "swap", step: "form", amt: "", fromAll: false }) },
      ],
      activity,
      showTokenPick: !!s.fromAll && ((flow && s.step === "form") || s.v === "receive"),
      pickJustify: s.v === "receive" ? "center" : "flex-start",
      tokenChips: rows.map(tk => { const on = tk.symbol === raw.symbol; return { symbol: tk.symbol, mark: tk.mark, grad: tk.grad, on,
        bg: on ? "var(--overlay-2,rgba(255,255,255,.08))" : "var(--overlay-1,rgba(255,255,255,.03))", ring: on ? "inset 0 0 0 1px var(--accent,#FF5672)" : "none",
        pick: () => set({ tok: tk.symbol, amt: "", copied: false }) }; }),
      isSendForm: s.v === "send" && s.step === "form", isSwapForm: s.v === "swap" && s.step === "form",
      hasAmount: flow && s.step === "form", hasFormCta: flow && s.step === "form",
      amountLabel: s.v === "swap" ? "YOU PAY" : "AMOUNT",
      people: PEOPLE.map(([name, handle, grad]) => { const on = s.to === name; return { name, handle, grad, on,
        bg: on ? "var(--overlay-2,rgba(255,255,255,.06))" : "transparent", ring: on ? "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.16))" : "none",
        radio: on ? "inset 0 0 0 5px var(--accent,#FF5672)" : "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.3))", dot: on ? "#fff" : "transparent", pick: () => set({ to: name }) }; }),
      amount: s.amt, onAmount: e => set({ amt: e.target.value.replace(/[^0-9.,]/g, "") }),
      max: () => set({ amt: String(raw.held) }),
      amtLine: over ? "var(--status-danger,#F5493D)" : "var(--line-1,rgba(255,255,255,.08))",
      amtHint: over ? "More than your balance" : n > 0 ? "\u2248 " + usd(n * raw.price) : "Enter an amount",
      amtHintInk: over ? "var(--status-danger,#F5493D)" : "var(--ink-4,#8A8A99)",
      flip: () => set({ tok: toTok.symbol, swapTo: raw.symbol, amt: "" }),
      cycleTo: () => { const others = rows.filter(r => r.symbol !== raw.symbol); const i = others.findIndex(r => r.symbol === toTok.symbol); set({ swapTo: others[(i + 1) % others.length].symbol }); },
      to: { symbol: toTok.symbol, mark: toTok.mark, grad: toTok.grad },
      swapOut: n > 0 ? num(out, toTok.dp) : "0",
      rate: "1 " + raw.symbol + " \u2248 " + num(raw.price / toTok.price, toTok.symbol === "BTC" ? 8 : 4) + " " + toTok.symbol + " · 0.3% fee",
      ctaDisabled: !ok, ctaBg: ok ? SOFT : "var(--overlay-2,rgba(255,255,255,.06))", ctaInk: ok ? "var(--on-accent,#2E0512)" : "var(--ink-5,#6E6E7C)", ctaCursor: ok ? "pointer" : "default",
      toReview: () => { if (ok) set({ step: "review" }); },
      isReview: flow && s.step === "review",
      reviewKicker: s.v === "send" ? "YOU'RE SENDING" : "YOU'RE SWAPPING",
      reviewAmount: amtStr, reviewFiat: "\u2248 " + usd(n * raw.price),
      reviewRows: (s.v === "send"
        ? [{ label: "To", value: s.to }, { label: "Network fee", value: String(fee) + " " + raw.symbol }, { label: "Total", value: num(n + fee, Math.max(raw.dp, 4)) + " " + raw.symbol }]
        : [{ label: "You get (est.)", value: num(out, toTok.dp) + " " + toTok.symbol }, { label: "Rate", value: "1 " + raw.symbol + " \u2248 " + num(raw.price / toTok.price, 4) + " " + toTok.symbol }, { label: "Swap fee", value: "0.3%" }])
        .map((r, i) => Object.assign(r, { divider: i ? DIV : "none" })),
      reviewNote: s.v === "send" ? "Transfers can't be reversed. Check the recipient before you send." : "The final amount may differ slightly if the price moves before the swap completes.",
      confirmLabel: s.v === "send" ? "Send " + raw.symbol : "Swap",
      confirm: () => set({ step: "done", sent: [{ sym: raw.symbol, row: { title: s.v === "send" ? "Sent to " + s.to : "Swapped to " + toTok.symbol, when: "Just now",
        mask: s.v === "send" ? M.send : M.swap, amount: "\u2212" + amtStr, fiat: usd(n * raw.price), ink: "var(--ink,#ECECF1)" } }].concat(s.sent) }),
      isDone: flow && s.step === "done",
      doneTitle: s.v === "send" ? "Sent " + amtStr + " to " + s.to : "Swapped " + amtStr + " for " + num(out, toTok.dp) + " " + toTok.symbol,
      doneSub: s.v === "send" ? "It usually arrives within a few seconds." : "Your balances will update in a moment.",
      finish: () => set({ v: "token", step: "form", amt: "", fromAll: false }),
      network: raw.symbol === "ICP" || raw.symbol === "CHAT" ? "the Internet Computer" : raw.name,
      address: raw.symbol === "BTC" ? "bc1q9h7garjx3v2l6q0c8y5m4ehz2ksw0f7r3dx6ta" : raw.symbol === "ETH" || raw.symbol === "USDT" ? "0x4E2a9F07c1B3dD58e7A9b2c06F1d3E8a5C7b9D21" : "6fe2b-qpkus-3dzpo-iuc7d-nwyfk-7tqaf-2lhi4-cpm5c-ys7gz-wbf3a-dae",
      copyLabel: s.copied ? "Copied" : "Copy", copyMask: s.copied ? M.check : M.copy,
      copyBg: s.copied ? "rgba(46,230,168,.12)" : "var(--overlay-2,rgba(255,255,255,.07))", copyInk: s.copied ? "var(--status-online,#2EE6A8)" : "var(--ink,#ECECF1)",
      copy: () => set({ copied: true }),
    };
  }
}

export default Component;

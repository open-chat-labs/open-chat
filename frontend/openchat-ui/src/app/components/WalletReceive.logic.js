// Logic for WalletReceive.svelte — carried over from lib/WalletReceive.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  caret: "var(--icon-chevron-down) center/contain no-repeat", check: "var(--icon-check) center/contain no-repeat",
  copy: "var(--icon-copy) center/contain no-repeat",
  share: "var(--icon-share) center/contain no-repeat",
  search: "var(--icon-search) center/contain no-repeat",
  alert: "var(--icon-warning) center/contain no-repeat",
};
const NET = {
  icp: { label: "ICP network", short: "Internet Computer", time: "Seconds", blurb: "Native on the Internet Computer. Arrives in seconds, fees in fractions of a cent.", address: "5sj6i-pqaaa-aaaaf-a3cmq-cai" },
  eth: { label: "Ethereum network", short: "As an ERC-20 token", time: "1\u20135 min", blurb: "Arrives on Ethereum. Widely supported, slower and dearer when the network is busy.", address: "0x7Bf3c9A1e64D25aB8f0C3e7d19A4b62F5dE81Ca0" },
  btc: { label: "Bitcoin network", short: "Native BTC", time: "10\u201360 min", blurb: "Settles on Bitcoin itself. Allow ten minutes or more per confirmation.", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
  xrpl: { label: "XRP Ledger", short: "Native XRP", time: "Seconds", blurb: "Settles on the XRP Ledger within seconds.", address: "rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT" },
};
// same catalogue as the Receive dialog: any listed token can be received, held or not
let TOKENS = [];
// wrapped forms on ICP get their chain-key name, so the warning names exactly what to send
const ICP_AS = { BTC: "ckBTC", ETH: "ckETH", USDC: "ckUSDC", USDT: "ckUSDT", XRP: "ckXRP" };

const CHATS = [
  { name: "Lucy Linden", kind: "Direct chat", grad: "linear-gradient(140deg,#2EE6A8,#1FB6FF)", radius: "50%" },
  { name: "The Awesome Group", kind: "Group · 248 members", grad: "linear-gradient(140deg,#5FA8FF,#8C6BFF)", radius: "11px" },
  { name: "Matt Rivers", kind: "Direct chat", grad: "linear-gradient(140deg,#ffb03d,#ff4d4d)", radius: "50%" },
  { name: "#general", kind: "OpenChat community", grad: "linear-gradient(140deg,#ff5f9e,#6a2bff)", radius: "11px" },
  { name: "Design Guild", kind: "Group · 112 members", grad: "linear-gradient(140deg,#b06bff,#5b2a86)", radius: "11px" },
  { name: "Ryan Rogers", kind: "Direct chat", grad: "linear-gradient(140deg,#5FA8FF,#8C6BFF)", radius: "50%" },
];

class Component extends DCLogic {
  state = { net: 0, open: false, copied: false, hCopied: false, narrow: false, share: false, q: "", toast: null };
  rootRef = React.createRef();
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
  componentWillUnmount() { if (this._ro) this._ro.disconnect(); clearTimeout(this._t1); clearTimeout(this._t2); clearTimeout(this._t3); }
  componentDidUpdate(prev) { if (prev.token !== this.props.token) this.setState({ net: 0, open: false, copied: false }); }
  _flash(k, t) { this.setState({ [k]: true }); clearTimeout(this[t]); this[t] = setTimeout(() => this.setState({ [k]: false }), 1600); }
  renderVals() {
    TOKENS = (this.props.tokens || []).filter(t => t.nets && t.nets.length);
    const p = this.props, s = this.state;
    const tok = TOKENS.find(x => x.symbol === p.token) || TOKENS.find(x => x.symbol === "ICP") || TOKENS[0];
    if (!tok) return { title: "Receive", noTokens: true, rootRef: this.rootRef };
    const ids = tok.nets, id = ids[Math.min(s.net, ids.length - 1)], base = NET[id];
    const wrapped = id === "icp" && ICP_AS[tok.symbol];
    const net = Object.assign({}, base, wrapped ? { label: "ICP network", short: "Arrives as " + wrapped, blurb: "Arrives as " + wrapped + " on the Internet Computer within seconds, for a fraction of a cent." } : {});
    const what = wrapped || tok.symbol;
    const addr = base.address;
    return { m: M, rootRef: this.rootRef,
      cols: s.narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 320px",
      pad: s.narrow ? "24px 22px 28px" : "28px max(32px, calc((100% - 960px) / 2))",
      formOrder: s.narrow ? "2" : "1", qrOrder: s.narrow ? "1" : "2",
      tok: { symbol: tok.symbol, mark: tok.mark, grad: tok.grad },
      multi: ids.length > 1, single: ids.length < 2,
      net, netOpen: s.open, caret: s.open ? "rotate(180deg)" : "none",
      netLine: s.open ? "var(--accent,#FF5672)" : "var(--line-1,rgba(255,255,255,.08))",
      toggleNet: () => this.setState({ open: !s.open }),
      nets: ids.map((nid, i) => { const w = nid === "icp" && ICP_AS[tok.symbol]; const n = NET[nid]; return { label: n.label, short: w ? "Arrives as " + w : n.short, time: n.time, on: i === s.net,
        tick: i === s.net ? "var(--accent,#FF5672)" : "transparent", pick: () => this.setState({ net: i, open: false, copied: false }) }; }),
      addrHead: addr.slice(0, 6), addrMid: addr.slice(6, -6), addrTail: addr.slice(-6),
      warn: "Only send " + what + " on the " + net.label + " to this address. Sending other tokens, or " + tok.symbol + " on another network, can't be recovered.",
      copyLabel: s.copied ? "Copied" : "Copy", copyMask: s.copied ? M.check : M.copy,
      copied: s.copied, copyTitle: s.copied ? "Copied" : "Copy address",
      copyBg: s.copied ? "rgba(46,230,168,.14)" : "var(--accent,#FF5672)", copyInk: s.copied ? "var(--status-online,#2EE6A8)" : "var(--on-accent,#2E0512)",
      // share to chat: posts an address card (token, network, address, QR) into the picked chat
      addrShort: addr.slice(0, 10) + "\u2026" + addr.slice(-8),
      shareOpen: s.share, openShare: () => this.setState({ share: true, q: "" }), closeShare: () => this.setState({ share: false }),
      shareChats: CHATS,
      shareItem: { title: "My " + tok.symbol + " address · " + net.label, sub: addr.slice(0, 10) + "\u2026" + addr.slice(-8), mark: tok.mark, grad: tok.grad },
      onShareSend: v => { const id = Date.now(); this.setState({ share: false, toast: { id, message: "Address shared to " + v.chat } }); clearTimeout(this._t3); this._t3 = setTimeout(() => this.setState(st => st.toast && st.toast.id === id ? { toast: null } : null), 5000); if (p.onShare) p.onShare({ chat: v.chat, message: v.message, symbol: tok.symbol, network: net.label, address: addr }); },
      hasToast: !!s.toast, toastKey: s.toast ? String(s.toast.id) : "", toastMessage: s.toast ? s.toast.message : "",
      dismissToast: () => this.setState({ toast: null }),
      copy: () => { try { navigator.clipboard && navigator.clipboard.writeText(addr); } catch (e) {} this._flash("copied", "_t1"); },
      handle: p.handle ?? "@you",
      hCopied: s.hCopied, hMask: s.hCopied ? M.check : M.copy,
      hBg: s.hCopied ? "rgba(46,230,168,.14)" : "var(--overlay-2,rgba(255,255,255,.07))", hInk: s.hCopied ? "var(--status-online,#2EE6A8)" : "var(--ink,#ECECF1)",
      copyHandle: () => this._flash("hCopied", "_t2"),
      back: () => { if (p.onClose) p.onClose(); },
    };
  }
}

export default Component;

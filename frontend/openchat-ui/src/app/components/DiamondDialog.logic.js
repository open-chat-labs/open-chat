// Logic for DiamondDialog.svelte — carried over from lib/DiamondDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  close: "var(--icon-close) center/contain no-repeat",
  back: "var(--icon-back) center/contain no-repeat",
  chev: "var(--icon-chevron-right) center/contain no-repeat",
  down: "var(--icon-chevron-down) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
  copy: "var(--icon-copy) center/contain no-repeat",
  alert: "var(--icon-warning) center/contain no-repeat",
  qr: "var(--icon-qr) center/contain no-repeat",
  refresh: "var(--icon-refresh) center/contain no-repeat",
  gem: "var(--icon-gem) center/contain no-repeat",
  spin: "var(--icon-spin) center/contain no-repeat",
  msg: "var(--icon-chat) center/contain no-repeat",
  gif: "var(--icon-gif) center/contain no-repeat",
  react: "var(--icon-emoji) center/contain no-repeat",
  poll: "var(--icon-poll) center/contain no-repeat",
  clock: "var(--icon-clock) center/contain no-repeat",
  coin: "var(--icon-coin) center/contain no-repeat",
  video: "var(--icon-video) center/contain no-repeat",
  bell: "var(--icon-bell) center/contain no-repeat",
  image: "var(--icon-image) center/contain no-repeat",
  disk: "var(--icon-disk) center/contain no-repeat",
  community: "var(--icon-community) center/contain no-repeat",
  dm: "var(--icon-dm) center/contain no-repeat",
  lock: "var(--icon-lock) center/contain no-repeat",
  globe: "var(--icon-globe) center/contain no-repeat",
  gate: "var(--icon-gate) center/contain no-repeat",
  lang: "var(--icon-lang) center/contain no-repeat",
  swap: "var(--icon-swap) center/contain no-repeat",
  party: "var(--icon-party) center/contain no-repeat",
};
// [label, icon, free (true | false | text), diamond (true | text)]
const GROUPS = [
  { label: "MESSAGING", rows: [
    ["Text messages", M.msg, true, true], ["GIFs", M.gif, true, true], ["Reactions", M.react, true, true],
    ["Polls", M.poll, true, true], ["Reminders", M.clock, true, true], ["Send crypto", M.coin, true, true],
    ["Video calls", M.video, false, true], ["Translations", M.lang, false, true],
    ["Notifications", M.bell, "Mobile & desktop", "Mobile & desktop"],
  ] },
  { label: "MEDIA & STORAGE", rows: [
    ["Media messages", M.image, "1 MB / 5 MB", "5 MB / 50 MB"], ["Storage", M.disk, "100 MB rolling", "1 GB rolling"],
  ] },
  { label: "GROUPS & COMMUNITIES", rows: [
    ["Direct chats", M.dm, true, true], ["Private groups", M.lock, "5", "25"], ["Public groups", M.globe, false, "10"],
    ["Gated groups", M.gate, false, true], ["Create communities", M.community, false, true],
  ] },
  { label: "EXTRAS", rows: [
    ["P2P swaps", M.swap, false, true], ["Diamond badge", M.gem, false, true], ["Airdrops & rewards", M.party, false, "Eligible"],
  ] },
];
// placeholder prices until the backend supplies them
const PLANS = [
  { key: "1m", months: 1, price: 2, label: "One month", ext: "1 month extension", noun: "one month", btn: "1 month" },
  { key: "3m", months: 3, price: 5, label: "Three months", ext: "3 month extension", noun: "three months", btn: "3 month" },
  { key: "1y", months: 12, price: 15, label: "One year", ext: "1 year extension", noun: "one year", btn: "1 year" },
  { key: "life", months: 0, price: 60, label: "Lifetime", ext: "Lifetime", noun: "lifetime", btn: "lifetime" },
];
// held wallet tokens (mirrors SwapDialog); prices are CHAT-denominated and converted at USD rates
let TOKENS = [];
const ADDRESS = "2vxsx-fae3q-kzn7w-ot4qa-cai";
const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";
const DAY = 86400000;
const fmtDate = d => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const fmtNum = n => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dp = n => n >= 1 ? 2 : n >= 0.01 ? 4 : n >= 0.0001 ? 6 : 8;
const fmtAmt = n => Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: n >= 1 ? 2 : 0, maximumFractionDigits: dp(n) });

class Component extends DCLogic {
  state = { closing: false, onlyDiff: false, step: "compare", plan: null, autoRenew: true, busy: false, refreshing: false, topUp: false, copied: false, bought: null, spent: {}, token: "CHAT", picker: false };
  componentDidMount() {
    if (this.props.plan) this.setState({ step: "plans", plan: this.props.plan });
    this._onKey = e => {
      if ((e.key === "Enter" || e.key === " ") && e.target && e.target.getAttribute && e.target.getAttribute("role") === "button") { e.preventDefault(); e.target.click(); return; }
      if (e.key === "Escape" && !this.state.busy) this._close(this.props.onClose);
    };
    window.addEventListener("keydown", this._onKey);
  }
  componentWillUnmount() { window.removeEventListener("keydown", this._onKey); [this._t, this._u, this._r, this._c].forEach(clearTimeout); }
  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { if (fn) fn(); }, 170);
  }
  _expiry() {
    const b = this.state.bought;
    if (b && b.until) return new Date(b.until);
    if (this.props.memberUntil) { const d = new Date(this.props.memberUntil); if (!isNaN(d)) return d; }
    return new Date(Date.now() + 10 * DAY);
  }
  renderVals() {
    TOKENS = (this.props.tokens || []).filter(t => t.payable).map(t => ({ symbol: t.symbol, name: t.name, mark: t.mark, usd: t.price, held: t.symbol === "CHAT" ? null : t.held, grad: t.grad })).sort((x, y) => (y.symbol === "CHAT") - (x.symbol === "CHAT"));
    const p = this.props, st = this.state;
    const member = !!p.isDiamond || !!st.bought;
    const lifetime = st.bought ? st.bought.lifetime : !!p.lifetime;
    const step = st.step, extend = member && !lifetime;
    const held = t => Math.max(0, (t.held ?? p.balance ?? 60501) - (st.spent[t.symbol] || 0));
    const tok = TOKENS.find(t => t.symbol === st.token) || TOKENS[0];
    const balance = held(tok), sym = tok.symbol;
    const chatUsd = (TOKENS[0] || { usd: 0.152 }).usd;
    const cost = pl => !tok || tok.symbol === "CHAT" ? pl.price : +(pl.price * chatUsd / tok.usd).toPrecision(3);
    const fmtChat = n => fmtAmt(n) + " " + sym;
    const expiry = this._expiry();
    const base = extend ? expiry : new Date();
    const plan = PLANS.find(x => x.key === st.plan) || PLANS[0];
    const until = pl => pl.months ? addMonths(base, pl.months) : null;

    const onlyDiff = st.onlyDiff;
    const groups = GROUPS.map(g => ({ label: g.label, rows: g.rows.filter(r => !onlyDiff || r[2] !== r[3]) }))
      .filter(g => g.rows.length)
      .map((g, gi) => ({
        label: g.label, divider: gi ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "none",
        rows: g.rows.map(([label, mask, free, pro]) => ({
          label, mask, free, pro,
          freeCheck: free === true, freeNone: free === false, freeText: typeof free === "string",
          proCheck: pro === true, proText: typeof pro === "string",
        })),
      }));
    const filter = (label, v) => ({ label, bg: onlyDiff === v ? "var(--overlay-2,rgba(255,255,255,.1))" : "transparent", ink: onlyDiff === v ? "var(--ink,#ECECF1)" : "var(--ink-3,#8A8A99)", pick: () => this.setState({ onlyDiff: v }) });

    const plans = PLANS.map(pl => {
      const c = cost(pl), ok = balance >= c, life = !pl.months, u = until(pl);
      return {
        label: extend ? pl.ext : pl.label, price: fmtChat(c),
        sub: !ok ? "Need " + fmtChat(+(c - balance).toPrecision(4)) + " more" : life ? (extend ? "Upgrade to lifetime membership" : "Never expires") : (extend ? "Extend to " : "Until ") + fmtDate(u),
        bg: life ? "color-mix(in oklch,var(--accent,#FF5672) 12%,transparent)" : "var(--overlay-1,rgba(255,255,255,.05))",
        ring: life ? "inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 40%,transparent)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))",
        ink: life ? "var(--accent,#FF5672)" : "var(--ink,#ECECF1)",
        subInk: ok ? "var(--ink-3,#8A8A99)" : "var(--status-warning,#FFB03D)",
        opacity: ok ? 1 : 0.5, cursor: ok ? "pointer" : "default", hover: ok ? "brightness(1.15)" : "none", tab: ok ? 0 : -1,
        pick: () => { if (ok) this.setState({ step: "confirm", plan: pl.key, autoRenew: true }); },
      };
    });
    const isShort = balance < cost(PLANS[PLANS.length - 1]);
    const pc = cost(plan);

    const timed = !!plan.months, pu = until(plan);
    const cTitle = extend ? (timed ? "Extend Diamond by " + plan.noun : "Upgrade to lifetime Diamond") : timed ? "Get " + plan.noun + " of Diamond" : "Get lifetime Diamond";
    const cBody = !timed ? "Lifetime is our top membership level — every Diamond feature, now and in the future, with no renewals."
      : extend ? "Your membership moves from " + fmtDate(expiry) + " to " + fmtDate(pu) + "."
      : "Diamond starts today and runs until " + fmtDate(pu) + ".";
    const period = plan.months === 1 ? "month" : plan.months === 12 ? "year" : plan.months + " months";
    const summary = [
      { label: "Payment amount", value: fmtChat(pc), ink: "var(--accent,#FF5672)" },
      { label: "OC SNS treasury receives (100%)", value: fmtChat(pc), ink: "var(--ink,#ECECF1)" },
      { label: "Balance after payment", value: fmtChat(+(balance - pc).toFixed(dp(balance))), ink: "var(--ink,#ECECF1)" },
    ];

    const back = () => {
      if (st.busy) return;
      if (step === "confirm") this.setState({ step: "plans" });
      else if (step === "plans") this.setState({ step: "compare", topUp: false, picker: false });
      else this._close(p.onBack);
    };
    const daysLeft = Math.max(0, Math.ceil((expiry - Date.now()) / DAY));

    return { m: M,
      isCompare: step === "compare", isPlans: step === "plans", isConfirm: step === "confirm",
      hasBack: step !== "compare" || !!p.onBack, backLabel: step === "compare" ? (p.backLabel ?? "Back") : "Back", onBack: back,
      subtitle: step === "plans" ? (extend ? "Extend your membership" : "Choose a duration") : step === "confirm" ? "Confirm payment" : member ? "You’re a member" : "Free vs Diamond",
      heroTitle: member ? "Thanks for being a Diamond member" : "Do more with OpenChat",
      heroBody: member ? "Here’s everything your membership includes." : "More storage, bigger groups, video calls and translations — plus the Diamond badge next to your name.",
      highlights: [{ value: "10×", label: "storage (1 GB)" }, { value: "25", label: "private groups" }, { value: "10", label: "public groups" }],
      filters: [filter("Everything", false), filter("What’s different", true)],
      groups, showFilters: true, isMember: member, isFree: !member,
      footMember: step === "compare" && member, footFree: step === "compare" && !member,
      footPlans: step === "plans", footConfirm: step === "confirm",
      canExtend: extend,
      memberLine: lifetime ? "Lifetime Diamond member" : "Diamond until " + fmtDate(expiry),
      onUpgrade: () => this.setState({ step: "plans" }),
      onExtend: () => this.setState({ step: "plans" }),

      isExtend: extend, daysLeft: daysLeft === 1 ? "1 day" : daysLeft + " days", expiryText: fmtDate(expiry),
      balanceText: fmtAmt(+balance.toFixed(dp(balance))), isShort, noneAffordable: balance < cost(PLANS[0]), cheapest: fmtChat(cost(PLANS[0])),
      tok, pickerOpen: st.picker, pickerRot: st.picker ? "rotate(180deg)" : "none",
      pickerBg: st.picker ? "var(--overlay-2,rgba(255,255,255,.09))" : "var(--overlay-1,rgba(255,255,255,.05))",
      onPickToken: () => this.setState(x => ({ picker: !x.picker })),
      tokenList: TOKENS.filter(t => held(t) > 0 || t.symbol === "CHAT").map(t => ({
        symbol: t.symbol, name: t.name, mark: t.mark, grad: t.grad, held: fmtAmt(+held(t).toFixed(dp(held(t)))),
        bg: t.symbol === sym ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent", checkOpacity: t.symbol === sym ? 1 : 0,
        pick: () => this.setState({ token: t.symbol, picker: false, topUp: false }),
      })),
      plansLabel: extend ? "AVAILABLE OPTIONS" : "MEMBERSHIP DURATION", plans,
      topUpOpen: st.topUp, topUpBg: st.topUp ? "var(--overlay-2,rgba(255,255,255,.09))" : "var(--overlay-1,rgba(255,255,255,.05))",
      onTopUp: () => this.setState(x => ({ topUp: !x.topUp })),
      address: ADDRESS, copyLabel: st.copied ? "Copied" : "Copy", copyMask: st.copied ? M.check : M.copy,
      onCopy: () => { try { navigator.clipboard.writeText(ADDRESS); } catch (e) {} this.setState({ copied: true }); clearTimeout(this._c); this._c = setTimeout(() => this.setState({ copied: false }), 1600); },
      refreshLabel: st.refreshing ? "Refreshing…" : "Refresh " + sym + " balance", refreshSpin: st.refreshing ? "oc-spin .8s linear infinite" : "none",
      onRefresh: () => { if (st.refreshing) return; this.setState({ refreshing: true }); this._r = setTimeout(() => this.setState({ refreshing: false }), 900); },

      cTitle, cBody, cTimed: timed, summary,
      autoRenew: st.autoRenew, setAutoRenew: v => this.setState({ autoRenew: typeof v === "boolean" ? v : !st.autoRenew }),
      showLossWarn: timed && !st.autoRenew,
      renewHelp: st.autoRenew ? "Renews every " + period + " from your " + sym + " balance. @OpenChatBot reminds you before each renewal." : "You’ll return to the free plan when this membership ends.",
      payLabel: st.busy ? "Processing payment…" : extend ? (timed ? "Confirm " + plan.btn + " extension" : "Confirm lifetime membership") : "Confirm " + plan.btn + " membership",
      payMask: st.busy ? M.spin : M.gem, paySpin: st.busy ? "oc-spin .8s linear infinite" : "none",
      cursor: st.busy ? "default" : "pointer", laterOpacity: st.busy ? 0.5 : 1,
      onPay: () => {
        if (st.busy) return;
        this.setState({ busy: true });
        this._u = setTimeout(() => {
          const bought = { lifetime: !timed, until: timed ? pu.toISOString() : null, autoRenew: timed && st.autoRenew, plan: plan.key, token: sym, amount: pc };
          this.setState(x => ({ busy: false, step: "compare", bought, spent: { ...x.spent, [sym]: (x.spent[sym] || 0) + pc } }));
          if (p.onUpgrade) p.onUpgrade(bought);
        }, 1200);
      },
      onClose: () => { if (!st.busy) this._close(p.onClose); },
      veilAnim: st.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: st.closing ? OUT_CARD : IN_CARD,
    };
  }
}

export default Component;

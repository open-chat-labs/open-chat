// Logic for JoinGateDialog.svelte — carried over from lib/JoinGateDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Join dialog for a gated community. Gates are a checklist; "all" shows progress, "any" turns rows into choices.
// Free checks (balance, neuron, Diamond) are resolved first; payments are charged together on "Pay and join".
// Diamond is bought in the Diamond dialog (onGetDiamond) and never appears in this payment summary.
const ADDRESS = "wq4pz-ixa3f-ubm7c-2jtw4-7d41e-cai";
const fmt = (n, dp) => Number(n).toLocaleString("en-US", { maximumFractionDigits: dp ?? 4 });
const CHIP = {
  met: { chip: "Met", mask: "check", bg: "color-mix(in oklch,var(--status-online,#2EE6A8) 14%,transparent)", ink: "var(--status-online,#2EE6A8)" },
  pay: { chip: "Paid on join", mask: "wallet", bg: "var(--overlay-2,rgba(255,255,255,.08))", ink: "var(--ink-2,#C9C9D4)" },
  todo: { chip: "Needs you", bg: "color-mix(in oklch,var(--status-warning,#FFB03D) 14%,transparent)", ink: "var(--status-warning,#FFB03D)" },
  short: { bg: "color-mix(in oklch,var(--status-warning,#FFB03D) 14%,transparent)", ink: "var(--status-warning,#FFB03D)" },
  skip: { chip: "Not needed", bg: "transparent", ink: "var(--ink-4,#8A8A99)" },
};
class Component extends DCLogic {
  state = { confirmed: false, sel: null, busy: false, copied: false, checking: false };
  componentDidMount() {
    this._vis = () => { if (document.visibilityState === "visible") this.forceUpdate(); };
    document.addEventListener("visibilitychange", this._vis);
    this._key = e => { if (e.key === "Escape" && !this.state.busy && this.props.onClose) this.props.onClose(); };
    window.addEventListener("keydown", this._key);
  }
  componentWillUnmount() { document.removeEventListener("visibilitychange", this._vis); window.removeEventListener("keydown", this._key); [this._j, this._c, this._r].forEach(clearTimeout); }
  _held(sym) {
    if (sym === "CHAT" && this.props.chatBalance != null) return this.props.chatBalance;
    const t = (this.props.tokens || []).find(x => x.symbol === sym);
    return t ? t.held : 0;
  }
  _token(sym) { return (this.props.tokens || []).find(x => x.symbol === sym) || { symbol: sym, mark: sym[0], grad: "linear-gradient(140deg,#2EE6A8,#1FB6FF)" }; }
  renderVals() {
    const p = this.props, st = this.state;
    const c = p.community || {};
    const any = p.rule === "any";
    const gates = (p.gates || []).map(g => {
      if (g.kind === "pay" || g.kind === "balance") {
        const held = this._held(g.symbol), tk = this._token(g.symbol), ok = held >= g.amount;
        const pay = g.kind === "pay";
        return Object.assign({}, g, { isToken: true, symbol: g.symbol, mark: tk.mark, grad: tk.grad,
          title: (pay ? "Pay " : "Hold ") + fmt(g.amount) + " " + g.symbol, detail: "You have " + fmt(held, 2) + " " + g.symbol,
          state: ok ? (pay ? "pay" : "met") : "short", short: ok ? 0 : g.amount - held, free: !pay });
      }
      if (g.kind === "neuron") return Object.assign({}, g, { isIcon: true, icon: "neuron", ink: "var(--accent-bright,#FF8298)", title: g.label || "Neuron holder", detail: st.confirmed ? "Confirmed by you" : g.detail, state: st.confirmed ? "met" : "todo", free: true });
      return Object.assign({}, g, { isIcon: true, icon: "diamond", ink: "var(--status-chit,#FF9F45)", title: "Lifetime Diamond member", detail: p.isLifetime ? "You're a lifetime member" : p.isDiamond ? "You have Diamond, but not lifetime" : "You're not a member yet", state: p.isLifetime ? "met" : "todo", free: true });
    });
    const ready = g => g.state === "met" || g.state === "pay";
    const freeMet = gates.findIndex(g => g.free && g.state === "met");
    let sel = st.sel;
    if (any && sel == null) { sel = freeMet >= 0 ? freeMet : gates.findIndex(ready); if (sel < 0) sel = 0; }
    const chosen = any ? [gates[sel]].filter(Boolean) : gates;
    const pays = chosen.filter(g => g.kind === "pay" && g.state === "pay");
    const nReady = gates.filter(ready).length, left = gates.length - nReady;
    const canJoin = chosen.length > 0 && chosen.every(ready);
    const owner = p.ownerShare ?? 0.98;
    const payTotal = pays.map(g => fmt(g.amount) + " " + g.symbol).join(" + ");
    const sym = pays.map(g => g.symbol);
    const split = pays.length ? [
      { label: "Community owner · " + Math.round(owner * 100) + "%", value: pays.map(g => fmt(g.amount * owner) + " " + g.symbol).join(" · ") },
      { label: "OpenChat treasury · " + Math.round((1 - owner) * 100) + "%", value: pays.map(g => fmt(g.amount * (1 - owner)) + " " + g.symbol).join(" · ") },
    ] : [];
    const selGate = any ? gates[sel] : null;
    let reason;
    if (canJoin) reason = any ? (selGate && selGate.free ? "Free with " + (selGate.kind === "diamond" ? "your Diamond membership" : "this requirement") : "Paying is your way in") : "All " + gates.length + " requirements ready";
    else if (any) reason = selGate && selGate.state === "short" ? "Not enough " + selGate.symbol + " for this way in" : "Finish this requirement to join";
    else reason = left + (left === 1 ? " requirement left" : " requirements left");
    const busy = !!st.busy, enabled = canJoin && !busy;
    const pick = i => () => { if (any && !busy) this.setState({ sel: i }); };
    return {
      title: "Join community", name: c.name || "", grad: c.grad || "var(--overlay-2)", z: p.z ?? 70,
      meta: "Community · " + (c.members != null ? Number(c.members).toLocaleString("en-US") + " members" : ""),
      rule: any ? "Any one of " + gates.length : "All " + gates.length + " required",
      ruleBg: any ? "color-mix(in oklch,var(--status-verified,#3D9BFF) 15%,transparent)" : "var(--accent-soft,rgba(255,86,114,.14))",
      ruleInk: any ? "var(--status-verified,#3D9BFF)" : "var(--accent-bright,#FF8298)",
      intro: any ? "Meet any one of these to join. Pick the one that suits you." : "Meet every requirement to join." + (p.recheckDays ? " Re-checked every " + p.recheckDays + " days." : ""),
      showBar: !any, barLabel: nReady + " of " + gates.length + " ready",
      bar: gates.map((g, i) => ({ bg: i < nReady ? "var(--status-online,#2EE6A8)" : "var(--overlay-2,rgba(255,255,255,.1))" })),
      listRole: any ? "radiogroup" : "list",
      rows: gates.map((g, i) => {
        const isSel = any && i === sel, k = CHIP[(any && !isSel && freeMet >= 0 && g.kind === "pay") ? "skip" : g.state];
        const active = !any || isSel;
        return Object.assign({}, g, {
          isAny: any, isToken: !!g.isToken, isIcon: !!g.isIcon,
          iconMask: "var(--icon-" + g.icon + ") center/contain no-repeat", iconInk: g.ink,
          role: any ? "radio" : "listitem", ariaChecked: any ? String(isSel) : undefined, tab: any ? "0" : undefined, cursor: any ? "pointer" : "default", select: any ? pick(i) : undefined,
          chip: k.chip || fmt(g.short, 2) + " short", chipBg: k.bg, chipInk: k.ink, chipIconShow: k.mask ? "block" : "none", chipMask: k.mask ? "var(--icon-" + k.mask + ") center/contain no-repeat" : "none",
          detail: (any && !isSel && freeMet >= 0 && g.kind === "pay") ? "Not needed, you already qualify" : g.detail,
          detailInk: g.state === "short" ? "var(--status-warning,#FFB03D)" : "var(--ink-4,#8A8A99)",
          ring: isSel ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : "none",
          op: any && !isSel && freeMet >= 0 && g.kind === "pay" ? ".6" : "1",
          radioRing: isSel ? "inset 0 0 0 2px var(--accent,#FF5672)" : "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.3))",
          radioDot: isSel ? "var(--accent,#FF5672)" : "transparent",
          showBalance: active && g.state === "short",
          topUp: g.kind === "pay" ? "Add " + fmt(g.short, 2) + " " + g.symbol + " to this wallet to cover the fee." : "Top up " + fmt(g.short, 2) + " " + g.symbol + " to this wallet. Nothing is charged; we only check the balance.",
          showNeuron: active && g.kind === "neuron" && g.state === "todo",
          confirmText: g.confirm || "I hold a qualifying neuron.",
          showDiamond: active && g.kind === "diamond" && g.state === "todo",
        });
      }),
      address: ADDRESS,
      copyIcon: st.copied ? "check" : "copy", copyLabel: st.copied ? "Copied" : "Copy wallet address",
      copy: e => { if (e && e.stopPropagation) e.stopPropagation(); try { navigator.clipboard && navigator.clipboard.writeText(ADDRESS); } catch (x) {} this.setState({ copied: true }); clearTimeout(this._c); this._c = setTimeout(() => this.setState({ copied: false }), 1600); },
      recheck: e => { if (e && e.stopPropagation) e.stopPropagation(); this.setState({ checking: true }); clearTimeout(this._r); this._r = setTimeout(() => this.setState({ checking: false }), 700); },
      recheckLabel: st.checking ? "Checking…" : "Check again", spin: st.checking ? "rotate(-360deg)" : "none",
      confirmed: st.confirmed, toggleConfirm: v => this.setState(s => ({ confirmed: typeof v === "boolean" ? v : !s.confirmed })),
      getDiamond: e => { if (e && e.stopPropagation) e.stopPropagation(); if (p.onGetDiamond) p.onGetDiamond(); },
      hasPay: pays.length > 0, payTotal, split,
      reason, reasonInk: canJoin ? (any && selGate && selGate.free ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#9A9AA8)") : "var(--status-warning,#FFB03D)",
      cta: pays.length ? "Pay and join" : "Join community", busy, idle: !busy,
      ctaTab: enabled ? "0" : "-1", ctaAriaDisabled: String(!canJoin),
      ctaBg: canJoin ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.08))",
      ctaInk: canJoin ? "var(--on-accent,#2E0512)" : "var(--ink-4,#8A8A99)",
      ctaCursor: enabled ? "pointer" : busy ? "progress" : "not-allowed", ctaHover: enabled ? "brightness(1.08)" : "none",
      join: () => { if (!enabled) return; this.setState({ busy: true }); this._j = setTimeout(() => { if (p.onJoin) p.onJoin({ paid: pays.map(g => ({ symbol: g.symbol, amount: g.amount })) }); }, 1300); },
      close: () => { if (!busy && p.onClose) p.onClose(); },
    };
  }
}

export default Component;

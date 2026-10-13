// Logic for WalletPanel.svelte — carried over from lib/WalletPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const EYE_OFF = "var(--icon-eye-off) center/contain no-repeat";
const CYCLE = "var(--icon-refresh) center/contain no-repeat";
const KEBAB = "var(--icon-kebab) center/contain no-repeat";
const CHEVRON = "var(--icon-chevron-down) center/contain no-repeat";
const RECEIVE = "var(--icon-receive) center/contain no-repeat";
const SEND = "var(--icon-wallet-send) center/contain no-repeat";
const SWAP = "var(--icon-swap) center/contain no-repeat";
const GEAR = "var(--icon-gear) center/contain no-repeat";
const USERS = "var(--icon-users) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const UNDO_MS = 6000;
const ASC = "var(--icon-arrow-up) center/contain no-repeat";
const DESC = "var(--icon-arrow-down) center/contain no-repeat";

const G = {
  btc: "linear-gradient(140deg,#F7A63B,#F7931A)",
  chat: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  eth: "linear-gradient(140deg,#B6C2F2,#7A8CE0)",
  icp: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  usdt: "linear-gradient(140deg,#4BD6A8,#1E9E7E)",
  xrp: "linear-gradient(140deg,#C9CFDA,#7A8492)",
  other: "transparent",
};

// price and holdings are the only figures entered; totals and shares derive from them
let TOKENS = [];

const CURRENCIES = ["USD", "BTC", "ETH", "ICP"];
const RATES = { USD: 1, BTC: 103819.98, ETH: 2622.86, ICP: 5.481 };
const PREFIX = { USD: "$", BTC: "\u20BF", ETH: "\u039E", ICP: "" };

const num = (v, dp) => v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
// under a dollar keeps four places; single and double digits keep up to four,
// trimmed — so ICP reads $5.481 rather than $5.48
const price = v => {
  if (v >= 100) return "$" + num(v, 2);
  if (v < 1) return "$" + num(v, 4);
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
};

class Component extends DCLogic {
  _awayRef = React.createRef();
  componentDidMount() {
    this._awayFn = e => { const el = this._awayRef.current; if (el && !el.contains(e.target) && this.state.menu) this.setState({ menu: null }); };
    document.addEventListener("pointerdown", this._awayFn, true);
  }
  state = { localCurrency: null, hidden: [], balanceHidden: false, menu: null, spinning: false, undo: null };

  componentWillUnmount() {
    document.removeEventListener("pointerdown", this._awayFn, true); clearTimeout(this._t); clearTimeout(this._undoT); }

  renderVals() { const __v = this._vals(); __v.loading = !!this.props.loading; __v.loadedOr = { tokens: __v.loading ? [] : __v.tokens }; return __v; }
  _vals() {
    TOKENS = (this.props.tokens || []).filter(t => t.held > 0).map(t => Object.assign({ gradient: t.grad }, t));
    // display currency lives in wallet settings when a host owns them
    const settings = this.props.settings ?? {};
    const currency = this.state.localCurrency ?? settings.currency ?? "USD";
    const rate = RATES[currency];
    // a host can own the hidden list (so other surfaces can hide tokens too); otherwise keep it local
    const hidden = this.props.hidden ?? this.state.hidden;
    const setHidden = next => {
      if (this.props.onHiddenChange) this.props.onHiddenChange(next);
      else this.setState({ hidden: next });
    };
    const dots = "••••";

    const money = v => {
      const c = v / rate;
      if (currency === "USD") return "$" + num(c, 2);
      return PREFIX[currency] + num(c, c < 1 ? 4 : 2) + (currency === "ICP" ? " ICP" : "");
    };

    // a host that owns wallet settings also owns the undo window, so the banner
    // can outlive a dialog that closes on removal
    const removeToken = symbol => {
      if (this.props.onRemoveToken) { this.props.onRemoveToken(symbol); return; }
      const snap = { symbol, hidden };
      setHidden(hidden.concat([symbol]));
      clearTimeout(this._undoT);
      this.setState({ undo: snap });
      this._undoT = setTimeout(() => this.setState({ undo: null }), UNDO_MS);
    };
    const undoSymbol = this.props.undoSymbol || (this.state.undo ? this.state.undo.symbol : "");

    const veiled = this.props.balanceHidden ?? this.state.balanceHidden;
    // wallet settings decide which tokens exist here at all: either a minimum
    // dollar value (automatic) or an explicit list (manual)
    const cfg = settings;
    const floor = cfg.autoConfig === false ? 0 : parseFloat(cfg.minBalance || "0") || 0;
    const manual = cfg.autoConfig === false;
    const allow = manual && cfg.tokens ? cfg.tokens : null;
    const held = TOKENS
      .filter(t => hidden.indexOf(t.symbol) === -1)
      .filter(t => (allow ? allow.indexOf(t.symbol) > -1 : t.price * t.held >= floor))
      .map(t => Object.assign({}, t, { value: t.price * t.held }));
    const total = held.reduce((sum, t) => sum + t.value, 0);
    const sort = this.state.sort ?? "value";
    // direction is its own control: it sticks when the sort key changes
    const dir = this.state.dir ?? "desc";
    const flip = dir === "asc" ? 1 : -1;
    const valued = held.slice().sort((x, y) => flip * (sort === "name"
      ? x.symbol.localeCompare(y.symbol)
      : x.value - y.value));

    // four largest holdings get their own segment, everything else pools into one;
    // segments run largest first so the bar reads as a ranking, with the pool last
    const byValue = held.slice().sort((x, y) => y.value - x.value);
    const lead = byValue.slice(0, 4);
    const rest = byValue.slice(4);
    const buckets = rest.length === 0
      ? lead
      : lead.concat(rest.length === 1
          ? [rest[0]]
          : [{ symbol: "Other", gradient: G.other, value: rest.reduce((sum, t) => sum + t.value, 0), count: rest.length }]);

    // right-click → at the cursor; kebab/currency button → under the trigger; long-press → anchored to the row at the finger
    const openMenu = (items, e, key, anchorOverride) => {
      const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
      const ctx = e && e.type === "contextmenu" && !this._touch;
      this.setState({ menu: { items, key: key || null,
        point: ctx ? { x: e.clientX, y: e.clientY } : null,
        anchor: ctx ? null : anchorOverride || (e && e.currentTarget ? rect(e.currentTarget) : null),
        align: anchorOverride ? "start" : "end" } });
    };
    const close = () => this.setState({ menu: null });
    const act = kind => () => { if (this.props.onAction) this.props.onAction(kind); };

    return {
      awayRef: this._awayRef,
      // workspace mode: the main column has a home ("All activity") and selection
      hasHome: !!this.props.onHome,
      homeOn: !!this.props.homeSelected,
      homeBg: this.props.homeSelected ? "var(--overlay-2,rgba(255,255,255,.07))" : "transparent",
      homeCount: this.props.homeCount != null ? String(this.props.homeCount) : "",
      onHome: () => { if (this.props.onHome) this.props.onHome(); },
      listMask: "var(--icon-list) center/contain no-repeat",
      currency,
      chevronMask: CHEVRON,
      kebabMask: KEBAB,
      receiveMask: RECEIVE,
      sendMask: SEND,
      swapMask: SWAP,
      totalLabel: money(total),
      veiled,
      tokensHeading: "TOKENS \u00B7 " + valued.length,
      sortLabel: sort === "name" ? "Name" : "Value",
      sortTitle: sort === "name" ? "Sorted by name" : "Sorted by value",
      onToggleSort: () => this.setState({ sort: sort === "name" ? "value" : "name" }),
      dirMask: dir === "asc" ? ASC : DESC,
      dirTitle: sort === "name"
        ? (dir === "asc" ? "A to Z" : "Z to A")
        : (dir === "asc" ? "Smallest first" : "Largest first"),
      onToggleDir: () => this.setState({ dir: dir === "asc" ? "desc" : "asc" }),
      spinning: !!this.state.spinning,
      onToggleHidden: () => {
        // a host can own the veil so the wallet and the token dialog hide together
        const host = this.props.onBalanceHiddenChange;
        if (host) host(!veiled); else this.setState({ balanceHidden: !veiled });
      },
      onRefreshAll: () => {
        this.setState({ spinning: true });
        this._t = setTimeout(() => this.setState({ spinning: false }), 720);
      },
      // the pooled remainder reads as an outline so it cannot be mistaken for a token
      allocation: buckets.length > 1 ? buckets.map(t => ({
        gradient: t.gradient,
        share: t.value / total,
        ring: t.gradient === G.other ? "inset 0 0 0 1px var(--line-3,rgba(255,255,255,.24))" : "none",
        tipLabel: t.count ? t.count + " smaller holdings" : t.symbol,
        tipValue: veiled ? dots : money(t.value) + " · " + Math.round(t.value / total * 100) + "%",
      })) : [],
      onReceive: act("receive"),
      onSend: act("send"),
      onSwap: act("swap"),
      tokens: valued.map(t => { const tokItems = () => [
            { label: "Send " + t.symbol, mask: SEND, onSelect: () => { if (this.props.onAction) this.props.onAction("send:" + t.symbol); } },
            { label: "Receive " + t.symbol, mask: RECEIVE, onSelect: () => { if (this.props.onAction) this.props.onAction("receive:" + t.symbol); } },
            { label: "Swap " + t.symbol, mask: SWAP, onSelect: () => { if (this.props.onAction) this.props.onAction("swap:" + t.symbol); } },
            { label: "Refresh balance", mask: CYCLE },
          ].concat(manual ? [
            { label: "Hide from list", mask: EYE_OFF, onSelect: () => { this.setState({ menu: null }); removeToken(t.symbol); } },
          ] : []); return ({
        symbol: t.symbol,
        mark: t.mark,
        gradient: t.gradient,
        price: price(t.price),
        value: veiled ? dots : money(t.value),
        holdings: veiled ? dots : num(t.held, t.held < 1 ? 4 : (t.held % 1 === 0 ? 0 : 2)),
        onPress: () => { if (this._lpFired) { this._lpFired = false; return; } if (this.props.onToken) this.props.onToken(t.symbol); },
        // hidden balances: equal bars so the lengths don't leak relative holdings
        share: veiled ? "33%" : Math.max(2, Math.round(t.value / total * 1000) / 10) + "%",
        shareNum: t.value / total * 100, veiled,
        bg: this.props.selectedToken === t.symbol ? "var(--overlay-2,rgba(255,255,255,.07))" : "transparent",
        onMenu: e => {
          if (e && e.stopPropagation) e.stopPropagation();
          if (e && e.preventDefault) e.preventDefault();
          if (this._touch) { const row = e.currentTarget.getBoundingClientRect(); if (!this.state.menu) { clearTimeout(this._lpT); this._lpFired = true; openMenu(tokItems(), e, t.symbol, { left: e.clientX, right: e.clientX, top: row.top, bottom: row.bottom }); } return; }
          openMenu(tokItems(), e, t.symbol);
        },
        onKebab: e => { e.stopPropagation(); if (this.state.menu && this.state.menu.key === t.symbol) return close(); openMenu(tokItems(), e, t.symbol); },
        onKey: e => { if (e.target !== e.currentTarget) return; if (e.key === "Enter") { if (this.props.onToken) this.props.onToken(t.symbol); } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); openMenu(tokItems(), e, t.symbol); } },
        onEnter: e => { if (e && e.pointerType === "touch") return; if (this.state.hoverTok !== t.symbol) this.setState({ hoverTok: t.symbol }); },
        onLeave: () => { if (this.state.hoverTok === t.symbol) this.setState({ hoverTok: null }); },
        onPDown: e => {
          this._touch = e.pointerType === "touch"; if (!this._touch) return;
          const x = e.clientX, y = e.clientY, row = e.currentTarget.getBoundingClientRect();
          this._lpStart = { x, y }; clearTimeout(this._lpT);
          this._lpT = setTimeout(() => { this._lpFired = true; openMenu(tokItems(), null, t.symbol, { left: x, right: x, top: row.top, bottom: row.bottom }); }, 500);
        },
        onPMove: e => { if (this._lpStart && Math.hypot(e.clientX - this._lpStart.x, e.clientY - this._lpStart.y) > 10) { clearTimeout(this._lpT); this._lpStart = null; } },
        onPUp: () => { clearTimeout(this._lpT); this._lpStart = null; },
        kebabVis: "visible",

      }); }),
      undoShown: !!undoSymbol,
      undoLabel: undoSymbol ? undoSymbol + " hidden from your list" : "",
      onUndoRemove: () => {
        if (this.props.onUndoRemove) { this.props.onUndoRemove(); return; }
        const snap = this.state.undo;
        clearTimeout(this._undoT);
        this.setState({ undo: null, hidden: snap ? snap.hidden : hidden });
      },
      onDismissUndo: () => {
        if (this.props.onDismissUndo) { this.props.onDismissUndo(); return; }
        clearTimeout(this._undoT);
        this.setState({ undo: null });
      },
      menuOpen: !!this.state.menu,
      menuItems: this.state.menu ? this.state.menu.items : [],
      menuPoint: this.state.menu ? this.state.menu.point : null,
      menuAnchor: this.state.menu ? this.state.menu.anchor : null,
      menuAlign: this.state.menu ? this.state.menu.align : "end",
      stopEv: e => e.stopPropagation(),
      onOpenCurrency: e => openMenu(CURRENCIES.map(c => ({
        label: c,
        checkMask: c === currency ? CHECK : null,
        onSelect: () => {
          const host = this.props.onSettingsChange;
          this.setState({ menu: null, localCurrency: host ? null : c });
          if (host) host(Object.assign({}, settings, { currency: c }));
        },
      })), e),
      onOpenMenu: e => openMenu([
        { label: "Settings", mask: GEAR, onSelect: () => { close(); if (this.props.onAction) this.props.onAction("settings"); } },
        { label: "Manage recipients", mask: USERS, onSelect: () => { close(); if (this.props.onAction) this.props.onAction("recipients"); } },
      ], e),
      onCloseMenu: close,
    };
  }
}

export default Component;

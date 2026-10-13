// Logic for WalletSettingsDialog.svelte — carried over from lib/WalletSettingsDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const CLOSE = "var(--icon-close) center/contain no-repeat";
const BACK = "var(--icon-back) center/contain no-repeat";
const FORWARD = "var(--icon-arrow) center/contain no-repeat";
const LOCK = "var(--icon-lock) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const CIRCLE = "var(--icon-circle) center/contain no-repeat";
const CHEVRON = "var(--icon-chevron-right) center/contain no-repeat";
const SEARCH = "var(--icon-search) center/contain no-repeat";
const COINS = "var(--icon-coins) center/contain no-repeat";
const CURRENCY = "var(--icon-currency) center/contain no-repeat";
const USERS = "var(--icon-users) center/contain no-repeat";
const PLUS = "var(--icon-plus) center/contain no-repeat";
const EDIT = "var(--icon-edit) center/contain no-repeat";
const TRASH = "var(--icon-trash) center/contain no-repeat";
const ALERT = "var(--icon-warning) center/contain no-repeat";

// which network an address belongs to, read off its own shape
const NETWORKS = [
  { id: "BTC", label: "BTC", test: a => /^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a) },
  { id: "ETH", label: "ETH", test: a => /^0x[0-9a-fA-F]{40}$/.test(a) },
  { id: "XRP", label: "XRP", test: a => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a) },
  { id: "ICP", label: "ICP", test: a => /^([a-z0-9]{5}-){4,10}[a-z0-9]{3}$/.test(a) || /^[0-9a-f]{64}$/.test(a) },
];

const detect = a => {
  const v = (a || "").trim();
  if (!v) return null;
  const hit = NETWORKS.filter(n => n.test(v))[0];
  return hit ? hit.id : "unknown";
};

const shortAddr = a => (a || "").length > 26 ? a.slice(0, 12) + "…" + a.slice(-8) : a;

const DEFAULT_RECIPIENTS = [
  { id: "r1", name: "Hot wallet", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", token: null },
  { id: "r2", name: "Ada — rent", address: "5sj6i-pqaaa-aaaaf-a3cmq-cai", token: "CHAT" },
  { id: "r3", name: "Ledger cold", address: "0x9f2Ac1bE44dD3a5B7C1e0f8D2a6C4e91B3F7a8D0", token: null },
  { id: "r4", name: "Payroll — USDT", address: "0x3aB5f1C2dE9a7b40F6c8E21d5A0b9C3e7D4f8A16", token: "USDT" },
];

const G = {
  BTC: "linear-gradient(140deg,#F7A63B,#F7931A)",
  CHAT: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  ETH: "linear-gradient(140deg,#B6C2F2,#7A8CE0)",
  ICP: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  USDT: "linear-gradient(140deg,#4BD6A8,#1E9E7E)",
  XRP: "linear-gradient(140deg,#C9CFDA,#7A8492)",
};

// values in USD, matching the wallet panel's holdings
let TOKENS = [];
const useTokens = p => { TOKENS = (p.tokens || []).filter(t => t.held > 0).map(t => ({ symbol: t.symbol, mark: t.mark, value: Math.round(t.price * t.held) })); };

const CURRENCIES = ["USD", "BTC", "ETH", "ICP"];
const CHIP_CAP = 10;

const money = v => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  state = {
    tab: null, closing: false,
    settings: null,
    listOpen: false, query: "",
    recipQuery: "", recipSheet: false, recipEditId: null, recipConfirmId: null,
    recipAddress: "", recipName: "", recipToken: null,
    pinOpen: false, pinMode: "change", pinStep: "set", pinValue: "", pinFirst: "", pinError: false, pinPending: false,
  };

  _pinRef = React.createRef();

  componentWillUnmount() { clearTimeout(this._t); }

  componentDidUpdate() {
    const el = this._pinRef.current;
    if (this.state.pinOpen && el && document.activeElement !== el) el.focus();
  }

  _settings() {
    useTokens(this.props);
    const v = this.props.value ?? {};
    return this.state.settings ?? {
      pinOn: v.pinOn ?? false,
      autoConfig: v.autoConfig ?? true,
      minBalance: v.minBalance ?? "",
      tokens: v.tokens ?? TOKENS.map(t => t.symbol),
      currency: v.currency ?? "USD",
      recipients: v.recipients ?? DEFAULT_RECIPIENTS,
    };
  }

  // apply-as-you-go: every change lands in the parent immediately
  _apply(patch) {
    const next = Object.assign({}, this._settings(), patch);
    this.setState({ settings: next });
    if (this.props.onChange) this.props.onChange(next);
  }

  _close() {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { if (this.props.onCancel) this.props.onCancel(); }, 170);
  }

  renderVals() {
    useTokens(this.props);
    const st = Object.assign({}, this.state, { tab: this.state.tab ?? this.props.section ?? "tokens" });
    const s = this._settings();
    const floor = parseFloat(s.minBalance || "0") || 0;
    const picked = s.tokens ?? [];
    const autoOn = s.autoConfig !== false;
    const shown = autoOn ? TOKENS.filter(t => t.value >= floor) : TOKENS.filter(t => picked.indexOf(t.symbol) > -1);
    const q = st.query.trim().toLowerCase();
    const filtered = q ? TOKENS.filter(t => t.symbol.toLowerCase().indexOf(q) > -1) : TOKENS;
    const pinConfirm = st.pinStep === "confirm";
    const pinReady = st.pinValue.length === 6;

    const nav = [
      { key: "tokens", label: "Tokens", mask: COINS },
      { key: "security", label: "Security", mask: LOCK },
      { key: "currency", label: "Display currency", mask: CURRENCY },
    ];

    const saved = s.recipients ?? [];
    const rq = st.recipQuery.trim().toLowerCase();
    const shownRecips = rq
      ? saved.filter(r => (r.name + " " + r.address).toLowerCase().indexOf(rq) > -1)
      : saved;

    const draftNet = detect(st.recipAddress);
    const draftAddr = st.recipAddress.trim();
    const dupe = saved.filter(r => r.address === draftAddr && r.id !== st.recipEditId)[0];
    const draftValid = !!draftNet && draftNet !== "unknown" && !dupe;

    return {
      closeMask: CLOSE, backMask: BACK, lockMask: LOCK, checkMask: CHECK,
      chevronMask: CHEVRON, searchMask: SEARCH,

      nav: nav.map(n => ({
        label: n.label,
        mask: n.mask,
        bg: st.tab === n.key ? "var(--overlay-2,rgba(255,255,255,.09))" : "transparent",
        ink: st.tab === n.key ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)",
        weight: st.tab === n.key ? "var(--weight-semibold)" : "var(--weight-medium)",
        onSelect: () => this.setState({ tab: n.key }),
      })),
      isTokens: st.tab === "tokens",
      isSecurity: st.tab === "security",
      isCurrency: st.tab === "currency",
      isRecipients: st.tab === "recipients",

      usersMask: USERS, plusMask: PLUS, editMask: EDIT, trashMask: TRASH,
      recipSearchable: saved.length > 5,
      recipQuery: st.recipQuery,
      onRecipQuery: e => this.setState({ recipQuery: e.target.value }),
      recipients: shownRecips.map(r => {
        const net = detect(r.address);
        const tok = r.token ? TOKENS.filter(t => t.symbol === r.token)[0] : null;
        return {
          name: r.name,
          badge: r.token ? r.token : (net === "unknown" ? "UNKNOWN" : net),
          short: shortAddr(r.address),
          gradient: tok ? G[tok.symbol] : "var(--overlay-2,rgba(255,255,255,.1))",
          mark: tok ? tok.mark : (r.name || "?").trim().charAt(0).toUpperCase(),
          markInk: tok ? "#0b0b0f" : "var(--ink-2,#C9C9D4)",
          idle: st.recipConfirmId !== r.id,
          confirming: st.recipConfirmId === r.id,
          onEdit: () => this.setState({
            recipSheet: true, recipEditId: r.id, recipConfirmId: null,
            recipAddress: r.address, recipName: r.name, recipToken: r.token ?? null,
          }),
          onAskRemove: () => this.setState({ recipConfirmId: r.id }),
          onCancelRemove: () => this.setState({ recipConfirmId: null }),
          onRemove: () => { this.setState({ recipConfirmId: null }); this._apply({ recipients: saved.filter(x => x.id !== r.id) }); },
        };
      }),
      recipEmpty: shownRecips.length === 0,
      recipEmptyLabel: saved.length === 0
        ? "No saved recipients yet. Add one and it will be offered whenever you send."
        : 'Nothing matches "' + st.recipQuery.trim() + '".',

      recipSheet: st.recipSheet,
      recipTitle: st.recipEditId ? "Edit recipient" : "Add a recipient",
      onAddRecipient: () => this.setState({
        recipSheet: true, recipEditId: null, recipConfirmId: null,
        recipAddress: "", recipName: "", recipToken: null,
      }),
      recipAddress: st.recipAddress,
      onRecipAddress: e => this.setState({ recipAddress: e.target.value }),
      recipAddrLine: draftAddr && !draftValid
        ? "var(--status-danger,#F5493D)"
        : (draftValid ? "var(--line-2,rgba(255,255,255,.14))" : "var(--line-1,rgba(255,255,255,.07))"),
      recipHasNote: !!draftAddr,
      recipNote: dupe
        ? "Already saved as \u201C" + dupe.name + "\u201D."
        : (draftNet === "unknown"
            ? "That is not an address we recognise — check for a missing character."
            : draftNet + " address detected"),
      recipNoteMask: draftValid ? CHECK : ALERT,
      recipNoteInk: draftValid ? "var(--status-online,#2EE6A8)" : "var(--status-danger,#F5493D)",
      recipNoteBg: draftValid ? "var(--category-b-soft,rgba(46,230,168,.12))" : "var(--status-danger-soft,rgba(245,73,61,.12))",
      recipName: st.recipName,
      onRecipName: e => this.setState({ recipName: e.target.value }),
      recipNamePlaceholder: draftValid ? draftNet + " recipient" : "Recipient's name or title",
      recipTokenChips: [{ symbol: null, label: "Any token", mark: "" }].concat(TOKENS.map(t => ({ symbol: t.symbol, label: t.symbol, mark: t.mark })))
        .map(c => {
          const on = st.recipToken === c.symbol;
          return {
            label: c.label,
            mark: c.mark,
            hasDot: !!c.symbol,
            gradient: c.symbol ? G[c.symbol] : "transparent",
            padding: c.symbol ? "0 var(--space-10) 0 4px" : "0 var(--space-12)",
            bg: on ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))",
            ring: on ? "inset 0 0 0 1px var(--accent,#FF5672)" : "none",
            ink: on ? "var(--accent,#FF5672)" : "var(--ink-2,#C9C9D4)",
            onSelect: () => this.setState({ recipToken: c.symbol }),
          };
        }),
      recipTokenHint: st.recipToken
        ? "Send screens will only offer " + st.recipToken + " for this recipient."
        : "Leave as Any token to send anything this network supports.",
      recipSaveLabel: st.recipEditId ? "Save changes" : "Save recipient",
      recipSaveBg: draftValid ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.09))",
      recipSaveInk: draftValid ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      recipSaveCursor: draftValid ? "pointer" : "not-allowed",
      onRecipCancel: () => this.setState({ recipSheet: false, recipEditId: null, recipAddress: "", recipName: "", recipToken: null }),
      onRecipSave: () => {
        if (!draftValid) return;
        const name = st.recipName.trim() || draftNet + " recipient";
        const entry = { id: st.recipEditId ?? "r" + Date.now(), name, address: draftAddr, token: st.recipToken };
        const next = st.recipEditId
          ? saved.map(r => (r.id === st.recipEditId ? entry : r))
          : saved.concat([entry]);
        this.setState({ recipSheet: false, recipEditId: null, recipAddress: "", recipName: "", recipToken: null });
        this._apply({ recipients: next });
      },

      autoOn,
      autoDesc: autoOn
        ? "Any token with a balance shows up, as long as it clears the minimum value."
        : "Off — the wallet shows only the tokens you picked.",
      onAutoToggle: on => this._apply({
        autoConfig: on,
        tokens: on ? picked : TOKENS.filter(t => t.value >= floor).map(t => t.symbol),
      }),
      minBalance: s.minBalance ?? "",
      onMinBalance: e => this._apply({ minBalance: e.target.value.replace(/[^0-9.]/g, "") }),

      listSub: autoOn
        ? shown.length + " of " + TOKENS.length + " tokens shown · set by the minimum"
        : picked.length + " of " + TOKENS.length + " tokens shown · chosen by you",
      shownChips: shown.slice(0, CHIP_CAP).map(t => ({ symbol: t.symbol, mark: t.mark, gradient: G[t.symbol] })),
      chipsOverflow: shown.length > CHIP_CAP,
      chipsMore: "+" + (shown.length - CHIP_CAP) + " more",
      noneShown: shown.length === 0,

      listOpen: st.listOpen,
      onOpenList: () => this.setState({ listOpen: true, query: "" }),
      onCloseList: () => this.setState({ listOpen: false }),
      listHeaderSub: autoOn ? "Set automatically" : "You choose what appears",
      onTakeOver: () => this._apply({ autoConfig: false, tokens: TOKENS.filter(t => t.value >= floor).map(t => t.symbol) }),
      query: st.query,
      hasQuery: st.query.length > 0,
      onQuery: e => this.setState({ query: e.target.value }),
      onClearQuery: () => this.setState({ query: "" }),
      rows: filtered.map(t => {
        const on = autoOn ? t.value >= floor : picked.indexOf(t.symbol) > -1;
        return {
          symbol: t.symbol,
          mark: t.mark,
          gradient: G[t.symbol],
          value: money(t.value),
          rowBg: on ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent",
          tickMask: on ? CHECK : CIRCLE,
          tickInk: on ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.14))",
          opacity: autoOn && !on ? ".45" : "1",
          cursor: autoOn ? "default" : "pointer",
          onToggle: autoOn ? undefined : () => this._apply({
            tokens: on ? picked.filter(x => x !== t.symbol) : picked.concat([t.symbol]),
          }),
        };
      }),
      noRows: filtered.length === 0,
      noRowsLabel: 'No token matches "' + st.query.trim() + '".',
      listFootNote: autoOn
        ? "Follows the minimum of " + money(floor) + "."
        : (picked.length === 0 ? "Pick at least one token — the wallet is empty." : "Applied as you pick."),
      listFootInk: !autoOn && picked.length === 0 ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",

      pinOn: !!s.pinOn,
      pinSwitch: !!s.pinOn || st.pinPending,
      pinBadge: s.pinOn ? "SET" : "NOT SET",
      pinBadgeMask: s.pinOn ? CHECK : LOCK,
      pinBadgeBg: s.pinOn ? "var(--category-b-soft,rgba(46,230,168,.12))" : "var(--overlay-2,rgba(255,255,255,.08))",
      pinBadgeInk: s.pinOn ? "var(--status-online,#2EE6A8)" : "var(--ink-4,#7C7C8C)",
      pinDesc: s.pinOn
        ? "Six digits, asked for before anything leaves the wallet. Receiving and swapping are unaffected."
        : "Turn this on to add a six-digit step before anything leaves the wallet.",
      onPinToggle: on => on
        ? this.setState({ pinPending: true, pinOpen: true, pinMode: "set", pinStep: "set", pinValue: "", pinFirst: "", pinError: false })
        : this._apply({ pinOn: false }),
      onChangePin: () => this.setState({ pinOpen: true, pinMode: "change", pinStep: "set", pinValue: "", pinFirst: "", pinError: false }),

      pinOpen: st.pinOpen,
      pinIsConfirm: pinConfirm,
      pinTitle: pinConfirm ? "Confirm your PIN" : (st.pinMode === "set" ? "Set up a PIN" : "Choose a new PIN"),
      pinStepLabel: pinConfirm ? "Step 2 of 2" : "Step 1 of 2",
      pinBlurb: pinConfirm
        ? "Type the same six digits again — a typo here would lock you out of transfers."
        : "Six digits, asked for before anything leaves the wallet. Receiving and swapping stay unaffected.",
      pinValue: st.pinValue,
      pinRef: this._pinRef,
      pinFocus: () => { if (this._pinRef.current) this._pinRef.current.focus(); },
      onPinInput: e => this.setState({ pinValue: e.target.value.replace(/[^0-9]/g, "").slice(0, 6), pinError: false }),
      pinDigits: [0, 1, 2, 3, 4, 5].map(i => ({
        glyph: st.pinValue.length > i ? "\u2022" : "",
        line: st.pinError
          ? "var(--status-danger,#F5493D)"
          : (st.pinValue.length >= i ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.14))"),
      })),
      pinNote: st.pinError ? "Those did not match — start again." : "Numbers only",
      pinNoteInk: st.pinError ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",
      pinBtnLabel: pinConfirm ? "Save PIN" : "Continue",
      pinBtnMask: pinConfirm ? LOCK : FORWARD,
      pinBtnBg: pinReady ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.09))",
      pinBtnInk: pinReady ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      pinBtnCursor: pinReady ? "pointer" : "not-allowed",
      onPinBack: () => this.setState({ pinStep: "set", pinValue: st.pinFirst, pinError: false }),
      onPinCancel: () => this.setState({ pinOpen: false, pinPending: false, pinValue: "", pinFirst: "", pinError: false, pinStep: "set" }),
      onPinNext: () => {
        if (!pinReady) return;
        if (!pinConfirm) {
          this.setState({ pinStep: "confirm", pinFirst: st.pinValue, pinValue: "", pinError: false });
          return;
        }
        if (st.pinValue !== st.pinFirst) { this.setState({ pinValue: "", pinError: true }); return; }
        this.setState({ pinOpen: false, pinPending: false, pinValue: "", pinFirst: "", pinStep: "set", pinError: false });
        this._apply({ pinOn: true });
      },

      currencies: CURRENCIES.map(c => ({
        label: c,
        note: c === "USD" ? "Default" : "Priced from " + c,
        bg: (s.currency ?? "USD") === c ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent",
        tickInk: (s.currency ?? "USD") === c ? "var(--accent,#FF5672)" : "transparent",
        onSelect: () => this._apply({ currency: c }),
      })),
      footerNote: "Saved automatically · values in " + (s.currency ?? "USD"),

      onClose: () => this._close(),
      veilAnim: st.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: st.closing ? OUT_CARD : IN_CARD,
    };
  }
}

export default Component;

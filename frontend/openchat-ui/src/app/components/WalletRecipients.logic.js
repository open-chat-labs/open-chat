// Logic for WalletRecipients.svelte — carried over from lib/WalletRecipients.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Saved recipients, shown in the wallet's main area (opened from the panel ⋯ → Manage recipients).
// List: search, Add recipient, rows with network + optional token lock, quick Send, ⋯ (Edit / Copy address / Remove).
// Add / Edit run in place in the same column. onChange(list) on every save/remove; onSend(recipient) hands off to Send.
const NETWORKS = [
  { id: "BTC", test: a => /^(bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a) },
  { id: "ETH", test: a => /^0x[0-9a-fA-F]{40}$/.test(a) },
  { id: "XRP", test: a => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a) },
  { id: "ICP", test: a => /^([a-z0-9]{5}-){4,10}[a-z0-9]{3}$/.test(a) || /^[0-9a-f]{64}$/.test(a) },
];
const detect = a => { const v = (a || "").trim(); if (!v) return null; const h = NETWORKS.find(n => n.test(v)); return h ? h.id : "unknown"; };
const NET_NAME = { BTC: "Bitcoin", ETH: "Ethereum", XRP: "XRP Ledger", ICP: "Internet Computer" };
const short = a => (a || "").length > 26 ? a.slice(0, 12) + "\u2026" + a.slice(-8) : a;
const GRADS = ["linear-gradient(140deg,#FF9F45,#FF5672)", "linear-gradient(140deg,#2EE6A8,#1FB6FF)", "linear-gradient(140deg,#B48CFF,#6A5CFF)", "linear-gradient(140deg,#FFC94D,#FF9F45)", "linear-gradient(140deg,#7FD1FF,#5C7CFF)", "linear-gradient(140deg,#9AA6B8,#5B6577)"];
const gradFor = s => { let h = 0; for (const c of s || "") h = (h * 31 + c.charCodeAt(0)) | 0; return GRADS[Math.abs(h) % GRADS.length]; };
const M = n => "var(--icon-" + n + ") center/contain no-repeat";
const DEFAULTS = [
  { id: "r1", name: "Ada — rent", address: "5sj6i-pqaaa-aaaaf-a3cmq-cai", token: "CHAT", last: "Sent 3 days ago" },
  { id: "r2", name: "Mum", address: "rdmx6-jaaaa-aaaaa-aaadq-cai", token: "ICP", last: "Sent last week" },
  { id: "r3", name: "Hot wallet", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", token: null, last: "Sent 2 months ago" },
  { id: "r4", name: "Ledger cold", address: "bc1q9h7garjqr0fy4ypz8w3c2y0w8qk3n6vqx4m2lc", token: null, last: "Never sent" },
  { id: "r5", name: "Kraken deposit", address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", token: null, last: "Sent yesterday" },
];

class Component extends DCLogic {
  state = { list: null, query: "", menu: null, confirm: null, copied: null, form: null };
  componentWillUnmount() { clearTimeout(this._ct); }
  _list() { return this.state.list ?? this.props.recipients ?? DEFAULTS; }
  _commit(list) { this.setState({ list }); if (this.props.onChange) this.props.onChange(list); }

  renderVals() {
    const st = this.state, list = this._list(), f = st.form;
    const tokens = (this.props.tokens || []).filter(t => t.held > 0);
    const q = st.query.trim().toLowerCase();
    const shown = q ? list.filter(r => (r.name + " " + r.address).toLowerCase().includes(q)) : list;
    const close = () => this.setState({ menu: null });
    const leave = () => { if (this.props.onClose) this.props.onClose(); };

    const rows = shown.map(r => {
      const net = detect(r.address), open = st.menu === r.id;
      return {
        name: r.name, initial: (r.name || "?").trim().charAt(0).toUpperCase(), grad: gradFor(r.name),
        net: net === "unknown" ? "UNKNOWN" : net, locked: !!r.token, token: r.token, lockTitle: r.token ? "Only " + r.token + " can be sent here" : "",
        short: st.copied === r.id ? "Address copied" : short(r.address),
        addrInk: st.copied === r.id ? "var(--status-online,#2EE6A8)" : "var(--ink-4,#7C7C8C)",
        last: r.last || "Never sent",
        idle: st.confirm !== r.id, confirming: st.confirm === r.id,
        sendAria: "Send to " + r.name,
        onSend: () => { if (this.props.onSend) this.props.onSend(Object.assign({ network: net }, r)); },
        menuOpen: open, menuStr: String(open), menuBg: open ? "var(--overlay-2,rgba(255,255,255,.09))" : "transparent",
        onMenu: e => { if (e && e.preventDefault) e.preventDefault(); this.setState({ menu: open ? null : r.id }); },
        menu: [
          { label: "Edit", mask: M("edit"), ink: "var(--ink,#ECECF1)", press: () => this.setState({ menu: null, form: { id: r.id, address: r.address, name: r.name, token: r.token ?? null } }) },
          { label: "Copy address", mask: M("copy"), ink: "var(--ink,#ECECF1)", press: () => {
            try { navigator.clipboard.writeText(r.address); } catch (err) {}
            clearTimeout(this._ct); this.setState({ menu: null, copied: r.id }); this._ct = setTimeout(() => this.setState({ copied: null }), 1600); } },
          { label: "Remove", mask: M("trash"), ink: "var(--status-danger,#F5493D)", press: () => this.setState({ menu: null, confirm: r.id }) },
        ],
        onCancelRemove: () => this.setState({ confirm: null }),
        onRemove: () => { this.setState({ confirm: null }); this._commit(list.filter(x => x.id !== r.id)); },
      };
    });

    const addr = f ? f.address.trim() : "", net = f ? detect(addr) : null;
    const dupe = f ? list.find(r => r.address === addr && r.id !== f.id) : null;
    const valid = !!net && net !== "unknown" && !dupe;
    const setF = o => this.setState(s => ({ form: Object.assign({}, s.form, o) }));
    const note = !addr ? "" : dupe ? "Already saved as " + dupe.name + "." : net === "unknown" ? "This doesn't look like an address we support." : NET_NAME[net] + " address";

    return {
      isList: !f, isForm: !!f,
      title: f ? (f.id ? "Edit recipient" : "Add recipient") : "Recipients",
      backLabel: f ? "Back to recipients" : "Back to wallet",
      back: () => f ? this.setState({ form: null }) : leave(),
      query: st.query, onQuery: e => this.setState({ query: e.target.value }),
      onAdd: () => this.setState({ form: { id: null, address: "", name: "", token: null }, menu: null, confirm: null }),
      rows, closeMenu: close,
      empty: shown.length === 0,
      emptyTitle: list.length ? "No matches" : "No saved recipients yet",
      emptyBody: list.length ? 'Nothing matches "' + st.query.trim() + '".' : "Save addresses you send to often and pick them by name on the send screen.",

      fAddress: f ? f.address : "", onAddress: e => setF({ address: e.target.value }),
      addrLine: addr && !valid ? "var(--status-danger,#F5493D)" : valid ? "var(--line-2,rgba(255,255,255,.14))" : "var(--line-1,rgba(255,255,255,.07))",
      hasNote: !!addr, note,
      noteBg: valid ? "color-mix(in oklch,var(--status-online,#2EE6A8) 12%,transparent)" : "color-mix(in oklch,var(--status-danger,#F5493D) 12%,transparent)",
      noteInk: valid ? "var(--status-online,#2EE6A8)" : "var(--status-danger,#F5493D)",
      noteMask: M(valid ? "circle-check" : "warning"),
      fName: f ? f.name : "", onName: e => setF({ name: e.target.value }),
      namePlaceholder: valid ? NET_NAME[net] + " recipient" : "Recipient's name",
      chips: [{ symbol: null, label: "Any token" }].concat(tokens.map(t => ({ symbol: t.symbol, label: t.symbol, mark: t.mark, grad: t.grad }))).map(c => {
        const on = (f ? f.token : null) === c.symbol;
        return { label: c.label, mark: c.mark || "", grad: c.grad || "transparent", hasDot: !!c.symbol, on, onStr: String(on),
          pad: c.symbol ? "0 var(--space-12) 0 5px" : "0 var(--space-14)",
          bg: on ? "var(--overlay-2,rgba(255,255,255,.08))" : "var(--overlay-1,rgba(255,255,255,.03))",
          ring: on ? "inset 0 0 0 1px var(--accent,#FF5672)" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))",
          ink: on ? "var(--ink,#ECECF1)" : "var(--ink-2,#C9C9D4)", pick: () => setF({ token: c.symbol }) };
      }),
      tokenHint: f && f.token ? "Send will only offer " + f.token + " for this recipient." : "Leave as Any token to send anything this network supports.",
      saveLabel: f && f.id ? "Save changes" : "Save recipient",
      saveDisabled: String(!valid),
      saveBg: valid ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.09))",
      saveInk: valid ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      saveCursor: valid ? "pointer" : "default",
      onSave: () => {
        if (!valid) return;
        const name = f.name.trim() || NET_NAME[net] + " recipient";
        const next = f.id ? list.map(r => r.id === f.id ? Object.assign({}, r, { name, address: addr, token: f.token }) : r)
          : list.concat([{ id: "r" + Date.now(), name, address: addr, token: f.token, last: "Never sent" }]);
        this.setState({ form: null }); this._commit(next);
      },
    };
  }
}

export default Component;

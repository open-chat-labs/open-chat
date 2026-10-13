// Logic for AccessGatesCards.svelte — carried over from lib/AccessGatesCards.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  diamond: "var(--icon-diamond) center/contain no-repeat",
  diamondOutline: "var(--icon-diamond-outline) center/contain no-repeat",
  neuron: "var(--icon-neuron) center/contain no-repeat",
  payment: "var(--icon-payment) center/contain no-repeat",
  balance: "var(--icon-balance) center/contain no-repeat",
  credential: "var(--icon-credential) center/contain no-repeat",
  person: "var(--icon-person) center/contain no-repeat",
  lock: "var(--icon-lock) center/contain no-repeat",
  chit: "var(--icon-chit) center/contain no-repeat",
  nft: "var(--icon-nft) center/contain no-repeat",
  plus: "var(--icon-plus) center/contain no-repeat",
  close: "var(--icon-close) center/contain no-repeat",
  edit: "var(--icon-edit) center/contain no-repeat",
};

const DOTS = {
  CHAT: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  ICP: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  BTC: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  BOB: "linear-gradient(140deg,#8E9BB3,#5A6478)",
  USDC: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  USDT: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  KINIC: "linear-gradient(140deg,#FF6B8B,#C13584)",
  Motoko: "linear-gradient(140deg,#FF6B8B,#C13584)",
  ICPanda: "linear-gradient(140deg,#8E9BB3,#5A6478)",
  TACO: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  "Dragging Karma Points": "linear-gradient(140deg,#B06BFF,#6A2BFF)",
  "Internet Computer": "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
};

const TOKENS = ["CHAT", "ICP", "BTC", "BOB", "USDC", "USDT", "KINIC"];
const NERVOUS = ["CHAT", "Motoko", "ICPanda", "TACO", "Dragging Karma Points", { label: "Internet Computer", soon: true }];

const TYPES = {
  lifetime: { label: "Lifetime diamond membership", mask: M.diamond, desc: "Grants access to users who hold a lifetime membership." },
  diamond: { label: "Diamond membership", mask: M.diamondOutline, desc: "Requires an active diamond membership." },
  neuron: {
    label: "Neuron holder", mask: M.neuron, desc: "Users must stake a neuron with specific criteria.",
    assets: NERVOUS, repeatable: true,
    fields: [{ key: "a", placeholder: "Minimum dissolve delay", unit: "days" }, { key: "b", placeholder: "Minimum stake", unit: "tokens" }],
    chips: e => [e.asset && { label: e.asset, dot: true }, e.a && { label: e.a + "d delay" }, e.b && { label: e.b + " staked" }].filter(Boolean),
  },
  payment: {
    label: "Payment", mask: M.payment, desc: "Access is granted after a one-time or recurring entry fee.",
    assets: TOKENS, repeatable: true,
    fields: [{ key: "a", placeholder: "Amount", unit: "tokens", required: true }],
    chips: e => [e.asset && { label: e.asset, dot: true }, e.a && { label: e.a + " tokens" }].filter(Boolean),
  },
  balance: {
    label: "Minimum token balance", mask: M.balance, desc: "Requires holding a minimum amount of a token.",
    assets: TOKENS, repeatable: true, uniqueAsset: true,
    fields: [{ key: "a", placeholder: "Minimum balance", unit: "tokens", required: true }],
    chips: e => [e.asset && { label: e.asset, dot: true }, e.a && { label: "min " + e.a }].filter(Boolean),
  },
  credential: { label: "Verified credential", mask: M.credential, desc: "Only users with a valid external credential can enter." },
  unique: { label: "Unique person", mask: M.person, desc: "Limited to verified unique humans." },
  locked: { label: "Locked", mask: M.lock, desc: "Invited users only; not open to the public." },
  chit: {
    label: "Minimum CHIT earned", mask: M.chit, desc: "Requires a minimum amount of CHIT earned.",
    fields: [{ key: "a", placeholder: "Minimum CHIT earned", unit: "CHIT", required: true }],
    chips: e => (e.a ? [{ label: e.a + " CHIT" }] : []),
  },
  nft: { label: "NFT holder", mask: M.nft, desc: "Must hold a specific NFT.", soon: true },
};

const MODES = ["All", "Any"];
const INTERVALS = ["1 day", "1 week", "2 weeks", "1 month", "3 months", "6 months"];
const assetName = a => (typeof a === "string" ? a : a.label);

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { gates: [], modeIndex: 0, editing: null, pickerOpen: false, intervalOn: false, every: "1 month" };
  }

  _emit(gates) {
    if (this.props.onChange) this.props.onChange({ count: gates.length, mode: MODES[this.state.modeIndex], gates });
  }

  _add(key) {
    const t = TYPES[key];
    if (t.soon) return;
    const gates = this.state.gates.concat([{ id: "g" + Date.now(), type: key, asset: "", a: "", b: "" }]);
    const last = gates[gates.length - 1];
    this.setState({ gates, pickerOpen: false, editing: (t.fields || t.assets) ? last.id : null });
    this._emit(gates);
  }

  _patch(id, patch) {
    const gates = this.state.gates.map(g => (g.id === id ? { ...g, ...patch } : g));
    this.setState({ gates });
    this._emit(gates);
  }

  _remove(id) {
    const gates = this.state.gates.filter(g => g.id !== id);
    this.setState({ gates, editing: this.state.editing === id ? null : this.state.editing });
    this._emit(gates);
  }

  renderVals() {
    const s = this.state;
    const locked = (this.props.isDiamond ?? true) === false;
    const complete = g => {
      const t = TYPES[g.type];
      if (t.assets && !g.asset) return false;
      return !(t.fields || []).some(f => f.required && !String(g[f.key] || "").trim());
    };

    return {
      locked,
      unlocked: !locked,
      onUpgrade: this.props.onUpgrade,
      plusMask: M.plus,
      closeMask: M.close,
      editMask: M.edit,

      countLabel: s.gates.length ? "(" + s.gates.length + ")" : "",
      modeLabels: MODES,
      modeIndex: s.modeIndex,
      noDots: [],
      onMode: i => this.setState({ modeIndex: i }),

      empty: s.gates.length === 0,
      cards: s.gates.map(g => {
        const t = TYPES[g.type];
        const editing = s.editing === g.id;
        const ok = complete(g);
        const chips = t.chips ? t.chips(g) : [];
        return {
          title: t.label,
          desc: t.desc,
          mask: t.mask,
          tile: ok ? "color-mix(in srgb, var(--status-verified,#3D9BFF) 16%, transparent)" : "var(--overlay-2,rgba(255,255,255,.07))",
          iconInk: ok ? "var(--status-verified,#3D9BFF)" : "var(--status-warning,#FFB03D)",
          line: ok ? "var(--line-2,rgba(255,255,255,.08))" : "color-mix(in srgb, var(--status-warning,#FFB03D) 45%, transparent)",
          configurable: !!(t.fields || t.assets),
          hasChips: !editing && chips.length > 0,
          chips: chips.map(c => ({ label: c.label, hasDot: !!c.dot, dot: DOTS[c.label] || "linear-gradient(140deg,#8E9BB3,#5A6478)" })),
          editing,
          needsAsset: !!t.assets,
          assets: (t.assets || []).map(a => {
            const name = assetName(a);
            const soon = typeof a !== "string" && a.soon;
            const taken = t.uniqueAsset && s.gates.some(x => x.type === g.type && x.asset === name && x.id !== g.id);
            const sel = g.asset === name;
            return {
              label: soon ? name + " (soon)" : (taken ? name + " (used)" : name),
              dot: DOTS[name] || "linear-gradient(140deg,#8E9BB3,#5A6478)",
              bg: sel ? "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)" : "var(--overlay-1,rgba(255,255,255,.05))",
              line: sel ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.1))",
              ink: soon || taken ? "var(--ink-4,#7C7C8C)" : sel ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)",
              cursor: soon || taken ? "not-allowed" : "pointer",
              onSelect: () => { if (!soon && !taken) this._patch(g.id, { asset: name }); },
            };
          }),
          fields: (t.fields || []).map(f => ({
            value: String(g[f.key] || ""),
            placeholder: f.placeholder,
            unit: f.unit,
            line: f.required && !String(g[f.key] || "").trim()
              ? "color-mix(in srgb, var(--status-warning,#FFB03D) 50%, transparent)"
              : "var(--line-2,rgba(255,255,255,.08))",
            onInput: e => this._patch(g.id, { [f.key]: e.target.value.replace(/[^\d.]/g, "") }),
          })),
          doneBg: ok ? "var(--accent,#FF5672)" : "var(--overlay-1,rgba(255,255,255,.05))",
          doneInk: ok ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
          doneCursor: ok ? "pointer" : "not-allowed",
          onDone: () => { if (ok) this.setState({ editing: null }); },
          onEdit: () => this.setState({ editing: g.id }),
          onRemove: () => this._remove(g.id),
        };
      }),

      pickerOpen: s.pickerOpen,
      onOpenPicker: () => this.setState({ pickerOpen: true }),
      onClosePicker: () => this.setState({ pickerOpen: false }),
      catalogue: Object.keys(TYPES).map(key => {
        const t = TYPES[key];
        const used = !t.repeatable && s.gates.some(g => g.type === key);
        return {
          label: t.label,
          desc: used ? "Already added" : t.desc,
          mask: t.mask,
          soon: !!t.soon,
          ink: t.soon || used ? "var(--ink-4,#7C7C8C)" : "var(--ink,#ECECF1)",
          cursor: t.soon || used ? "not-allowed" : "pointer",
          onAdd: () => { if (!used) this._add(key); },
        };
      }),

      intervalOn: s.intervalOn,
      onIntervalOn: v => this.setState({ intervalOn: v }),
      intervalHint: s.intervalOn ? "Checked every " + s.every + "." : "Members are checked once, when they join.",
      intervals: INTERVALS,
      every: s.every,
      onEvery: v => this.setState({ every: v }),
    };
  }
}

export default Component;

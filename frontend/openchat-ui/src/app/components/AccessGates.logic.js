// Logic for AccessGates.svelte — carried over from lib/AccessGates.dc.html. renderVals() feeds the markup.
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
  search: "var(--icon-search) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
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

const TOKENS = ["CHAT", "ICP", "BTC", "BOB", "USDC", "USDT"];
const NERVOUS = ["OpenChat", "ICPanda", "Dragginz", "WaterNeuron", "Gold DAO"];

// Full token directory behind the curated pills — searchable in the picker modal.
const DIRECTORY = ("CHAT|OpenChat·ICP|Internet Computer·BTC|ckBTC — Bitcoin·ETH|ckETH — Ethereum·USDC|ckUSDC·USDT|ckUSDT·BOB|BOB·KINIC|Kinic·GLDGov|Gold DAO·OGY|Origyn·MOD|Modclub·BOOM|Boom DAO·CTZ|Catalyze·NUA|Nuance·TRAX|Trax·SONIC|Sonic·HOT|HotOrNot·GHOST|Ghost·ICL|ICLighthouse·ELNA|ELNA AI·NTN|Neutrinite·DCD|DecideAI·DKP|Dragginz Karma Points·ICS|ICPSwap·SEER|Seers·WTN|WaterNeuron·ALICE|ALICE DAO·YUKU|Yuku DAO·NFIDW|NFID Wallet·PANDA|ICPanda·TACO|TACO DAO·MOTOKO|Motoko·KONG|KongSwap·EXE|Windoge98·DOGMI|DOGMI·SNEED|Sneed DAO·NICP|Neuron ICP·CLOWN|Clown·ND64|ND64·TENDY|Tendy·DAMONIC|Damonic·WUMBO|Wumbo·CLOUD|Cloud·SWAMP|Swampies·FOMO|FOMO·ckLINK|ckLINK·ckUNI|ckUNI·ckPEPE|ckPEPE·ckSHIB|ckSHIB·ckWBTC|ckWBTC·ckWSTETH|ckwstETH·ckXAUT|ckXAUt·ckOCT|ckOCT·ckEURC|ckEURC·DAI|Dai·PYUSD|PayPal USD·FDUSD|First Digital USD·TUSD|TrueUSD·EURC|Euro Coin·SOL|Solana·BNB|BNB·XRP|XRP·ADA|Cardano·DOGE|Dogecoin·TRX|TRON·AVAX|Avalanche·DOT|Polkadot·MATIC|Polygon·LINK|Chainlink·TON|Toncoin·LTC|Litecoin·BCH|Bitcoin Cash·ATOM|Cosmos·NEAR|NEAR Protocol·APT|Aptos·SUI|Sui·FIL|Filecoin·TIA|Celestia·INJ|Injective·SEI|Sei·ARB|Arbitrum·OP|Optimism·STX|Stacks·RNDR|Render·GRT|The Graph·UNI|Uniswap·AAVE|Aave·MKR|Maker·LDO|Lido DAO·CRV|Curve DAO·SNX|Synthetix·COMP|Compound·BAL|Balancer·YFI|yearn.finance·SUSHI|SushiSwap·1INCH|1inch·CAKE|PancakeSwap·GMX|GMX·DYDX|dYdX·PENDLE|Pendle·ENA|Ethena·ETHFI|Ether.fi·EIGEN|EigenLayer·JUP|Jupiter·PYTH|Pyth Network·JTO|Jito·RAY|Raydium·ORCA|Orca·WIF|dogwifhat·BONK|Bonk·PEPE|Pepe·FLOKI|Floki·SHIB|Shiba Inu·BRETT|Brett·POPCAT|Popcat·MEW|cat in a dogs world·TURBO|Turbo·MOG|Mog Coin·ENS|Ethereum Name Service·IMX|Immutable·SAND|The Sandbox·MANA|Decentraland·AXS|Axie Infinity·GALA|Gala·CHZ|Chiliz·APE|ApeCoin·ILV|Illuvium·BLUR|Blur·LOOKS|LooksRare·RARE|SuperRare·FTM|Fantom·ALGO|Algorand·XLM|Stellar·HBAR|Hedera·VET|VeChain·EGLD|MultiversX·KAVA|Kava·RUNE|THORChain·OSMO|Osmosis·JUNO|Juno·SCRT|Secret·ROSE|Oasis·ONE|Harmony·CELO|Celo·KSM|Kusama·ZIL|Zilliqa·IOTA|IOTA·NEO|Neo·EOS|EOS·QNT|Quant·XMR|Monero·ZEC|Zcash·DASH|Dash·XTZ|Tezos·THETA|Theta·FLOW|Flow·MINA|Mina·KAS|Kaspa·TAO|Bittensor·FET|Artificial Superintelligence·AGIX|SingularityNET·OCEAN|Ocean Protocol·AKT|Akash·AR|Arweave·STORJ|Storj·HNT|Helium·IOTX|IoTeX·ANKR|Ankr·BAT|Basic Attention·ZRX|0x·KNC|Kyber Network·REN|Ren·BAND|Band Protocol·UMA|UMA·API3|API3·TRB|Tellor·NMR|Numeraire·RPL|Rocket Pool·FXS|Frax Share·SPELL|Spell·CVX|Convex·MPL|Maple·GNO|Gnosis·SAFE|Safe·ARKM|Arkham·WLD|Worldcoin·ZK|zkSync·STRK|Starknet·MANTA|Manta Network·METIS|Metis·BOBA|Boba Network·SKL|SKALE·CTSI|Cartesi·LRC|Loopring").split("·").map(s => { const p = s.split("|"); return { symbol: p[0], name: p[1] }; });

// SNS nervous systems — curated pills first, the rest searchable in the picker.
const SNS = ("OpenChat|CHAT — messaging;Motoko|MOTOKO — developer tooling;ICPanda|PANDA — community;TACO DAO|TACO — treasury;Dragginz|DKP — game;WaterNeuron|WTN — liquid staking;Gold DAO|GLDGov — tokenized gold;Origyn|OGY — digital certificates;Modclub|MOD — moderation;Boom DAO|BOOM — gaming;Catalyze|CTZ — communities;Nuance|NUA — publishing;Trax|TRAX — music;Sonic|SONIC — DEX;HotOrNot|HOT — short video;Ghost|GHOST — meme;ICLighthouse|ICL — trading;ELNA AI|ELNA — AI agents;Neutrinite|NTN — analytics;DecideAI|DCD — AI;ICPSwap|ICS — DEX;Seers|SEER — prediction markets;ALICE DAO|ALICE — quant trading;Yuku DAO|YUKU — NFTs;NFID Wallet|NFIDW — identity;KongSwap|KONG — DEX;Sneed DAO|SNEED — community;Windoge98|EXE — meme;Cecil the Lion|CECIL — meme;FomoWell|FOMO — social;Swampies|SWAMP — game;Cycles Transfer Station|CTS — infrastructure;Personal DAO|PDAO — tooling;EstateDAO|EST — real estate;Kinic|KINIC — search;SNS-1|SNS1 — first SNS;Dolr AI|DOLR — video;Funded|FND — crowdfunding;CyclOps|CYC — cycles management;Konecta|KONECTA — AI;Pogo|POGO — social;Nuance Labs|NUAL — publishing").split(";").map(s => { const p = s.split("|"); return { symbol: p[0], name: p[1] }; });

const GRADS = [
  "#2EE6A8,#1FB6FF", "#ff5f9e,#6a2bff", "#ffb03d,#ff4d4d", "#8E9BB3,#5A6478",
  "#5FA8FF,#8C6BFF", "#FF6B8B,#C13584", "#B06BFF,#6A2BFF", "#43E97B,#38F9D7",
  "#FA709A,#FEE140", "#4FACFE,#00F2FE", "#F093FB,#F5576C", "#30CFD0,#330867",
];
const dotFor = name => {
  if (DOTS[name]) return DOTS[name];
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) % 9973;
  return "linear-gradient(140deg," + GRADS[h % GRADS.length] + ")";
};
const PICKERS = {
  token: { title: "Select a token", search: "Search by symbol or name", all: "ALL TOKENS", empty: "Try the symbol instead of the full name.", dir: DIRECTORY, more: "More tokens", change: "Change token" },
  sns: { title: "Select a nervous system", search: "Search nervous systems", all: "ALL NERVOUS SYSTEMS", empty: "Search by DAO name or token symbol.", dir: SNS, more: "More systems", change: "Change system" },
};
const entryName = (dir, sym) => { const t = dir.find(x => x.symbol === sym); return t ? t.name : sym; };

const TYPES = {
  lifetime: { label: "Lifetime diamond membership", mask: M.diamond, desc: "Holders of a lifetime membership.", sentence: "must hold a lifetime diamond membership" },
  diamond: { label: "Diamond membership", mask: M.diamondOutline, desc: "Anyone with an active diamond membership.", sentence: "must have an active diamond membership" },
  neuron: {
    label: "Neuron holder", mask: M.neuron, desc: "Stake a neuron with specific criteria.",
    assetLabel: "NERVOUS SYSTEM", assets: NERVOUS, searchable: true, picker: "sns", repeatable: true,
    pickerSub: "Members must stake a neuron in this nervous system.",
    fields: [{ key: "a", placeholder: "Minimum dissolve delay (optional)", unit: "days" }, { key: "b", placeholder: "Minimum stake (optional)", unit: "tokens" }],
    sentence: "must stake a neuron",
    chips: e => [e.asset && { label: e.asset, dot: true }, e.a && { label: e.a + "d dissolve delay" }, e.b && { label: e.b + " staked" }].filter(Boolean),
  },
  payment: {
    label: "Payment", mask: M.payment, desc: "Pay a one-time or recurring entry fee.",
    assetLabel: "TOKEN", assets: TOKENS, searchable: true, picker: "token", repeatable: true,
    pickerSub: "Members pay the entry fee in this token.",
    fields: [{ key: "a", placeholder: "Amount", unit: "tokens", required: true }],
    sentence: "must pay an entry fee",
    chips: e => (e.asset && e.a ? [{ label: e.a + " " + e.asset, dot: e.asset }] : [e.asset && { label: e.asset, dot: e.asset }, e.a && { label: e.a }].filter(Boolean)),
  },
  balance: {
    label: "Minimum token balance", mask: M.balance, desc: "Hold a minimum amount of a token.",
    assetLabel: "TOKEN", assets: TOKENS, searchable: true, picker: "token", repeatable: true, uniqueAsset: true,
    pickerSub: "Members must hold a balance of this token.",
    fields: [{ key: "a", placeholder: "Minimum balance", unit: "tokens", required: true }],
    sentence: "must hold a minimum token balance",
    chips: e => (e.asset && e.a ? [{ label: "min " + e.a + " " + e.asset, dot: e.asset }] : [e.asset && { label: e.asset, dot: e.asset }, e.a && { label: "min " + e.a }].filter(Boolean)),
  },
  credential: { label: "Verified credential", mask: M.credential, desc: "Present a valid external credential.", sentence: "must present a verified credential" },
  unique: { label: "Unique person", mask: M.person, desc: "Verified unique human.", sentence: "must be a verified unique person" },
  locked: { label: "Locked", mask: M.lock, desc: "Invited users only.", sentence: "must be invited — the group is locked" },
  chit: {
    label: "Minimum CHIT earned", mask: M.chit, desc: "Earn a minimum amount of CHIT.",
    fields: [{ key: "a", placeholder: "Minimum CHIT earned", unit: "CHIT", required: true }],
    sentence: "must have earned a minimum amount of CHIT",
    chips: e => (e.a ? [{ label: e.a + " CHIT" }] : []),
  },
  nft: { label: "NFT holder", mask: M.nft, desc: "Hold a specific NFT.", soon: true, sentence: "must hold a specific NFT" },
};

const JOINERS = ["All", "Any"];
const INTERVALS = ["1 day", "1 week", "2 weeks", "1 month", "3 months", "6 months"];
const assetName = a => (typeof a === "string" ? a : a.label);

class Component extends DCLogic {
  constructor(props) {
    super(props);
    // the host can hand back the state it was last given, so gates survive
    // the tab being unmounted and remounted
    const v = props.value || {};
    this.state = {
      rules: Array.isArray(v.rules) ? v.rules : [],
      joiner: v.joiner || "All",
      editing: null, addOpen: false,
      intervalOn: !!v.intervalOn,
      every: v.every || "1 month",
      tokenFor: null, tokenQuery: "",
    };
  }

  _emit(rules, extra) {
    if (!this.props.onChange) return;
    const s = { ...this.state, ...(extra || {}) };
    this.props.onChange({
      count: rules.length,
      joiner: s.joiner,
      rules,
      intervalOn: s.intervalOn,
      every: s.every,
    });
  }

  _add(key) {
    const t = TYPES[key];
    if (t.soon) return;
    const rules = this.state.rules.slice();
    const rule = { id: "r" + Date.now(), type: key, asset: "", a: "", b: "" };
    rules.push(rule);
    const needsSetup = !!(t.fields || t.assets);
    this.setState({ rules, addOpen: false, editing: needsSetup ? rule.id : null });
    this._emit(rules);
  }

  _patch(id, patch) {
    const rules = this.state.rules.map(r => (r.id === id ? { ...r, ...patch } : r));
    this.setState({ rules });
    this._emit(rules);
  }

  _remove(id) {
    const rules = this.state.rules.filter(r => r.id !== id);
    this.setState({ rules, editing: this.state.editing === id ? null : this.state.editing });
    this._emit(rules);
  }

  _tokenPickerVals() {
    const s = this.state;
    const rule = s.rules.find(r => r.id === s.tokenFor);
    if (!rule) return { tokenOpen: false, tokenGroups: [], noTokenResults: false, tokenQuery: "", hasQuery: false, tokenSub: "", tokenTitle: "", tokenPlaceholder: "", tokenEmptyHint: "" };
    const t = TYPES[rule.type];
    const P = PICKERS[t.picker || "token"];
    const q = s.tokenQuery.trim().toLowerCase();
    const row = tk => {
      const taken = t.uniqueAsset && s.rules.some(x => x.type === rule.type && x.asset === tk.symbol && x.id !== rule.id);
      const selected = rule.asset === tk.symbol;
      return {
        symbol: tk.symbol,
        name: taken ? tk.name + " — already gated" : tk.name,
        dot: dotFor(tk.symbol),
        dim: taken ? .4 : 1,
        ink: taken ? "var(--ink-4,#7C7C8C)" : selected ? "var(--accent-bright,#FF8298)" : "var(--ink,#ECECF1)",
        bg: selected ? "color-mix(in srgb, var(--accent,#FF5672) 10%, transparent)" : "transparent",
        cursor: taken ? "not-allowed" : "pointer",
        taken, selected,
        onSelect: () => { if (!taken) { this._patch(rule.id, { asset: tk.symbol }); this.setState({ tokenFor: null, tokenQuery: "" }); } },
      };
    };
    const matches = q
      ? P.dir.filter(tk => tk.symbol.toLowerCase().includes(q) || tk.name.toLowerCase().includes(q))
      : null;
    const groups = matches
      ? (matches.length ? [{ label: matches.length + (matches.length === 1 ? " RESULT" : " RESULTS"), tokens: matches.map(row) }] : [])
      : [
          { label: "MOST USED", tokens: (t.assets || []).map(sym => row({ symbol: sym, name: entryName(P.dir, sym) })) },
          { label: P.all + " · " + P.dir.length, tokens: P.dir.map(row) },
        ];
    return {
      tokenOpen: true,
      tokenTitle: P.title,
      tokenPlaceholder: P.search,
      tokenEmptyHint: P.empty,
      tokenSub: t.pickerSub || "",
      tokenQuery: s.tokenQuery,
      hasQuery: s.tokenQuery.length > 0,
      onTokenQuery: e => this.setState({ tokenQuery: e.target.value }),
      onClearQuery: () => this.setState({ tokenQuery: "" }),
      onCloseToken: () => this.setState({ tokenFor: null, tokenQuery: "" }),
      tokenGroups: groups,
      noTokenResults: !!matches && matches.length === 0,
    };
  }

  renderVals() {
    const s = this.state;
    // readOnly: members see the requirements as facts, with nothing to change
    const ro = !!this.props.readOnly;
    const locked = !ro && (this.props.isDiamond ?? true) === false;
    const joinerWord = s.joiner === "All" ? "all" : "any";
    const complete = r => {
      const t = TYPES[r.type];
      if (t.assets && !r.asset) return false;
      return !(t.fields || []).some(f => f.required && !String(r[f.key] || "").trim());
    };

    return {
      locked,
      unlocked: !locked,
      readOnly: ro, canEdit: !ro,
      showJoinerPicker: !ro && s.rules.length > 0,
      emptyHint: ro ? "There are no extra requirements to join." : "Add a requirement to gate the group. People you invite directly never have to pass gates.",
      recheckTitle: s.intervalOn && s.rules.length ? "Re-checked every " + s.every : "Checked once, when members join",
      recheckBody: s.intervalOn && s.rules.length
        ? "Every " + s.every + ", members are checked against these requirements again. Anyone who no longer meets them is marked as lapsed."
        : "Members don't need to keep meeting these requirements after they've joined.",
      recheckMask: "var(--icon-refresh) center/contain no-repeat",
      onUpgrade: this.props.onUpgrade,
      gemMask: M.diamond,
      lockedWhy: [
        { mask: "var(--icon-shield) center/contain no-repeat", title: "Keep out spam and bots", body: "Require a verified unique person or earned CHIT." },
        { mask: M.balance, title: "Reward your holders", body: "Open the group only to people holding your token or staking in your DAO." },
        { mask: M.payment, title: "Charge for entry", body: "Set a one-time or recurring fee, paid in any supported token." },
      ].map((w, i) => ({ ...w, divider: i ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "none" })),
      lockedExample: [
        { mask: M.balance, sentence: TYPES.balance.sentence || "must hold a minimum token balance", chip: "500 CHAT", dot: DOTS.CHAT, showJoiner: false },
        { mask: M.person, sentence: TYPES.unique.sentence, chip: "Unique person", dot: "", showJoiner: true },
      ],
      plusMask: M.plus,
      closeMask: M.close,
      editMask: M.edit,
      searchMask: M.search,
      checkMask: M.check,

      summary: s.rules.length === 0
        ? "No requirements — anyone you invite or who finds the group can join."
        : s.rules.length === 1
          ? "Members must satisfy the requirement below."
          : "Members must satisfy " + joinerWord + " of the " + s.rules.length + " requirements below.",
      hasRules: true,
      joinerLabel: s.joiner === "All" ? "AND" : "OR",
      joinerLabels: JOINERS,
      joinerIndex: JOINERS.indexOf(s.joiner),
      noDots: [],
      onJoiner: i => { this.setState({ joiner: JOINERS[i] }); this._emit(s.rules, { joiner: JOINERS[i] }); },

      empty: s.rules.length === 0,
      rules: s.rules.map((r, i) => {
        const t = TYPES[r.type];
        const editing = s.editing === r.id;
        const ok = complete(r);
        const chips = t.chips ? t.chips(r) : [];
        return {
          showJoiner: i > 0,
          mask: t.mask,
          iconInk: ok ? "var(--status-verified,#3D9BFF)" : "var(--status-warning,#FFB03D)",
          line: ok ? "var(--line-2,rgba(255,255,255,.08))" : "color-mix(in srgb, var(--status-warning,#FFB03D) 45%, transparent)",
          sentence: t.sentence,
          // collapsed rows are one line, so the icon centres against it;
          // the open editor grows downward and must top-align
          align: editing ? "flex-start" : "center",
          hasChips: !editing && chips.length > 0,
          chips: chips.map(c => ({ label: c.label, hasDot: !!c.dot, dot: dotFor(c.dot === true ? c.label : c.dot) })),
          editing: editing && !ro,
          showActions: !editing && !ro,
          configurable: !!(t.fields || t.assets),
          needsAsset: !!t.assets,
          assetLabel: t.assetLabel || "",
          browseAll: !!t.searchable,
          browseLabel: (() => {
            const P = PICKERS[t.picker || "token"];
            return r.asset && !(t.assets || []).includes(r.asset) ? P.change : P.more;
          })(),
          onBrowse: () => this.setState({ tokenFor: r.id, tokenQuery: "" }),
          assets: (t.searchable && r.asset && !t.assets.includes(r.asset) ? t.assets.concat([r.asset]) : (t.assets || [])).map(a => {
            const name = assetName(a);
            const soon = typeof a !== "string" && a.soon;
            const taken = t.uniqueAsset && s.rules.some(x => x.type === r.type && x.asset === name && x.id !== r.id);
            const sel = r.asset === name;
            return {
              label: soon ? name + " (soon)" : (taken ? name + " (used)" : name),
              dot: dotFor(name),
              bg: sel ? "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)" : "var(--overlay-1,rgba(255,255,255,.05))",
              line: sel ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.1))",
              ink: soon || taken ? "var(--ink-4,#7C7C8C)" : sel ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)",
              cursor: soon || taken ? "not-allowed" : "pointer",
              onSelect: () => { if (!soon && !taken) this._patch(r.id, { asset: name }); },
            };
          }),
          fields: (t.fields || []).map(f => ({
            value: String(r[f.key] || ""),
            placeholder: f.placeholder,
            unit: f.unit,
            line: f.required && !String(r[f.key] || "").trim()
              ? "color-mix(in srgb, var(--status-warning,#FFB03D) 50%, transparent)"
              : "var(--line-2,rgba(255,255,255,.08))",
            onInput: e => this._patch(r.id, { [f.key]: e.target.value.replace(/[^\d.]/g, "") }),
          })),
          doneBg: ok ? "var(--accent,#FF5672)" : "var(--overlay-1,rgba(255,255,255,.05))",
          doneInk: ok ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
          doneCursor: ok ? "pointer" : "not-allowed",
          onDone: () => { if (ok) this.setState({ editing: null }); },
          onEdit: () => this.setState({ editing: r.id }),
          onRemove: () => this._remove(r.id),
        };
      }),

      addOpen: s.addOpen,
      onOpenAdd: () => this.setState({ addOpen: true }),
      onCloseAdd: () => this.setState({ addOpen: false }),
      catalogue: Object.keys(TYPES).map(key => {
        const t = TYPES[key];
        const used = !t.repeatable && s.rules.some(r => r.type === key);
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

      ...this._tokenPickerVals(),

      intervalOn: s.intervalOn,
      onIntervalOn: v => { this.setState({ intervalOn: v }); this._emit(s.rules, { intervalOn: v }); },
      intervalHint: s.intervalOn ? "Checked every " + s.every + "." : "Members are checked once, when they join.",
      intervals: INTERVALS,
      every: s.every,
      onEvery: v => { this.setState({ every: v }); this._emit(s.rules, { every: v }); },
    };
  }
}

export default Component;

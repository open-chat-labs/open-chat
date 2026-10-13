<!-- Access gates editor ("who can join"): requirement rows read as sentences ("Members must hold …") with value chips,
     joined by AND / OR; configurable rows edit inline (asset pills, a searchable token / nervous-system picker, numeric fields).
     An optional periodic re-check sits below. Non-diamond users see an explainer and an upgrade banner; readOnly shows the
     requirements as facts. `value` restores the last state handed out by onChange, so gates survive the tab being remounted. -->
<script lang="ts" module>
  type Entry = { symbol: string; name: string };
  const parse = (list: string, sep: string): Entry[] =>
    list.split(sep).map((s) => {
      const [symbol, name] = s.split('|');
      return { symbol, name };
    });

  // full token directory behind the curated pills — searchable in the picker modal
  const DIRECTORY = parse('CHAT|OpenChat·ICP|Internet Computer·BTC|ckBTC — Bitcoin·ETH|ckETH — Ethereum·USDC|ckUSDC·USDT|ckUSDT·BOB|BOB·KINIC|Kinic·GLDGov|Gold DAO·OGY|Origyn·MOD|Modclub·BOOM|Boom DAO·CTZ|Catalyze·NUA|Nuance·TRAX|Trax·SONIC|Sonic·HOT|HotOrNot·GHOST|Ghost·ICL|ICLighthouse·ELNA|ELNA AI·NTN|Neutrinite·DCD|DecideAI·DKP|Dragginz Karma Points·ICS|ICPSwap·SEER|Seers·WTN|WaterNeuron·ALICE|ALICE DAO·YUKU|Yuku DAO·NFIDW|NFID Wallet·PANDA|ICPanda·TACO|TACO DAO·MOTOKO|Motoko·KONG|KongSwap·EXE|Windoge98·DOGMI|DOGMI·SNEED|Sneed DAO·NICP|Neuron ICP·CLOWN|Clown·ND64|ND64·TENDY|Tendy·DAMONIC|Damonic·WUMBO|Wumbo·CLOUD|Cloud·SWAMP|Swampies·FOMO|FOMO·ckLINK|ckLINK·ckUNI|ckUNI·ckPEPE|ckPEPE·ckSHIB|ckSHIB·ckWBTC|ckWBTC·ckWSTETH|ckwstETH·ckXAUT|ckXAUt·ckOCT|ckOCT·ckEURC|ckEURC·DAI|Dai·PYUSD|PayPal USD·FDUSD|First Digital USD·TUSD|TrueUSD·EURC|Euro Coin·SOL|Solana·BNB|BNB·XRP|XRP·ADA|Cardano·DOGE|Dogecoin·TRX|TRON·AVAX|Avalanche·DOT|Polkadot·MATIC|Polygon·LINK|Chainlink·TON|Toncoin·LTC|Litecoin·BCH|Bitcoin Cash·ATOM|Cosmos·NEAR|NEAR Protocol·APT|Aptos·SUI|Sui·FIL|Filecoin·TIA|Celestia·INJ|Injective·SEI|Sei·ARB|Arbitrum·OP|Optimism·STX|Stacks·RNDR|Render·GRT|The Graph·UNI|Uniswap·AAVE|Aave·MKR|Maker·LDO|Lido DAO·CRV|Curve DAO·SNX|Synthetix·COMP|Compound·BAL|Balancer·YFI|yearn.finance·SUSHI|SushiSwap·1INCH|1inch·CAKE|PancakeSwap·GMX|GMX·DYDX|dYdX·PENDLE|Pendle·ENA|Ethena·ETHFI|Ether.fi·EIGEN|EigenLayer·JUP|Jupiter·PYTH|Pyth Network·JTO|Jito·RAY|Raydium·ORCA|Orca·WIF|dogwifhat·BONK|Bonk·PEPE|Pepe·FLOKI|Floki·SHIB|Shiba Inu·BRETT|Brett·POPCAT|Popcat·MEW|cat in a dogs world·TURBO|Turbo·MOG|Mog Coin·ENS|Ethereum Name Service·IMX|Immutable·SAND|The Sandbox·MANA|Decentraland·AXS|Axie Infinity·GALA|Gala·CHZ|Chiliz·APE|ApeCoin·ILV|Illuvium·BLUR|Blur·LOOKS|LooksRare·RARE|SuperRare·FTM|Fantom·ALGO|Algorand·XLM|Stellar·HBAR|Hedera·VET|VeChain·EGLD|MultiversX·KAVA|Kava·RUNE|THORChain·OSMO|Osmosis·JUNO|Juno·SCRT|Secret·ROSE|Oasis·ONE|Harmony·CELO|Celo·KSM|Kusama·ZIL|Zilliqa·IOTA|IOTA·NEO|Neo·EOS|EOS·QNT|Quant·XMR|Monero·ZEC|Zcash·DASH|Dash·XTZ|Tezos·THETA|Theta·FLOW|Flow·MINA|Mina·KAS|Kaspa·TAO|Bittensor·FET|Artificial Superintelligence·AGIX|SingularityNET·OCEAN|Ocean Protocol·AKT|Akash·AR|Arweave·STORJ|Storj·HNT|Helium·IOTX|IoTeX·ANKR|Ankr·BAT|Basic Attention·ZRX|0x·KNC|Kyber Network·REN|Ren·BAND|Band Protocol·UMA|UMA·API3|API3·TRB|Tellor·NMR|Numeraire·RPL|Rocket Pool·FXS|Frax Share·SPELL|Spell·CVX|Convex·MPL|Maple·GNO|Gnosis·SAFE|Safe·ARKM|Arkham·WLD|Worldcoin·ZK|zkSync·STRK|Starknet·MANTA|Manta Network·METIS|Metis·BOBA|Boba Network·SKL|SKALE·CTSI|Cartesi·LRC|Loopring', '·');
  // SNS nervous systems — curated pills first, the rest searchable in the picker
  const SNS = parse('OpenChat|CHAT — messaging;Motoko|MOTOKO — developer tooling;ICPanda|PANDA — community;TACO DAO|TACO — treasury;Dragginz|DKP — game;WaterNeuron|WTN — liquid staking;Gold DAO|GLDGov — tokenized gold;Origyn|OGY — digital certificates;Modclub|MOD — moderation;Boom DAO|BOOM — gaming;Catalyze|CTZ — communities;Nuance|NUA — publishing;Trax|TRAX — music;Sonic|SONIC — DEX;HotOrNot|HOT — short video;Ghost|GHOST — meme;ICLighthouse|ICL — trading;ELNA AI|ELNA — AI agents;Neutrinite|NTN — analytics;DecideAI|DCD — AI;ICPSwap|ICS — DEX;Seers|SEER — prediction markets;ALICE DAO|ALICE — quant trading;Yuku DAO|YUKU — NFTs;NFID Wallet|NFIDW — identity;KongSwap|KONG — DEX;Sneed DAO|SNEED — community;Windoge98|EXE — meme;Cecil the Lion|CECIL — meme;FomoWell|FOMO — social;Swampies|SWAMP — game;Cycles Transfer Station|CTS — infrastructure;Personal DAO|PDAO — tooling;EstateDAO|EST — real estate;Kinic|KINIC — search;SNS-1|SNS1 — first SNS;Dolr AI|DOLR — video;Funded|FND — crowdfunding;CyclOps|CYC — cycles management;Konecta|KONECTA — AI;Pogo|POGO — social;Nuance Labs|NUAL — publishing', ';');
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import type { AccessGateRule, AccessGatesState } from '../../lib/types';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import UpgradeBanner from './UpgradeBanner.svelte';

  type Field = { key: 'a' | 'b'; placeholder: string; unit: string; required?: boolean };
  type Chip = { label: string; dot?: boolean | string };
  type GateType = {
    label: string;
    icon: string;
    desc: string;
    sentence: string;
    assetLabel?: string;
    assets?: string[];
    searchable?: boolean;
    picker?: 'token' | 'sns';
    pickerSub?: string;
    repeatable?: boolean;
    uniqueAsset?: boolean;
    fields?: Field[];
    chips?: (r: AccessGateRule) => Chip[];
    soon?: boolean;
  };

  const DOTS: Record<string, string> = {
    CHAT: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    ICP: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    BTC: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    BOB: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
    USDC: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    USDT: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    KINIC: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    Motoko: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    ICPanda: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
    TACO: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    'Dragging Karma Points': 'linear-gradient(140deg,#B06BFF,#6A2BFF)',
    'Internet Computer': 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
  };
  const GRADS = [
    '#2EE6A8,#1FB6FF', '#ff5f9e,#6a2bff', '#ffb03d,#ff4d4d', '#8E9BB3,#5A6478',
    '#5FA8FF,#8C6BFF', '#FF6B8B,#C13584', '#B06BFF,#6A2BFF', '#43E97B,#38F9D7',
    '#FA709A,#FEE140', '#4FACFE,#00F2FE', '#F093FB,#F5576C', '#30CFD0,#330867',
  ];
  // known tokens keep their brand colours; anything else gets a stable gradient from its name
  function dotFor(name: string) {
    if (DOTS[name]) return DOTS[name];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
    return `linear-gradient(140deg,${GRADS[h % GRADS.length]})`;
  }

  const TOKENS = ['CHAT', 'ICP', 'BTC', 'BOB', 'USDC', 'USDT'];
  const NERVOUS = ['OpenChat', 'ICPanda', 'Dragginz', 'WaterNeuron', 'Gold DAO'];

  const PICKERS = {
    token: { title: 'Select a token', search: 'Search by symbol or name', all: 'ALL TOKENS', empty: 'Try the symbol instead of the full name.', dir: DIRECTORY, more: 'More tokens', change: 'Change token' },
    sns: { title: 'Select a nervous system', search: 'Search nervous systems', all: 'ALL NERVOUS SYSTEMS', empty: 'Search by DAO name or token symbol.', dir: SNS, more: 'More systems', change: 'Change system' },
  };
  const entryName = (dir: Entry[], symbol: string) => dir.find((x) => x.symbol === symbol)?.name ?? symbol;
  const nonEmpty = (chips: (Chip | '' | false)[]) => chips.filter((c): c is Chip => !!c);

  const TYPES: Record<string, GateType> = {
    lifetime: { label: 'Lifetime diamond membership', icon: 'diamond', desc: 'Holders of a lifetime membership.', sentence: 'must hold a lifetime diamond membership' },
    diamond: { label: 'Diamond membership', icon: 'diamond-outline', desc: 'Anyone with an active diamond membership.', sentence: 'must have an active diamond membership' },
    neuron: {
      label: 'Neuron holder',
      icon: 'neuron',
      desc: 'Stake a neuron with specific criteria.',
      assetLabel: 'NERVOUS SYSTEM',
      assets: NERVOUS,
      searchable: true,
      picker: 'sns',
      repeatable: true,
      pickerSub: 'Members must stake a neuron in this nervous system.',
      fields: [
        { key: 'a', placeholder: 'Minimum dissolve delay (optional)', unit: 'days' },
        { key: 'b', placeholder: 'Minimum stake (optional)', unit: 'tokens' },
      ],
      sentence: 'must stake a neuron',
      chips: (r) => nonEmpty([r.asset && { label: r.asset, dot: true }, r.a && { label: `${r.a}d dissolve delay` }, r.b && { label: `${r.b} staked` }]),
    },
    payment: {
      label: 'Payment',
      icon: 'payment',
      desc: 'Pay a one-time or recurring entry fee.',
      assetLabel: 'TOKEN',
      assets: TOKENS,
      searchable: true,
      picker: 'token',
      repeatable: true,
      pickerSub: 'Members pay the entry fee in this token.',
      fields: [{ key: 'a', placeholder: 'Amount', unit: 'tokens', required: true }],
      sentence: 'must pay an entry fee',
      chips: (r) =>
        r.asset && r.a ? [{ label: `${r.a} ${r.asset}`, dot: r.asset }] : nonEmpty([r.asset && { label: r.asset, dot: r.asset }, r.a && { label: r.a }]),
    },
    balance: {
      label: 'Minimum token balance',
      icon: 'balance',
      desc: 'Hold a minimum amount of a token.',
      assetLabel: 'TOKEN',
      assets: TOKENS,
      searchable: true,
      picker: 'token',
      repeatable: true,
      uniqueAsset: true,
      pickerSub: 'Members must hold a balance of this token.',
      fields: [{ key: 'a', placeholder: 'Minimum balance', unit: 'tokens', required: true }],
      sentence: 'must hold a minimum token balance',
      chips: (r) =>
        r.asset && r.a
          ? [{ label: `min ${r.a} ${r.asset}`, dot: r.asset }]
          : nonEmpty([r.asset && { label: r.asset, dot: r.asset }, r.a && { label: `min ${r.a}` }]),
    },
    credential: { label: 'Verified credential', icon: 'credential', desc: 'Present a valid external credential.', sentence: 'must present a verified credential' },
    unique: { label: 'Unique person', icon: 'person', desc: 'Verified unique human.', sentence: 'must be a verified unique person' },
    locked: { label: 'Locked', icon: 'lock', desc: 'Invited users only.', sentence: 'must be invited — the group is locked' },
    chit: {
      label: 'Minimum CHIT earned',
      icon: 'chit',
      desc: 'Earn a minimum amount of CHIT.',
      fields: [{ key: 'a', placeholder: 'Minimum CHIT earned', unit: 'CHIT', required: true }],
      sentence: 'must have earned a minimum amount of CHIT',
      chips: (r) => (r.a ? [{ label: `${r.a} CHIT` }] : []),
    },
    nft: { label: 'NFT holder', icon: 'nft', desc: 'Hold a specific NFT.', soon: true, sentence: 'must hold a specific NFT' },
  };

  const JOINERS = ['All', 'Any'];
  const INTERVALS = ['1 day', '1 week', '2 weeks', '1 month', '3 months', '6 months'];
  const mask = (icon: string) => `var(--icon-${icon}) center/contain no-repeat`;

  const LOCKED_WHY = [
    { icon: 'shield', title: 'Keep out spam and bots', body: 'Require a verified unique person or earned CHIT.' },
    { icon: 'balance', title: 'Reward your holders', body: 'Open the group only to people holding your token or staking in your DAO.' },
    { icon: 'payment', title: 'Charge for entry', body: 'Set a one-time or recurring fee, paid in any supported token.' },
  ];
  const LOCKED_EXAMPLE = [
    { icon: 'balance', sentence: TYPES.balance.sentence, chip: '500 CHAT', dot: DOTS.CHAT },
    { icon: 'person', sentence: TYPES.unique.sentence, chip: 'Unique person', dot: '' },
  ];

  interface Props {
    /** false shows the explainer and upgrade banner instead of the editor (ignored when readOnly). */
    isDiamond?: boolean;
    /** Members' view: requirements as facts, nothing to change. */
    readOnly?: boolean;
    /** State last handed out by onChange; read once, on mount. */
    value?: Partial<AccessGatesState> | null;
    onUpgrade?: () => void;
    onChange?: (state: AccessGatesState) => void;
  }

  let { isDiamond = true, readOnly = false, value = null, onUpgrade, onChange }: Props = $props();

  // the host can hand back the state it was last given, so gates survive the tab being unmounted and remounted
  const initial = untrack(() => value) ?? {};
  let rules = $state<AccessGateRule[]>(Array.isArray(initial.rules) ? initial.rules : []);
  let joiner = $state(initial.joiner || 'All');
  let editing = $state<string | null>(null);
  let addOpen = $state(false);
  let intervalOn = $state(!!initial.intervalOn);
  let every = $state(initial.every || '1 month');
  let tokenFor = $state<string | null>(null);
  let tokenQuery = $state('');

  const locked = $derived(!readOnly && !isDiamond);
  const recurring = $derived(intervalOn && rules.length > 0);

  function emit() {
    onChange?.({ count: rules.length, joiner, rules, intervalOn, every });
  }

  function add(key: string) {
    const t = TYPES[key];
    if (t.soon) return;
    const rule = { id: `r${Date.now()}`, type: key, asset: '', a: '', b: '' };
    rules = [...rules, rule];
    addOpen = false;
    editing = t.fields || t.assets ? rule.id : null;
    emit();
  }

  function patch(id: string, change: Partial<AccessGateRule>) {
    rules = rules.map((r) => (r.id === id ? { ...r, ...change } : r));
    emit();
  }

  function remove(id: string) {
    rules = rules.filter((r) => r.id !== id);
    if (editing === id) editing = null;
    emit();
  }

  function complete(r: AccessGateRule) {
    const t = TYPES[r.type];
    if (t.assets && !r.asset) return false;
    return !(t.fields ?? []).some((f) => f.required && !r[f.key].trim());
  }

  const takenBy = (r: AccessGateRule, asset: string) => !!TYPES[r.type].uniqueAsset && rules.some((x) => x.type === r.type && x.asset === asset && x.id !== r.id);

  const summary = $derived(
    rules.length === 0
      ? 'No requirements — anyone you invite or who finds the group can join.'
      : rules.length === 1
        ? 'Members must satisfy the requirement below.'
        : `Members must satisfy ${joiner === 'All' ? 'all' : 'any'} of the ${rules.length} requirements below.`,
  );

  // token / nervous-system picker for the rule in tokenFor
  const picking = $derived(rules.find((r) => r.id === tokenFor) ?? null);
  const picker = $derived.by(() => {
    if (!picking) return null;
    const t = TYPES[picking.type];
    const P = PICKERS[t.picker ?? 'token'];
    const q = tokenQuery.trim().toLowerCase();
    const matches = q ? P.dir.filter((tk) => tk.symbol.toLowerCase().includes(q) || tk.name.toLowerCase().includes(q)) : null;
    const groups = matches
      ? matches.length
        ? [{ label: `${matches.length}${matches.length === 1 ? ' RESULT' : ' RESULTS'}`, tokens: matches }]
        : []
      : [
          { label: 'MOST USED', tokens: (t.assets ?? []).map((symbol) => ({ symbol, name: entryName(P.dir, symbol) })) },
          { label: `${P.all} · ${P.dir.length}`, tokens: P.dir },
        ];
    return { rule: picking, P, sub: t.pickerSub ?? '', groups, none: !!matches && matches.length === 0 };
  });

  function closePicker() {
    tokenFor = null;
    tokenQuery = '';
  }

  function pickToken(rule: AccessGateRule, symbol: string) {
    if (takenBy(rule, symbol)) return;
    patch(rule.id, { asset: symbol });
    closePicker();
  }
</script>

{#snippet joinerLine(label: string)}
  <div class="joiner">
    <span class="joiner-label">{label}</span>
    <span class="joiner-rule"></span>
  </div>
{/snippet}

{#snippet badge(icon: string)}
  <span class="badge"><span class="badge-icon" style:mask={mask(icon)}></span></span>
{/snippet}

<div class="gates">
  {#if locked}
    <div class="section">
      <span class="label">WHAT ARE ACCESS GATES</span>
      <span class="intro">Gates are conditions people must meet before they can join. OpenChat checks them automatically, so you don't have to screen members by hand.</span>
    </div>

    <div class="why">
      {#each LOCKED_WHY as w}
        <div class="why-row">
          <span class="why-tile"><span class="why-icon" style:mask={mask(w.icon)}></span></span>
          <div class="why-text">
            <span class="why-title">{w.title}</span>
            <span class="why-body">{w.body}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="section">
      <span class="label">EXAMPLE</span>
      <div class="example">
        {#each LOCKED_EXAMPLE as r, i}
          {#if i > 0}{@render joinerLine('AND')}{/if}
          <div class="rule-card example-card">
            {@render badge(r.icon)}
            <div class="sentence-line">
              <span class="sentence">Members <span class="sentence-strong">{r.sentence}</span></span>
              <span class="chip">
                {#if r.dot}<span class="chip-dot" style:background={r.dot}></span>{/if}
                <span class="chip-label">{r.chip}</span>
              </span>
            </div>
          </div>
        {/each}
      </div>
      <span class="example-note">A holders' group: only people with 500 CHAT and a verified unique identity can join.</span>
    </div>

    <UpgradeBanner text="Access gates are a Diamond feature." {onUpgrade} />
  {:else}
    <div class="head">
      <div class="head-text">
        <span class="label">WHO CAN JOIN</span>
        <span class="summary">{summary}</span>
      </div>
      {#if !readOnly && rules.length > 0}
        <div class="joiners">
          <SegmentedTabs
            labels={JOINERS}
            selectedIndex={JOINERS.indexOf(joiner)}
            dotIndexes={[]}
            onSelect={(i) => {
              joiner = JOINERS[i];
              emit();
            }}
          />
        </div>
      {/if}
    </div>

    <div class="rules">
      {#each rules as r, i}
        {@const t = TYPES[r.type]}
        {@const ok = complete(r)}
        {@const open = editing === r.id}
        {@const chips = t.chips?.(r) ?? []}
        <div class="rule">
          {#if i > 0}{@render joinerLine(joiner === 'All' ? 'AND' : 'OR')}{/if}
          <!-- collapsed rows are one line, so the icon centres against it; the open editor grows downward and must top-align -->
          <div class="rule-card" class:open class:incomplete={!ok}>
            {@render badge(t.icon)}
            <div class="rule-body">
              <div class="sentence-line">
                <span class="sentence">Members <span class="sentence-strong">{t.sentence}</span></span>
                {#if !open}
                  {#each chips as chip}
                    <span class="chip">
                      {#if chip.dot}<span class="chip-dot" style:background={dotFor(chip.dot === true ? chip.label : chip.dot)}></span>{/if}
                      <span class="chip-label">{chip.label}</span>
                    </span>
                  {/each}
                {/if}
              </div>

              {#if open && !readOnly}
                <div class="editor">
                  {#if t.assets}
                    {@const P = PICKERS[t.picker ?? 'token']}
                    {@const shown = t.searchable && r.asset && !t.assets.includes(r.asset) ? [...t.assets, r.asset] : t.assets}
                    <div class="asset-block">
                      <span class="asset-label">{t.assetLabel ?? ''}</span>
                      <div class="assets">
                        {#each shown as name}
                          {@const taken = takenBy(r, name)}
                          <span class="asset" class:selected={r.asset === name} class:unavailable={taken} onclick={() => !taken && patch(r.id, { asset: name })} role="button" tabindex="0">
                            <span class="asset-dot" style:background={dotFor(name)}></span>
                            <span>{taken ? `${name} (used)` : name}</span>
                          </span>
                        {/each}
                        {#if t.searchable}
                          <span
                            class="browse"
                            onclick={() => {
                              tokenFor = r.id;
                              tokenQuery = '';
                            }}
                            role="button"
                            tabindex="0"
                          >
                            <span class="browse-icon"></span>
                            <span>{r.asset && !t.assets.includes(r.asset) ? P.change : P.more}</span>
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  {#each t.fields ?? [] as f}
                    <div class="field" class:missing={f.required && !r[f.key].trim()}>
                      <input value={r[f.key]} oninput={(e) => patch(r.id, { [f.key]: e.currentTarget.value.replace(/[^\d.]/g, '') })} placeholder={f.placeholder} inputmode="numeric" />
                      <span class="unit">{f.unit}</span>
                    </div>
                  {/each}

                  <div class="editor-actions">
                    <div class="done" class:ready={ok} onclick={() => ok && (editing = null)} role="button" tabindex="0">Done</div>
                    <div class="remove-text" onclick={() => remove(r.id)} role="button" tabindex="0">Remove</div>
                  </div>
                </div>
              {/if}
            </div>

            {#if !open && !readOnly}
              <div class="tools">
                {#if t.fields || t.assets}
                  <span class="tool" onclick={() => (editing = r.id)} role="button" tabindex="0" aria-label="Edit" title="Edit"><span class="tool-icon" style:mask={mask('edit')}></span></span>
                {/if}
                <span class="tool" onclick={() => remove(r.id)} role="button" tabindex="0" aria-label="Remove" title="Remove"><span class="tool-icon" style:mask={mask('close')}></span></span>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if rules.length === 0}
        <div class="empty">
          <span class="empty-title">Anyone invited can join</span>
          <span class="empty-hint">{readOnly ? 'There are no extra requirements to join.' : 'Add a requirement to gate the group. People you invite directly never have to pass gates.'}</span>
        </div>
      {/if}
    </div>

    {#if !readOnly}
      <div class="add" onclick={() => (addOpen = true)} role="button" tabindex="0">
        <span class="add-icon"></span>
        <span>Add requirement</span>
      </div>
    {/if}

    <div class="divider"></div>

    {#if readOnly}
      <div class="recheck">
        <span class="why-tile"><span class="why-icon" style:mask={mask('refresh')}></span></span>
        <div class="recheck-text">
          <span class="recheck-title">{recurring ? `Re-checked every ${every}` : 'Checked once, when members join'}</span>
          <span class="recheck-body"
            >{recurring
              ? `Every ${every}, members are checked against these requirements again. Anyone who no longer meets them is marked as lapsed.`
              : "Members don't need to keep meeting these requirements after they've joined."}</span
          >
        </div>
      </div>
    {:else}
      <div class="recheck-edit">
        <div class="cell">
          <TimedToggle
            density="flush"
            label="Re-check members periodically"
            prefix="Every"
            offHint="Members are checked once, when they join."
            on={intervalOn}
            value={every}
            options={INTERVALS}
            onChange={(on) => {
              intervalOn = on;
              emit();
            }}
            onDurationChange={(next) => {
              every = next;
              emit();
            }}
          />
        </div>
      </div>
    {/if}
  {/if}

  {#if addOpen}
    <div class="modal-layer" role="dialog" aria-modal="true">
      <div class="scrim" onclick={() => (addOpen = false)} aria-hidden="true"></div>
      <div class="modal">
        <div class="modal-head">
          <span class="modal-title">Add a requirement</span>
          <span class="close" onclick={() => (addOpen = false)} role="button" tabindex="0"><span class="tool-icon" style:mask={mask('close')}></span></span>
        </div>
        <div class="catalogue">
          {#each Object.entries(TYPES) as [key, t]}
            {@const used = !t.repeatable && rules.some((r) => r.type === key)}
            <div class="option" class:unavailable={t.soon || used} onclick={() => !used && add(key)} role="button" tabindex="0">
              <span class="option-tile"><span class="option-icon" style:mask={mask(t.icon)}></span></span>
              <div class="option-text">
                <div class="option-line">
                  <span class="option-label">{t.label}</span>
                  {#if t.soon}<span class="pill">SOON</span>{/if}
                </div>
                <span class="option-desc">{used ? 'Already added' : t.desc}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if picker}
    <div class="modal-layer token-layer" role="dialog" aria-modal="true">
      <div class="scrim" onclick={closePicker} aria-hidden="true"></div>
      <div class="modal token-modal">
        <div class="modal-head">
          <div class="token-head">
            <span class="modal-title">{picker.P.title}</span>
            <span class="token-sub">{picker.sub}</span>
          </div>
          <span class="close" onclick={closePicker} role="button" tabindex="0"><span class="tool-icon" style:mask={mask('close')}></span></span>
        </div>

        <div class="token-search-wrap">
          <div class="token-search">
            <span class="search-icon"></span>
            <!-- svelte-ignore a11y_autofocus -->
            <input bind:value={tokenQuery} placeholder={picker.P.search} autofocus={true} />
            {#if tokenQuery.length > 0}
              <span class="clear" onclick={() => (tokenQuery = '')} role="button" tabindex="0"><span class="clear-icon"></span></span>
            {/if}
          </div>
        </div>

        <div class="token-list">
          {#each picker.groups as group}
            <div class="token-group">
              <span class="token-group-label">{group.label}</span>
              {#each group.tokens as tk}
                {@const taken = takenBy(picker.rule, tk.symbol)}
                {@const selected = picker.rule.asset === tk.symbol}
                <div class="token" class:selected class:taken onclick={() => pickToken(picker.rule, tk.symbol)} role="button" tabindex="0">
                  <span class="token-dot" style:background={dotFor(tk.symbol)}></span>
                  <div class="token-text">
                    <span class="token-symbol">{tk.symbol}</span>
                    <span class="token-name">{taken ? `${tk.name} — already gated` : tk.name}</span>
                  </div>
                  {#if taken}<span class="pill in-use">IN USE</span>{/if}
                  {#if selected}<span class="check"><span class="check-icon"></span></span>{/if}
                </div>
              {/each}
            </div>
          {/each}
          {#if picker.none}
            <div class="empty">
              <span class="empty-title">Nothing matches “{tokenQuery}”</span>
              <span class="empty-hint centered">{picker.P.empty}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .gates {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  .label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3, #9a9aa8);
  }

  .intro,
  .summary {
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .summary {
    line-height: 1.5;
  }

  .why {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .why-row {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    min-height: 56px;
    padding: var(--space-10) var(--space-16);
    box-sizing: border-box;
  }

  .why-row + .why-row {
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .why-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .why-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
  }

  .why-text,
  .recheck-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .why-title {
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .why-body {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .example {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
    pointer-events: none;
  }

  .example-note {
    padding-inline: var(--space-4);
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .joiner {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding-inline: var(--space-18);
  }

  .joiner-label {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--accent-bright, #ff8298);
  }

  .joiner-rule {
    flex: 1;
    height: 1px;
    background: var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .rule-card {
    --rule-line: var(--line-2, rgba(255, 255, 255, 0.08));
    --rule-ink: var(--status-verified, #3d9bff);
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-14) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--rule-line);
  }

  .rule-card.open {
    align-items: flex-start;
  }

  .rule-card.incomplete {
    --rule-line: color-mix(in srgb, var(--status-warning, #ffb03d) 45%, transparent);
    --rule-ink: var(--status-warning, #ffb03d);
  }

  .example-card {
    --rule-line: var(--line-1, rgba(255, 255, 255, 0.07));
    --rule-ink: var(--ink-2, #c9c9d4);
    padding: var(--space-14);
  }

  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .badge-icon {
    width: 17px;
    height: 17px;
    background: var(--rule-ink);
  }

  .rule-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .sentence-line {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8) var(--space-6);
    min-width: 0;
  }

  .sentence {
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .sentence-strong {
    font-weight: var(--weight-semibold);
    color: var(--ink, #ececf1);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-4) var(--space-10);
    border-radius: var(--radius-sm);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .chip-dot {
    flex: none;
    width: 13px;
    height: 13px;
    border-radius: var(--radius-pill);
  }

  .chip-label {
    font: var(--weight-medium) var(--text-sm) / 1.45 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-12) var(--space-16);
    min-width: 0;
  }

  .head-text {
    flex: 1 1 240px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .joiners {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 190px;
  }

  .rules,
  .rule {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
    padding-top: var(--space-2);
  }

  .asset-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .asset-label {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .assets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    min-width: 0;
  }

  .asset,
  .browse {
    display: inline-flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-10);
    border-radius: var(--radius-pill);
    font: var(--weight-semibold) var(--text-sm) / 1.2 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .asset {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    color: var(--ink-2, #c9c9d4);
  }

  .asset.selected {
    background: color-mix(in srgb, var(--accent, #ff5672) 12%, transparent);
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
    color: var(--accent-bright, #ff8298);
  }

  .asset.unavailable {
    color: var(--ink-4, #7c7c8c);
    cursor: not-allowed;
  }

  .asset-dot {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-pill);
  }

  .browse {
    border: 1px dashed var(--line-2, rgba(255, 255, 255, 0.18));
    color: var(--accent, #ff5672);
  }

  .browse:hover,
  .add:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .browse-icon {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--accent, #ff5672);
    mask: var(--icon-search) center/contain no-repeat;
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
    max-width: 320px;
    padding: 0 var(--space-12);
    height: 42px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .field.missing {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-warning, #ffb03d) 50%, transparent);
  }

  .field input,
  .token-search input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .unit {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .editor-actions {
    display: flex;
    gap: var(--space-8);
    min-width: 0;
  }

  .done,
  .remove-text {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    user-select: none;
  }

  .done {
    padding: 0 var(--space-14);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    color: var(--ink-4, #7c7c8c);
    cursor: not-allowed;
  }

  .done.ready {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
  }

  .remove-text {
    padding: 0 var(--space-12);
    color: var(--status-danger, #f5493d);
    cursor: pointer;
  }

  .remove-text:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .tools {
    flex: none;
    display: flex;
    gap: 2px;
  }

  .tool,
  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .close {
    flex: none;
    width: 30px;
    height: 30px;
  }

  .tool:hover,
  .close:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .tool-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-26) var(--space-18);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    border: 1px dashed var(--line-2, rgba(255, 255, 255, 0.14));
  }

  .token-list .empty {
    gap: var(--space-6);
  }

  .empty-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .empty-hint {
    max-width: 340px;
    text-align: center;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .empty-hint.centered {
    max-width: none;
  }

  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 44px;
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    border: 1px dashed var(--line-2, rgba(255, 255, 255, 0.18));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .add-icon {
    width: 15px;
    height: 15px;
    background: var(--accent, #ff5672);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .divider {
    height: 1px;
    background: var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .recheck {
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
    min-width: 0;
  }

  .recheck-text {
    gap: 4px;
    padding-top: 2px;
  }

  .recheck-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .recheck-body {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .recheck-edit {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .modal-layer {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .token-layer {
    z-index: 90;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
  }

  .modal {
    position: relative;
    width: 100%;
    max-width: 480px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 30px 70px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }

  .token-modal {
    max-width: 440px;
    height: min(560px, 100%);
  }

  .modal-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .modal-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .token-head {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .token-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .catalogue {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-12);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option {
    --option-ink: var(--ink, #ececf1);
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-12);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .option.unavailable {
    --option-ink: var(--ink-4, #7c7c8c);
    cursor: not-allowed;
  }

  .option:hover,
  .token:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .option-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .option-icon {
    width: 17px;
    height: 17px;
    background: var(--option-ink);
  }

  .option-text,
  .token-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option-line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .option-label {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--option-ink);
  }

  .option-desc {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .pill {
    flex: none;
    padding: 1px var(--space-6);
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-2xs) / 1.4 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .pill.in-use {
    padding: 2px var(--space-8);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .token-search-wrap {
    flex: none;
    padding: var(--space-12) var(--space-12) var(--space-6);
  }

  .token-search {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 42px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .search-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-search) center/contain no-repeat;
  }

  .clear {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    cursor: pointer;
  }

  .clear-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .token-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-6) var(--space-12) var(--space-12);
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .token-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .token-group-label {
    padding: var(--space-6) var(--space-8);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .token {
    --token-ink: var(--ink, #ececf1);
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-8) var(--space-8);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .token.selected {
    --token-ink: var(--accent-bright, #ff8298);
    background: color-mix(in srgb, var(--accent, #ff5672) 10%, transparent);
  }

  .token.taken {
    --token-ink: var(--ink-4, #7c7c8c);
    cursor: not-allowed;
  }

  .token-dot {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
  }

  .taken .token-dot {
    opacity: 0.4;
  }

  .token-symbol {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-mono);
    color: var(--token-ink);
  }

  .token-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .check {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-pill);
    background: var(--accent, #ff5672);
  }

  .check-icon {
    width: 12px;
    height: 12px;
    background: var(--on-accent, #2e0512);
    mask: var(--icon-check) center/contain no-repeat;
  }
</style>

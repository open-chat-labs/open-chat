<!-- Diamond membership, the body of DiamondDialog and of a page (the /diamond page): compare Free vs Diamond → pick a
     duration and the token to pay with → confirm (auto-renew for timed plans) → pay. Members see their benefits and can
     extend; extensions start from the current expiry. Prices and limits come from the host: per token (`tokenPrices`,
     the backend's own price in each, so only those tokens are offered), or in CHAT (`prices`), converted to other
     payable tokens at their USD price. A token's approval fee (`approvalFees`) counts towards what it can afford and
     shows in the summary. Paying calls onUpgrade and waits: the member view only shows once it resolves, a rejection
     stays on confirm with an error. Its closing and paying go through `flow` (the dialog's, for its exit and Esc). -->
<script lang="ts" module>
  export type PlanKey = '1m' | '3m' | '1y' | 'life';

  export interface DiamondPurchase {
    lifetime: boolean;
    /** Requested end (ISO date) for timed plans; the host's resolved value wins. */
    until: string | null;
    autoRenew: boolean;
    plan: PlanKey;
    token: string;
    amount: number;
  }

  export interface DiamondLimits {
    privateGroups: { free: number; diamond: number };
    publicGroups: number;
    /** Storage multiplier over the free plan, e.g. 10 (shown as "10×"). */
    storageMultiplier: number;
  }
</script>

<script lang="ts">
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { getI18n, useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';
  import { onDestroy, onMount } from 'svelte';
  import type { WalletToken } from '../../lib/types';
  import Toggle from '../../lib/components/Toggle.svelte';
  import CopyButton from '../../lib/components/CopyButton.svelte';

  // [label, icon, free (true | false | text), diamond (true | text)]
  type Row = [string, string, boolean | string, boolean | string];
  // labels and text cells are resource keys (plain numbers render as themselves); the group limits come from `limits`
  const groupsFor = (l: DiamondLimits): { label: string; rows: Row[] }[] => [
    {
      label: 'ui.diamondDialog.group.messaging',
      rows: [
        ['ui.diamondDialog.feature.textMessages', 'chat', true, true],
        ['ui.diamondDialog.feature.gifs', 'gif', true, true],
        ['ui.diamondDialog.feature.reactions', 'emoji', true, true],
        ['ui.diamondDialog.feature.polls', 'poll', true, true],
        ['ui.diamondDialog.feature.reminders', 'clock', true, true],
        ['ui.diamondDialog.feature.sendCrypto', 'coin', true, true],
        ['ui.diamondDialog.feature.videoCalls', 'video', false, true],
        ['ui.diamondDialog.feature.translations', 'lang', false, true],
        ['ui.diamondDialog.feature.notifications', 'bell', 'ui.diamondDialog.value.mobileDesktop', 'ui.diamondDialog.value.mobileDesktop'],
      ],
    },
    {
      label: 'ui.diamondDialog.group.media',
      rows: [
        ['ui.diamondDialog.feature.mediaMessages', 'image', 'ui.diamondDialog.value.mediaFree', 'ui.diamondDialog.value.mediaDiamond'],
        ['ui.diamondDialog.feature.storage', 'disk', 'ui.diamondDialog.value.storageFree', 'ui.diamondDialog.value.storageDiamond'],
      ],
    },
    {
      label: 'ui.diamondDialog.group.groups',
      rows: [
        ['ui.diamondDialog.feature.directChats', 'dm', true, true],
        ['ui.diamondDialog.feature.privateGroups', 'lock', String(l.privateGroups.free), String(l.privateGroups.diamond)],
        ['ui.diamondDialog.feature.publicGroups', 'globe', false, String(l.publicGroups)],
        ['ui.diamondDialog.feature.gatedGroups', 'gate', false, true],
        ['ui.diamondDialog.feature.createCommunities', 'community', false, true],
      ],
    },
    {
      label: 'ui.diamondDialog.group.extras',
      rows: [
        ['ui.diamondDialog.feature.p2pSwaps', 'swap', false, true],
        ['ui.diamondDialog.feature.diamondBadge', 'gem', false, true],
        ['ui.diamondDialog.feature.airdrops', 'party', false, 'ui.diamondDialog.value.eligible'],
      ],
    },
  ];
  // plan lengths; prices come from the `prices` prop and a plan without one isn't offered
  // copy for each plan is selected by its key in the messages (ui.diamondDialog.plan*)
  const PLAN_MONTHS: { key: PlanKey; months: number }[] = [
    { key: '1m', months: 1 },
    { key: '3m', months: 3 },
    { key: '1y', months: 12 },
    { key: 'life', months: 0 },
  ];
  const DEFAULT_LIMITS: DiamondLimits = { privateGroups: { free: 5, diamond: 25 }, publicGroups: 10, storageMultiplier: 10 };
  const DAY = 86400000;
  // dates in the host's locale; plain 'en' keeps the day-month order ('28 Sep 2026')
  const dateLocale = () => (i18n.locale && i18n.locale !== 'en' ? i18n.locale : 'en-GB');
  const fmtDate = (d: Date) => d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  const addMonths = (d: Date, n: number) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  };
  const dp = (n: number) => (n >= 1 ? 2 : n >= 0.01 ? 4 : n >= 0.0001 ? 6 : 8);
  const fmtAmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString(i18n.locale ?? 'en') : n.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: n >= 1 ? 2 : 0, maximumFractionDigits: dp(n) });

  // membership: timed members must say when it ends; lifetime members never expire (no date is shown)
  type Membership =
    | { isDiamond?: false; lifetime?: false; memberUntil?: undefined }
    | { isDiamond: true; lifetime: true; memberUntil?: undefined }
    | { isDiamond: true; lifetime?: false; /** Current membership end (ISO date). */ memberUntil: string };

  interface BaseProps {
    /** Wallet tokens; the payable ones can pay. */
    tokens: WalletToken[];
    /** CHAT balance (other tokens use their own `held`). */
    balance: number;
    /** Plan prices in CHAT, from the backend. Plans without a price aren't offered. */
    prices: Partial<Record<PlanKey, number>>;
    /** USD price of one CHAT, to convert prices for other payable tokens; defaults to the CHAT token's `price`.
     *  Without either, only CHAT can pay. */
    chatUsd?: number;
    /** Group and storage limits shown in the comparison. */
    limits?: DiamondLimits;
    /** Auto-renew starts on (opt-out) only when the host says so. */
    autoRenewDefault?: boolean;
    /** Opens straight on the plans step. */
    plan?: PlanKey | null;
    /** The user's own deposit address for topping up. Without it the Top up option is hidden. */
    depositAddress?: string;
    /** Shows a back arrow on the first step. */
    onBack?: () => void;
    /** Resource key (or literal text). */
    backLabel?: string;
    onClose?: () => void;
    /** Charge and activate. Resolve with the membership end the backend set (or nothing to keep `until`); reject to
     *  stay on the confirm step with an error; resolve `false` when nothing was bought and there's nothing to say here
     *  (the user backed out, or the host said why), staying on confirm. Without it the upgrade buttons are hidden. */
    onUpgrade?: (p: DiamondPurchase) => Promise<{ until?: string | null } | void | false> | void | false;
    /** Re-read balances (the host updates `tokens` / `balance`). Without it the refresh link is hidden. */
    onRefreshBalance?: () => Promise<unknown> | void;
    /** Plan prices per token symbol, the backend's own: only these tokens are offered, at these prices (no conversion).
     *  Takes the place of `prices` / `chatUsd`. */
    tokenPrices?: Record<string, Partial<Record<PlanKey, number>>>;
    /** The user's own deposit address per token symbol, for topping up the token chosen; takes the place of
     *  `depositAddress`. */
    depositAddresses?: Record<string, string>;
    /** The approval fee a payment from the wallet costs on top of the price, per token symbol (token units). */
    approvalFees?: Record<string, number>;
    /** The token chosen to pay with at first (CHAT, or ICP outside production), when it can pay. */
    defaultToken?: string;
    /** The dialog's flow (its exit, Esc), which paying and closing go through; a page leaves it out. */
    flow?: DialogFlow;
  }

  type Props = BaseProps & Membership;

  let {
    tokens,
    balance: chatBalance,
    prices,
    chatUsd: chatUsdProp,
    limits = DEFAULT_LIMITS,
    autoRenewDefault = false,
    plan: initialPlan = null,
    isDiamond = false,
    lifetime: lifetimeProp = false,
    depositAddress: depositAddressProp,
    memberUntil = '',
    onBack,
    backLabel = 'ui.common.back',
    onClose,
    onUpgrade,
    onRefreshBalance,
    tokenPrices,
    depositAddresses,
    approvalFees = {},
    defaultToken = 'CHAT',
    flow: flowProp,
  }: Props = $props();
  const t = useT();
  const i18n = getI18n();

  let onlyDiff = $state(false);
  let step = $state<'compare' | 'plans' | 'confirm'>('compare');
  let planKey = $state<PlanKey | null>(null);
  let autoRenew = $state(false);
  let refreshing = $state(false);
  let topUp = $state(false);
  let bought = $state<DiamondPurchase | null>(null);
  // svelte-ignore state_referenced_locally
  let tokenSymbol = $state(defaultToken);
  let picker = $state(false);

  onMount(() => {
    if (initialPlan) {
      step = 'plans';
      planKey = initialPlan;
    }
  });
  // paying / leaving / the exit: the shared dialog contract (lib/behaviours/dialog.svelte.ts), the dialog's when it has one
  // svelte-ignore state_referenced_locally
  const flow = flowProp ?? new DialogFlow();
  onDestroy(() => {
    if (!flowProp) flow.destroy();
  });
  const close = (then?: () => void) => flow.dismiss(then);

  // USD per CHAT: the host's figure, else the CHAT token's price; without one other tokens can't be priced
  const chatUsd = $derived(chatUsdProp ?? tokens.find((x) => x.symbol === 'CHAT')?.price ?? 0);
  // payable wallet tokens, CHAT first; CHAT's balance comes from `balance`
  const payable = $derived(
    tokens
      .filter((t) => t.payable && (tokenPrices ? t.symbol in tokenPrices : t.symbol === 'CHAT' || (chatUsd > 0 && t.price > 0)))
      .map((t) => ({ symbol: t.symbol, name: t.name, mark: t.mark, usd: t.price, held: t.symbol === 'CHAT' ? null : t.held, grad: t.grad }))
      .sort((x, y) => Number(y.symbol === 'CHAT') - Number(x.symbol === 'CHAT')),
  );
  const heldOf = (t: (typeof payable)[number]) => Math.max(0, t.held ?? chatBalance);
  const CHAT_ONLY = { symbol: 'CHAT', name: 'OpenChat', mark: 'C', usd: 0, held: null, grad: 'var(--accent)' };
  const tok = $derived(payable.find((t) => t.symbol === tokenSymbol) ?? payable[0] ?? CHAT_ONLY);
  const balance = $derived(heldOf(tok));
  const sym = $derived(tok.symbol);
  // the plans priced: in the chosen token's own prices, else in CHAT
  const priceList = $derived<Partial<Record<PlanKey, number>>>(tokenPrices ? (tokenPrices[tokenSymbol] ?? tokenPrices[tok.symbol] ?? {}) : prices);
  const PLANS = $derived(PLAN_MONTHS.filter((pl) => typeof priceList[pl.key] === 'number').map((pl) => ({ ...pl, price: priceList[pl.key] as number })));
  type Plan = { key: PlanKey; months: number; price: number };
  // converted prices round up (4 significant digits) so the charge never falls short of the CHAT price
  const roundUp = (n: number) => {
    const m = Math.pow(10, Math.max(0, 3 - Math.floor(Math.log10(n))));
    return Math.ceil(n * m) / m;
  };
  const cost = (pl: Plan) => (tokenPrices || tok.symbol === 'CHAT' ? pl.price : roundUp((pl.price * chatUsd) / tok.usd));
  // what paying takes from the wallet: the price and the approval made before it's pulled
  const fee = $derived(approvalFees[tok.symbol] ?? 0);
  // where the token chosen can be topped up
  const depositAddress = $derived(depositAddresses?.[tok.symbol] ?? depositAddressProp);
  const total = (pl: Plan) => cost(pl) + fee;
  const fmtToken = (n: number) => `${fmtAmt(n)} ${sym}`;

  const member = $derived(isDiamond || !!bought);
  const lifetime = $derived(bought ? bought.lifetime : lifetimeProp);
  const extend = $derived(member && !lifetime);
  const expiry = $derived.by(() => {
    if (bought?.until) return new Date(bought.until);
    const d = new Date(memberUntil);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const until = (pl: Plan) => addMonths(extend ? expiry : new Date(), pl.months);
  const plan = $derived(PLANS.find((x) => x.key === planKey) ?? PLANS[0]);
  const cheapest = $derived(PLANS.length ? Math.min(...PLANS.map(total)) : 0);
  const dearest = $derived(PLANS.length ? Math.max(...PLANS.map(total)) : 0);
  const canUpgrade = $derived(!!onUpgrade && PLANS.length > 0);

  const groups = $derived(
    groupsFor(limits).map((g) => ({ label: g.label, rows: g.rows.filter((r) => !onlyDiff || r[2] !== r[3]) })).filter((g) => g.rows.length),
  );

  const plans = $derived(
    PLANS.map((pl) => {
      const c = cost(pl), ok = balance >= total(pl);
      return {
        key: pl.key,
        label: t(extend ? 'ui.diamondDialog.planExtension' : 'ui.diamondDialog.planLabel', { plan: pl.key }),
        price: fmtToken(c),
        life: !pl.months,
        ok,
        sub: !ok
          ? t('ui.diamondDialog.needMore', { amount: fmtToken(+(total(pl) - balance).toPrecision(4)) })
          : !pl.months
            ? t(extend ? 'ui.diamondDialog.upgradeLifetime' : 'ui.diamondDialog.neverExpires')
            : t(extend ? 'ui.diamondDialog.extendTo' : 'ui.diamondDialog.until', { date: fmtDate(until(pl)) }),
      };
    }),
  );
  const isShort = $derived(balance < dearest);
  const price = $derived(plan ? cost(plan) : 0);
  const timed = $derived(!!plan?.months);
  const daysLeft = $derived(Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / DAY)));
  const confirmTitle = $derived(t(extend ? 'ui.diamondDialog.confirmTitleExtend' : 'ui.diamondDialog.confirmTitleNew', { plan: plan?.key }));
  const confirmBody = $derived(
    !timed
      ? t('ui.diamondDialog.lifetimeBody')
      : extend
        ? t('ui.diamondDialog.movesFromTo', { from: fmtDate(expiry), to: fmtDate(until(plan)) })
        : t('ui.diamondDialog.startsToday', { date: fmtDate(until(plan)) }),
  );
  const tokenList = $derived(payable.filter((t) => heldOf(t) > 0 || t.symbol === 'CHAT'));
  const subtitle = $derived(
    t(step === 'plans' ? (extend ? 'ui.diamondDialog.subExtend' : 'ui.diamondDialog.subChoose') : step === 'confirm' ? 'ui.diamondDialog.subConfirm' : member ? 'ui.diamondDialog.subMember' : 'ui.diamondDialog.subCompare'),
  );

  function back() {
    if (flow.locked) return;
    if (step === 'confirm') step = 'plans';
    else if (step === 'plans') {
      step = 'compare';
      topUp = false;
      picker = false;
    } else if (onBack) flow.handOff(onBack); // back to the dialog this one was opened from, over the same backdrop
  }

  function choose(key: PlanKey, ok: boolean) {
    if (!ok) return;
    step = 'confirm';
    planKey = key;
    autoRenew = autoRenewDefault;
    flow.failed = false;
  }

  // spins until the host has re-read the balances
  async function refresh() {
    if (refreshing || flow.closing || !onRefreshBalance) return;
    refreshing = true;
    try {
      await onRefreshBalance();
    } catch {
      // the old balance stays; the user can try again
    } finally {
      refreshing = false;
    }
  }

  async function pay() {
    if (!plan || !onUpgrade) return;
    const purchase: DiamondPurchase = {
      lifetime: !timed,
      until: timed ? until(plan).toISOString() : null,
      autoRenew: timed && autoRenew,
      plan: plan.key,
      token: sym,
      amount: price,
    };
    // ignored while paying or leaving (× then Pay must not charge)
    const run = await flow.run(() => onUpgrade(purchase));
    if (!run.ok) return;
    const result = run.value;
    // nothing bought, nothing to say: stays on confirm
    if (result === false) return;
    // balances come back from the host through `tokens` / `balance`
    bought = { ...purchase, until: result && result.until !== undefined ? result.until : purchase.until };
    step = 'compare';
  }
</script>

{#snippet icon(name: string, cls: string)}<span class="glyph {cls}" style:mask="var(--icon-{name}) center/contain no-repeat"></span>{/snippet}

{#snippet hero(title: string, body: string)}
  <div class="hero">
    <span class="hero-tile">{@render icon('gem', 'hero-icon')}</span>
    <div class="hero-text">
      <span class="hero-title">{title}</span>
      <span class="hero-body">{body}</span>
    </div>
  </div>
{/snippet}

{#snippet warn(title: string, body: string)}
  <div class="warn">
    {@render icon('warning', 'warn-icon')}
    <div class="warn-text">
      <span class="warn-title">{title}</span>
      <span class="warn-body">{body}</span>
    </div>
  </div>
{/snippet}

<div class="diamond">
  <div class="header">
    {#if step !== 'compare' || onBack}
      <span class="square back" onclick={back} aria-label={t(step === 'compare' ? backLabel : 'ui.common.back')} role="button" tabindex="0" title={t(step === 'compare' ? backLabel : 'ui.common.back')}
        >{@render icon('back', 'back-icon')}</span
      >
    {/if}
    <div class="header-text">
      <span class="header-title">{t('ui.diamondDialog.title')}</span>
      <span class="header-sub">{subtitle}</span>
    </div>
    <span class="square" onclick={() => close(onClose)} role="button" tabindex="0">{@render icon('close', 'close-icon')}</span>
  </div>

  {#if step === 'compare'}
    <div class="body">
      {@render hero(
        t(member ? 'ui.diamondDialog.heroMemberTitle' : 'ui.diamondDialog.heroTitle'),
        t(member ? 'ui.diamondDialog.heroMemberBody' : 'ui.diamondDialog.heroBody'),
      )}

      <div class="highlights">
        {#each [{ value: `${limits.storageMultiplier}×`, label: 'ui.diamondDialog.highlight.storage' }, { value: String(limits.privateGroups.diamond), label: 'ui.diamondDialog.highlight.privateGroups' }, { value: String(limits.publicGroups), label: 'ui.diamondDialog.highlight.publicGroups' }] as h}
          <div class="highlight">
            <span class="highlight-value">{h.value}</span>
            <span class="highlight-label">{t(h.label)}</span>
          </div>
        {/each}
      </div>

      <div class="compare">
        <div class="compare-head">
          <span class="eyebrow grow">{t('ui.diamondDialog.comparePlans')}</span>
          <div class="filters">
            {#each [{ label: 'ui.diamondDialog.filterAll', diff: false }, { label: 'ui.diamondDialog.filterDiff', diff: true }] as f}
              <span class="filter" class:on={onlyDiff === f.diff} onclick={() => (onlyDiff = f.diff)} role="button" tabindex="0">{t(f.label)}</span>
            {/each}
          </div>
        </div>

        <div class="table">
          <div class="diamond-band"></div>
          <div class="table-row table-head">
            <span></span>
            <span class="col-free">{t('ui.diamondDialog.free')}</span>
            <span class="col-diamond">{@render icon('gem', 'col-gem')}{t('ui.diamondDialog.diamond')}</span>
          </div>
          {#each groups as g, gi}
            <div class="group-label" class:divided={gi > 0}><span>{t(g.label)}</span></div>
            {#each g.rows as [label, glyph, free, pro]}
              <div class="table-row feature">
                <span class="feature-name">{@render icon(glyph, 'feature-icon')}<span class="feature-label">{t(label)}</span></span>
                <span class="cell">
                  {#if free === true}{@render icon('check', 'free-check')}{:else if free === false}<span class="dash"></span>{:else}<span class="free-text">{t(free)}</span>{/if}
                </span>
                <span class="cell">
                  {#if pro === true}{@render icon('check', 'pro-check')}{:else if typeof pro === 'string'}<span class="pro-text">{t(pro)}</span>{/if}
                </span>
              </div>
            {/each}
          {/each}
          <div class="table-end"></div>
        </div>
      </div>
    </div>
  {/if}

  {#if step === 'plans'}
    <div class="body step">
      {#if extend}
        <span class="extend-note"
          ><Translate key="ui.diamondDialog.extendNote">{#snippet days()}<span class="strong">{t('ui.diamondDialog.days', { count: daysLeft })}</span>{/snippet}{#snippet date()}<span class="strong">{fmtDate(expiry)}</span>{/snippet}</Translate></span
        >
      {/if}

      <div class="stack">
        <span class="eyebrow inset">{t('ui.diamondDialog.payWith')}</span>
        <div class="pay-row">
          <div class="token-wrap">
            <div class="token-button" class:open={picker} onclick={() => (picker = !picker)} role="button" tabindex="0">
              <span class="token-mark" style:background={tok.grad}>{tok.mark}</span>
              <div class="token-text">
                <span class="token-symbol">{tok.symbol}</span>
                <span class="token-balance">{t('ui.diamondDialog.available', { amount: fmtAmt(+balance.toFixed(dp(balance))) })}</span>
              </div>
              {@render icon('chevron-down', `token-caret${picker ? ' open' : ''}`)}
            </div>
            {#if picker}
              <div class="token-scrim" onclick={() => (picker = false)} role="presentation"></div>
              <div class="token-menu">
                {#each tokenList as tk}
                  <div
                    class="token-option"
                    class:current={tk.symbol === sym}
                    onclick={() => {
                      tokenSymbol = tk.symbol;
                      picker = false;
                      topUp = false;
                    }}
                    role="button"
                    tabindex="0"
                  >
                    <span class="token-mark small" style:background={tk.grad}>{tk.mark}</span>
                    <div class="token-text">
                      <span class="token-symbol">{tk.symbol}</span>
                      <span class="token-name">{tk.name}</span>
                    </div>
                    <span class="token-held">{fmtAmt(+heldOf(tk).toFixed(dp(heldOf(tk))))}</span>
                    {@render icon('check', 'token-check')}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          {#if isShort && depositAddress}
            <span class="top-up" class:open={topUp} onclick={() => (topUp = !topUp)} aria-label={t('ui.diamondDialog.topUp')} role="button" tabindex="0" title={t('ui.diamondDialog.topUp')}>{@render icon('qr', 'top-up-icon')}{t('ui.diamondDialog.topUp')}</span>
          {/if}
        </div>
        {#if topUp && depositAddress}
          <div class="address-box">
            <span class="address-hint">{t('ui.diamondDialog.addressHint', { symbol: tok.symbol })}</span>
            <div class="address-row">
              <span class="address">{depositAddress}</span>
              <CopyButton value={depositAddress} variant="text" />
            </div>
          </div>
        {/if}
        {#if PLANS.length && balance < cheapest}
          {@render warn(t('ui.diamondDialog.insufficientTitle'), t('ui.diamondDialog.insufficientBody', { amount: fmtToken(cheapest) }))}
        {/if}
      </div>

      <div class="stack">
        <span class="eyebrow inset">{t(extend ? 'ui.diamondDialog.availableOptions' : 'ui.diamondDialog.membershipDuration')}</span>
        <div class="plans">
          {#each plans as o}
            <div class="plan" class:life={o.life} class:short={!o.ok} onclick={() => choose(o.key, o.ok)} role="button" tabindex={o.ok ? 0 : -1}>
              <div class="plan-text">
                <span class="plan-label">{o.label}</span>
                <span class="plan-sub">{o.sub}</span>
              </div>
              <span class="plan-price">{o.price}</span>
              {@render icon('chevron-right', 'plan-chevron')}
            </div>
          {/each}
        </div>
        {#if isShort && onRefreshBalance}
          <span class="refresh" onclick={refresh} role="button" tabindex="0">{@render icon('refresh', `refresh-icon${refreshing ? ' spinning' : ''}`)}{refreshing ? t('ui.diamondDialog.refreshing') : t('ui.diamondDialog.refreshBalance', { symbol: sym })}</span>
        {/if}
      </div>
    </div>
  {/if}

  {#if step === 'confirm'}
    <div class="body step">
      {@render hero(confirmTitle, confirmBody)}

      {#if timed}
        <div class="renew">
          <div class="renew-row">
            <div class="renew-text">
              <span class="renew-title">{t('ui.diamondDialog.autoRenew')}</span>
              <span class="renew-help"
                >{autoRenew ? t('ui.diamondDialog.renewsEvery', { plan: plan.key, symbol: sym }) : t('ui.diamondDialog.noRenew')}</span
              >
            </div>
            <div class="renew-toggle"><Toggle on={autoRenew} ariaLabel="ui.diamondDialog.autoRenew" onChange={(on) => (autoRenew = on)} /></div>
          </div>
        </div>
        {#if !autoRenew}
          {@render warn(t('ui.diamondDialog.lossTitle'), t('ui.diamondDialog.lossBody'))}
        {/if}
      {/if}

      {#if flow.failed}
        <span class="pay-error" role="alert">{t('ui.diamondDialog.payFailed')}</span>
      {/if}

      <div class="summary">
        {#each [{ label: 'ui.diamondDialog.summary.amount', value: fmtToken(price), accent: true }, { label: 'ui.diamondDialog.summary.treasury', value: fmtToken(price), accent: false }, ...(fee > 0 ? [{ label: 'ui.diamondDialog.summary.approvalFee', value: fmtToken(fee), accent: false }] : []), { label: 'ui.diamondDialog.summary.after', value: fmtToken(+(balance - price - fee).toFixed(dp(balance))), accent: false }] as s}
          <div class="summary-row">
            <span class="summary-label">{t(s.label)}</span>
            <span class="summary-value" class:accent={s.accent}>{s.value}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="footer">
    {#if step === 'compare' && member}
      <span class="member-line"><span class="member-badge">{@render icon('check', 'member-check')}</span>{lifetime ? t('ui.diamondDialog.lifetimeMember') : t('ui.diamondDialog.memberUntil', { date: fmtDate(expiry) })}</span>
      {#if extend && canUpgrade}
        <span class="text-button accent" onclick={() => (step = 'plans')} role="button" tabindex="0">{t('ui.diamondDialog.extend')}</span>
      {/if}
      <span class="solid-button" onclick={() => close(onClose)} role="button" tabindex="0">{t('ui.common.done')}</span>
    {:else if step === 'compare'}
      <span class="text-button" onclick={() => close(onClose)} role="button" tabindex="0">{t('ui.diamondDialog.maybeLater')}</span>
      {#if canUpgrade}
        <span class="cta" onclick={() => (step = 'plans')} role="button" tabindex="0">{@render icon('gem', 'cta-icon')}{t('ui.diamondDialog.upgrade')}</span>
      {/if}
    {:else if step === 'plans'}
      <span class="footer-note">{t('ui.diamondDialog.footerNote')}</span>
      <span class="solid-button" onclick={back} role="button" tabindex="0">{t('ui.common.back')}</span>
    {:else}
      <span class="text-button" class:busy={flow.busy} onclick={back} role="button" tabindex="0">{t('ui.common.back')}</span>
      <span class="cta" class:busy={flow.busy} onclick={pay} role="button" tabindex="0" aria-disabled={flow.locked}
        >{@render icon(flow.busy ? 'spin' : 'gem', `cta-icon${flow.busy ? ' spinning' : ''}`)}{flow.busy
          ? t('ui.diamondDialog.processing')
          : t(extend ? 'ui.diamondDialog.confirmExtend' : 'ui.diamondDialog.confirmNew', { plan: plan.key })}</span
      >
    {/if}
  </div>
</div>

<style>

  /* fills what holds it: the dialog's card, or a page's column */
  .diamond {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .glyph {
    flex: none;
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-24) var(--space-32);
    border-block-end: 1px solid var(--line-1);
  }

  .square {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .square.back {
    width: 32px;
    height: 32px;
    margin-inline-start: -10px;
  }

  .square:hover {
    background: var(--overlay-2);
  }

  .back-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2);
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .header-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .header-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .header-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
    padding: var(--space-26) var(--space-32) var(--space-32);
  }

  .body.step {
    animation: oc-step-in var(--duration-base) var(--ease-out) both;
  }

  .hero {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-22);
  }

  .hero-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: var(--radius-lg);
    background: color-mix(in oklch, var(--accent) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 35%, transparent);
  }

  .hero-icon {
    width: 30px;
    height: 30px;
    background: var(--accent);
  }

  .hero-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hero-title {
    font: var(--weight-bold) 22px/1.2 var(--font-sans);
    letter-spacing: -0.015em;
    color: var(--ink);
    text-wrap: balance;
  }

  .hero-body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .highlights {
    flex: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .highlight {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
  }

  .highlight-value {
    font: var(--weight-bold) 19px/1 var(--font-sans);
    color: var(--ink);
  }

  .highlight-label {
    font: var(--weight-medium) 11.5px/1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .compare {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .compare-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-inline: 4px;
  }

  .eyebrow {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    letter-spacing: 0.06em;
    color: var(--ink-4);
  }

  .eyebrow.grow {
    flex: 1;
  }

  .eyebrow.inset {
    padding-inline: 4px;
  }

  .filters {
    flex: none;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .filter {
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: transparent;
    font: var(--weight-semibold) 11.5px/1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .filter.on {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .table {
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    overflow: hidden;
  }

  .diamond-band {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    width: 128px;
    background: color-mix(in oklch, var(--accent) 7%, transparent);
    border-inline-start: 1px solid color-mix(in oklch, var(--accent) 22%, transparent);
    pointer-events: none;
  }

  .table-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 112px 128px;
    align-items: center;
    padding-inline-start: 16px;
  }

  .table-head {
    height: 48px;
    border-block-end: 1px solid var(--line-1);
  }

  .col-free {
    text-align: center;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .col-diamond {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
  }

  .col-gem {
    width: 13px;
    height: 13px;
    background: var(--accent);
  }

  .group-label {
    position: relative;
    display: flex;
    align-items: flex-end;
    height: 36px;
    padding: 0 16px 8px;
    box-sizing: border-box;
    font: var(--weight-semibold) 10.5px/1 var(--font-sans);
    letter-spacing: 0.06em;
    color: var(--ink-4);
  }

  .group-label.divided {
    border-block-start: 1px solid var(--line-1);
  }

  .feature {
    min-height: 44px;
  }

  .feature-name {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .feature-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .feature-label {
    font: var(--weight-medium) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .cell {
    display: flex;
    justify-content: center;
    text-align: center;
  }

  .free-check {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .free-text,
  .pro-text {
    font: var(--weight-medium) 11.5px/1.25 var(--font-sans);
    color: var(--ink-3);
  }

  .pro-text {
    font-weight: var(--weight-semibold);
    color: var(--ink);
  }

  .dash {
    width: 10px;
    height: 1.5px;
    border-radius: 2px;
    background: var(--ink-4);
  }

  .pro-check {
    width: 16px;
    height: 16px;
    background: var(--accent);
  }

  .table-end {
    height: 8px;
  }

  .extend-note {
    flex: none;
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .strong {
    font-weight: var(--weight-semibold);
    color: var(--ink);
  }

  .stack {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .pay-row {
    display: flex;
    gap: 8px;
  }

  .token-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .token-button {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    height: 68px;
    padding: 0 14px 0 16px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    cursor: pointer;
    user-select: none;
  }

  .token-button.open {
    background: var(--overlay-2);
  }

  .token-button:hover,
  .token-option:hover,
  .top-up:hover {
    background: var(--overlay-2);
  }

  .token-mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-pill);
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: #fff;
  }

  .token-mark.small {
    width: 30px;
    height: 30px;
    font-size: var(--text-md);
  }

  .token-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .token-option .token-text {
    gap: 3px;
  }

  .token-symbol {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .token-balance,
  .token-name {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-3);
  }

  .token-balance {
    font-variant-numeric: tabular-nums;
  }

  :global(.token-caret) {
    width: 16px;
    height: 16px;
    background: var(--ink-3);
    transition: transform var(--duration-base) var(--ease-out);
  }

  :global(.token-caret.open) {
    transform: rotate(180deg);
  }

  .token-scrim {
    position: fixed;
    inset: 0;
    z-index: 4;
  }

  .token-menu {
    position: absolute;
    inset-inline: 0;
    top: 74px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    padding: 6px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-pop, 0 16px 40px rgba(0, 0, 0, 0.45));
    animation: oc-dlg-in var(--duration-base) var(--ease-out) both;
  }

  .token-option {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .token-option.current {
    background: var(--overlay-1);
  }

  .token-held {
    flex: none;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }

  .token-check {
    width: 14px;
    height: 14px;
    background: var(--accent);
    opacity: 0;
  }

  .current .token-check {
    opacity: 1;
  }

  .top-up {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 68px;
    height: 68px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    font: var(--weight-semibold) 10.5px/1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .top-up.open {
    background: var(--overlay-2);
  }

  .top-up-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-2);
  }

  .address-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .address-hint {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3);
  }

  .address-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .address {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink);
  }

  .pay-error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .warn {
    flex: none;
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--status-warning) 9%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-warning) 30%, transparent);
  }

  .warn-icon {
    width: 16px;
    height: 16px;
    margin-top: 1px;
    background: var(--status-warning);
  }

  .warn-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .warn-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--status-warning);
  }

  .warn-body {
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .plans {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .plan {
    --plan-ink: var(--ink);
    display: flex;
    align-items: center;
    gap: 14px;
    height: 68px;
    padding: 0 14px 0 16px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    cursor: pointer;
    user-select: none;
  }

  .plan.life {
    --plan-ink: var(--accent);
    background: color-mix(in oklch, var(--accent) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 40%, transparent);
  }

  .plan.short {
    opacity: 0.5;
    cursor: default;
  }

  .plan:not(.short):hover {
    filter: brightness(1.15);
  }

  .plan-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .plan-label {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--plan-ink);
  }

  .plan-sub {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-3);
  }

  .short .plan-sub {
    color: var(--status-warning);
  }

  .plan-price {
    flex: none;
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--plan-ink);
    font-variant-numeric: tabular-nums;
  }

  .plan-chevron {
    width: 14px;
    height: 14px;
    background: var(--ink-3);
  }

  .refresh {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    margin-top: 6px;
    padding: 0 14px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .refresh:hover {
    background: var(--overlay-1);
  }

  :global(.refresh-icon) {
    width: 14px;
    height: 14px;
    background: var(--accent);
  }

  :global(.refresh-icon.spinning),
  :global(.cta-icon.spinning) {
    animation: oc-spin 0.8s linear infinite;
  }

  .renew {
    flex: none;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
  }

  .renew-row {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    padding: var(--space-16);
  }

  .renew-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .renew-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .renew-help {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .renew-toggle {
    flex: none;
    display: flex;
  }

  .summary {
    flex: none;
    display: flex;
    flex-direction: column;
    padding: 6px 0;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    padding: 0 16px;
  }

  .summary-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .summary-value {
    flex: none;
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .summary-value.accent {
    color: var(--accent);
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-22) var(--space-32);
    border-block-start: 1px solid var(--line-1);
  }

  .member-line {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font: var(--weight-medium) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink-2);
  }

  .member-badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-pill);
    background: color-mix(in oklch, var(--status-online) 18%, transparent);
  }

  .member-check {
    width: 13px;
    height: 13px;
    background: var(--status-online);
  }

  .text-button,
  .solid-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 18px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .text-button:hover {
    background: var(--overlay-2);
  }

  .text-button.accent {
    color: var(--accent);
  }

  .text-button.busy {
    cursor: default;
    opacity: 0.5;
  }

  .solid-button {
    padding: 0 22px;
    background: var(--overlay-2);
    color: var(--ink);
  }

  .solid-button:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.14));
  }

  .footer-note {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .cta {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 44px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;
  }

  .cta.busy {
    cursor: default;
  }

  .cta:hover {
    filter: brightness(1.08);
  }

  :global(.cta-icon) {
    width: 16px;
    height: 16px;
    background: var(--on-accent);
  }
</style>

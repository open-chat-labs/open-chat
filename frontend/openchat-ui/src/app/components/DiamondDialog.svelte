<!-- Diamond membership: compare Free vs Diamond → pick a duration and the token to pay with → confirm (auto-renew for
     timed plans) → pay. Members see their benefits and can extend; extensions start from the current expiry.
     Prices are in CHAT and converted to other payable tokens at their USD price. Esc closes (not while paying). -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { WalletToken } from '../../lib/types';
  import Toggle from '../../lib/components/Toggle.svelte';

  type PlanKey = '1m' | '3m' | '1y' | 'life';

  // [label, icon, free (true | false | text), diamond (true | text)]
  type Row = [string, string, boolean | string, boolean | string];
  const GROUPS: { label: string; rows: Row[] }[] = [
    {
      label: 'MESSAGING',
      rows: [
        ['Text messages', 'chat', true, true],
        ['GIFs', 'gif', true, true],
        ['Reactions', 'emoji', true, true],
        ['Polls', 'poll', true, true],
        ['Reminders', 'clock', true, true],
        ['Send crypto', 'coin', true, true],
        ['Video calls', 'video', false, true],
        ['Translations', 'lang', false, true],
        ['Notifications', 'bell', 'Mobile & desktop', 'Mobile & desktop'],
      ],
    },
    {
      label: 'MEDIA & STORAGE',
      rows: [
        ['Media messages', 'image', '1 MB / 5 MB', '5 MB / 50 MB'],
        ['Storage', 'disk', '100 MB rolling', '1 GB rolling'],
      ],
    },
    {
      label: 'GROUPS & COMMUNITIES',
      rows: [
        ['Direct chats', 'dm', true, true],
        ['Private groups', 'lock', '5', '25'],
        ['Public groups', 'globe', false, '10'],
        ['Gated groups', 'gate', false, true],
        ['Create communities', 'community', false, true],
      ],
    },
    {
      label: 'EXTRAS',
      rows: [
        ['P2P swaps', 'swap', false, true],
        ['Diamond badge', 'gem', false, true],
        ['Airdrops & rewards', 'party', false, 'Eligible'],
      ],
    },
  ];
  // placeholder prices until the backend supplies them
  const PLANS: { key: PlanKey; months: number; price: number; label: string; ext: string; noun: string; btn: string }[] = [
    { key: '1m', months: 1, price: 2, label: 'One month', ext: '1 month extension', noun: 'one month', btn: '1 month' },
    { key: '3m', months: 3, price: 5, label: 'Three months', ext: '3 month extension', noun: 'three months', btn: '3 month' },
    { key: '1y', months: 12, price: 15, label: 'One year', ext: '1 year extension', noun: 'one year', btn: '1 year' },
    { key: 'life', months: 0, price: 60, label: 'Lifetime', ext: 'Lifetime', noun: 'lifetime', btn: 'lifetime' },
  ];
  const ADDRESS = '2vxsx-fae3q-kzn7w-ot4qa-cai';
  const DAY = 86400000;
  const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const addMonths = (d: Date, n: number) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  };
  const dp = (n: number) => (n >= 1 ? 2 : n >= 0.01 ? 4 : n >= 0.0001 ? 6 : 8);
  const fmtAmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: n >= 1 ? 2 : 0, maximumFractionDigits: dp(n) });

  export interface DiamondPurchase {
    lifetime: boolean;
    until: string | null;
    autoRenew: boolean;
    plan: PlanKey;
    token: string;
    amount: number;
  }

  interface Props {
    /** Wallet tokens; the payable ones can pay. */
    tokens: WalletToken[];
    /** CHAT balance (other tokens use their own `held`). */
    balance: number;
    /** Opens straight on the plans step. */
    plan?: PlanKey | null;
    isDiamond?: boolean;
    lifetime?: boolean;
    /** Current membership end (ISO date); members without it are treated as expiring today. */
    memberUntil?: string;
    /** Shows a back arrow on the first step. */
    onBack?: () => void;
    backLabel?: string;
    onClose?: () => void;
    onUpgrade?: (p: DiamondPurchase) => void;
  }

  let { tokens, balance: chatBalance, plan: initialPlan = null, isDiamond = false, lifetime: lifetimeProp = false, memberUntil = '', onBack, backLabel = 'Back', onClose, onUpgrade }: Props = $props();

  let closing = $state(false);
  let onlyDiff = $state(false);
  let step = $state<'compare' | 'plans' | 'confirm'>('compare');
  let planKey = $state<PlanKey | null>(null);
  let autoRenew = $state(true);
  let busy = $state(false);
  let refreshing = $state(false);
  let topUp = $state(false);
  let copied = $state(false);
  let bought = $state<DiamondPurchase | null>(null);
  let spent = $state<Record<string, number>>({});
  let tokenSymbol = $state('CHAT');
  let picker = $state(false);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

  onMount(() => {
    if (initialPlan) {
      step = 'plans';
      planKey = initialPlan;
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) close(onClose);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  onDestroy(() => timers.forEach(clearTimeout));

  // payable wallet tokens, CHAT first; CHAT's balance comes from `balance`
  const payable = $derived(
    tokens
      .filter((t) => t.payable)
      .map((t) => ({ symbol: t.symbol, name: t.name, mark: t.mark, usd: t.price, held: t.symbol === 'CHAT' ? null : t.held, grad: t.grad }))
      .sort((x, y) => Number(y.symbol === 'CHAT') - Number(x.symbol === 'CHAT')),
  );
  const heldOf = (t: (typeof payable)[number]) => Math.max(0, (t.held ?? chatBalance) - (spent[t.symbol] || 0));
  const tok = $derived(payable.find((t) => t.symbol === tokenSymbol) ?? payable[0]);
  const balance = $derived(heldOf(tok));
  const sym = $derived(tok.symbol);
  const chatUsd = $derived(payable[0]?.usd ?? 0.152);
  const cost = (pl: (typeof PLANS)[number]) => (tok.symbol === 'CHAT' ? pl.price : +((pl.price * chatUsd) / tok.usd).toPrecision(3));
  const fmtToken = (n: number) => `${fmtAmt(n)} ${sym}`;

  const member = $derived(isDiamond || !!bought);
  const lifetime = $derived(bought ? bought.lifetime : lifetimeProp);
  const extend = $derived(member && !lifetime);
  const expiry = $derived.by(() => {
    if (bought?.until) return new Date(bought.until);
    const d = new Date(memberUntil);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const until = (pl: (typeof PLANS)[number]) => addMonths(extend ? expiry : new Date(), pl.months);
  const plan = $derived(PLANS.find((x) => x.key === planKey) ?? PLANS[0]);

  const groups = $derived(
    GROUPS.map((g) => ({ label: g.label, rows: g.rows.filter((r) => !onlyDiff || r[2] !== r[3]) })).filter((g) => g.rows.length),
  );

  const plans = $derived(
    PLANS.map((pl) => {
      const c = cost(pl), ok = balance >= c;
      return {
        key: pl.key,
        label: extend ? pl.ext : pl.label,
        price: fmtToken(c),
        life: !pl.months,
        ok,
        sub: !ok
          ? `Need ${fmtToken(+(c - balance).toPrecision(4))} more`
          : !pl.months
            ? extend
              ? 'Upgrade to lifetime membership'
              : 'Never expires'
            : `${extend ? 'Extend to ' : 'Until '}${fmtDate(until(pl))}`,
      };
    }),
  );
  const isShort = $derived(balance < cost(PLANS[PLANS.length - 1]));
  const price = $derived(cost(plan));
  const timed = $derived(!!plan.months);
  const daysLeft = $derived(Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / DAY)));
  const period = $derived(plan.months === 1 ? 'month' : plan.months === 12 ? 'year' : `${plan.months} months`);
  const confirmTitle = $derived(
    extend ? (timed ? `Extend Diamond by ${plan.noun}` : 'Upgrade to lifetime Diamond') : timed ? `Get ${plan.noun} of Diamond` : 'Get lifetime Diamond',
  );
  const confirmBody = $derived(
    !timed
      ? 'Lifetime is our top membership level — every Diamond feature, now and in the future, with no renewals.'
      : extend
        ? `Your membership moves from ${fmtDate(expiry)} to ${fmtDate(until(plan))}.`
        : `Diamond starts today and runs until ${fmtDate(until(plan))}.`,
  );
  const tokenList = $derived(payable.filter((t) => heldOf(t) > 0 || t.symbol === 'CHAT'));
  const subtitle = $derived(
    step === 'plans' ? (extend ? 'Extend your membership' : 'Choose a duration') : step === 'confirm' ? 'Confirm payment' : member ? 'You’re a member' : 'Free vs Diamond',
  );

  // the card animates out before the parent hears about it
  function close(then?: () => void) {
    if (closing) return;
    closing = true;
    later(() => then?.(), 170);
  }

  function back() {
    if (busy) return;
    if (step === 'confirm') step = 'plans';
    else if (step === 'plans') {
      step = 'compare';
      topUp = false;
      picker = false;
    } else close(onBack);
  }

  function choose(key: PlanKey, ok: boolean) {
    if (!ok) return;
    step = 'confirm';
    planKey = key;
    autoRenew = true;
  }

  function copyAddress() {
    try {
      navigator.clipboard.writeText(ADDRESS);
    } catch {}
    copied = true;
    later(() => (copied = false), 1600);
  }

  function refresh() {
    if (refreshing) return;
    refreshing = true;
    later(() => (refreshing = false), 900);
  }

  function pay() {
    if (busy) return;
    busy = true;
    const purchase: DiamondPurchase = {
      lifetime: !timed,
      until: timed ? until(plan).toISOString() : null,
      autoRenew: timed && autoRenew,
      plan: plan.key,
      token: sym,
      amount: price,
    };
    later(() => {
      busy = false;
      step = 'compare';
      bought = purchase;
      spent = { ...spent, [purchase.token]: (spent[purchase.token] || 0) + purchase.amount };
      onUpgrade?.(purchase);
    }, 1200);
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

<div class="layer" data-screen-label="Diamond" role="dialog" aria-modal="true">
  <div class="veil" class:closing onclick={() => !busy && close(onClose)} aria-hidden="true"></div>

  <div class="card" class:closing>
    <div class="header">
      {#if step !== 'compare' || onBack}
        <span class="square back" onclick={back} aria-label={step === 'compare' ? backLabel : 'Back'} role="button" tabindex="0" title={step === 'compare' ? backLabel : 'Back'}
          >{@render icon('back', 'back-icon')}</span
        >
      {/if}
      <div class="header-text">
        <span class="header-title">Diamond membership</span>
        <span class="header-sub">{subtitle}</span>
      </div>
      <span class="square" onclick={() => !busy && close(onClose)} role="button" tabindex="0">{@render icon('close', 'close-icon')}</span>
    </div>

    {#if step === 'compare'}
      <div class="body">
        {@render hero(
          member ? 'Thanks for being a Diamond member' : 'Do more with OpenChat',
          member ? 'Here’s everything your membership includes.' : 'More storage, bigger groups, video calls and translations — plus the Diamond badge next to your name.',
        )}

        <div class="highlights">
          {#each [{ value: '10×', label: 'storage (1 GB)' }, { value: '25', label: 'private groups' }, { value: '10', label: 'public groups' }] as h}
            <div class="highlight">
              <span class="highlight-value">{h.value}</span>
              <span class="highlight-label">{h.label}</span>
            </div>
          {/each}
        </div>

        <div class="compare">
          <div class="compare-head">
            <span class="eyebrow grow">COMPARE PLANS</span>
            <div class="filters">
              {#each [{ label: 'Everything', diff: false }, { label: 'What’s different', diff: true }] as f}
                <span class="filter" class:on={onlyDiff === f.diff} onclick={() => (onlyDiff = f.diff)} role="button" tabindex="0">{f.label}</span>
              {/each}
            </div>
          </div>

          <div class="table">
            <div class="diamond-band"></div>
            <div class="table-row table-head">
              <span></span>
              <span class="col-free">Free</span>
              <span class="col-diamond">{@render icon('gem', 'col-gem')}Diamond</span>
            </div>
            {#each groups as g, gi}
              <div class="group-label" class:divided={gi > 0}><span>{g.label}</span></div>
              {#each g.rows as [label, glyph, free, pro]}
                <div class="table-row feature">
                  <span class="feature-name">{@render icon(glyph, 'feature-icon')}<span class="feature-label">{label}</span></span>
                  <span class="cell">
                    {#if free === true}{@render icon('check', 'free-check')}{:else if free === false}<span class="dash"></span>{:else}<span class="free-text">{free}</span>{/if}
                  </span>
                  <span class="cell">
                    {#if pro === true}{@render icon('check', 'pro-check')}{:else if typeof pro === 'string'}<span class="pro-text">{pro}</span>{/if}
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
            >Your membership ends in <span class="strong">{daysLeft === 1 ? '1 day' : `${daysLeft} days`}</span>, on <span class="strong">{fmtDate(expiry)}</span>. Extensions start from that date.</span
          >
        {/if}

        <div class="stack">
          <span class="eyebrow inset">PAY WITH</span>
          <div class="pay-row">
            <div class="token-wrap">
              <div class="token-button" class:open={picker} onclick={() => (picker = !picker)} role="button" tabindex="0">
                <span class="token-mark" style:background={tok.grad}>{tok.mark}</span>
                <div class="token-text">
                  <span class="token-symbol">{tok.symbol}</span>
                  <span class="token-balance">{fmtAmt(+balance.toFixed(dp(balance)))} available</span>
                </div>
                {@render icon('chevron-down', `token-caret${picker ? ' open' : ''}`)}
              </div>
              {#if picker}
                <div class="token-scrim" onclick={() => (picker = false)} role="presentation"></div>
                <div class="token-menu">
                  {#each tokenList as t}
                    <div
                      class="token-option"
                      class:current={t.symbol === sym}
                      onclick={() => {
                        tokenSymbol = t.symbol;
                        picker = false;
                        topUp = false;
                      }}
                      role="button"
                      tabindex="0"
                    >
                      <span class="token-mark small" style:background={t.grad}>{t.mark}</span>
                      <div class="token-text">
                        <span class="token-symbol">{t.symbol}</span>
                        <span class="token-name">{t.name}</span>
                      </div>
                      <span class="token-held">{fmtAmt(+heldOf(t).toFixed(dp(heldOf(t))))}</span>
                      {@render icon('check', 'token-check')}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
            {#if isShort}
              <span class="top-up" class:open={topUp} onclick={() => (topUp = !topUp)} aria-label="Top up" role="button" tabindex="0" title="Top up">{@render icon('qr', 'top-up-icon')}Top up</span>
            {/if}
          </div>
          {#if topUp}
            <div class="address-box">
              <span class="address-hint">Send {tok.symbol} to your account address, then refresh your balance.</span>
              <div class="address-row">
                <span class="address">{ADDRESS}</span>
                <span class="copy" onclick={copyAddress} role="button" tabindex="0">{@render icon(copied ? 'check' : 'copy', 'copy-icon')}{copied ? 'Copied' : 'Copy'}</span>
              </div>
            </div>
          {/if}
          {#if balance < cost(PLANS[0])}
            {@render warn('Insufficient funds', `You need at least ${fmtToken(cost(PLANS[0]))} to get Diamond. Pick another token, or use Top up to get your receiving address.`)}
          {/if}
        </div>

        <div class="stack">
          <span class="eyebrow inset">{extend ? 'AVAILABLE OPTIONS' : 'MEMBERSHIP DURATION'}</span>
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
          {#if isShort}
            <span class="refresh" onclick={refresh} role="button" tabindex="0">{@render icon('refresh', `refresh-icon${refreshing ? ' spinning' : ''}`)}{refreshing ? 'Refreshing…' : `Refresh ${sym} balance`}</span>
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
                <span class="renew-title">Auto-renew</span>
                <span class="renew-help"
                  >{autoRenew ? `Renews every ${period} from your ${sym} balance. @OpenChatBot reminds you before each renewal.` : 'You’ll return to the free plan when this membership ends.'}</span
                >
              </div>
              <div class="renew-toggle"><Toggle on={autoRenew} onChange={(on) => (autoRenew = on)} /></div>
            </div>
          </div>
          {#if !autoRenew}
            {@render warn('Files and media may be lost', 'When your membership ends you return to the free plan, and files and media you’ve posted may be removed.')}
          {/if}
        {/if}

        <div class="summary">
          {#each [{ label: 'Payment amount', value: fmtToken(price), accent: true }, { label: 'OC SNS treasury receives (100%)', value: fmtToken(price), accent: false }, { label: 'Balance after payment', value: fmtToken(+(balance - price).toFixed(dp(balance))), accent: false }] as s}
            <div class="summary-row">
              <span class="summary-label">{s.label}</span>
              <span class="summary-value" class:accent={s.accent}>{s.value}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="footer">
      {#if step === 'compare' && member}
        <span class="member-line"><span class="member-badge">{@render icon('check', 'member-check')}</span>{lifetime ? 'Lifetime Diamond member' : `Diamond until ${fmtDate(expiry)}`}</span>
        {#if extend}
          <span class="text-button accent" onclick={() => (step = 'plans')} role="button" tabindex="0">Extend</span>
        {/if}
        <span class="solid-button" onclick={() => !busy && close(onClose)} role="button" tabindex="0">Done</span>
      {:else if step === 'compare'}
        <span class="text-button" onclick={() => !busy && close(onClose)} role="button" tabindex="0">Maybe later</span>
        <span class="cta" onclick={() => (step = 'plans')} role="button" tabindex="0">{@render icon('gem', 'cta-icon')}Upgrade to Diamond</span>
      {:else if step === 'plans'}
        <span class="footer-note">Payments go to the OpenChat SNS treasury.</span>
        <span class="solid-button" onclick={back} role="button" tabindex="0">Back</span>
      {:else}
        <span class="text-button" class:busy onclick={back} role="button" tabindex="0">Back</span>
        <span class="cta" class:busy onclick={pay} role="button" tabindex="0"
          >{@render icon(busy ? 'spin' : 'gem', `cta-icon${busy ? ' spinning' : ''}`)}{busy
            ? 'Processing payment…'
            : extend
              ? timed
                ? `Confirm ${plan.btn} extension`
                : 'Confirm lifetime membership'
              : `Confirm ${plan.btn} membership`}</span
        >
      {/if}
    </div>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 72;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
  }

  .veil.closing {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 580px;
    height: 770px;
    max-height: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  .card.closing {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
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
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
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
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .back-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
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
    color: var(--ink, #ececf1);
  }

  .header-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
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
    animation: oc-step-in var(--duration-base, 200ms) var(--ease-out) both;
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
    background: color-mix(in oklch, var(--accent, #ff5672) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 35%, transparent);
  }

  .hero-icon {
    width: 30px;
    height: 30px;
    background: var(--accent, #ff5672);
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
    color: var(--ink, #ececf1);
    text-wrap: balance;
  }

  .hero-body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .highlight-value {
    font: var(--weight-bold) 19px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .highlight-label {
    font: var(--weight-medium) 11.5px/1.3 var(--font-sans);
    color: var(--ink-3, #8a8a99);
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
    color: var(--ink-4, #6e6e7c);
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .filter {
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: transparent;
    font: var(--weight-semibold) 11.5px/1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .filter.on {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
    color: var(--ink, #ececf1);
  }

  .table {
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    overflow: hidden;
  }

  .diamond-band {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    width: 128px;
    background: color-mix(in oklch, var(--accent, #ff5672) 7%, transparent);
    border-inline-start: 1px solid color-mix(in oklch, var(--accent, #ff5672) 22%, transparent);
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
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .col-free {
    text-align: center;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .col-diamond {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
  }

  .col-gem {
    width: 13px;
    height: 13px;
    background: var(--accent, #ff5672);
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
    color: var(--ink-4, #6e6e7c);
  }

  .group-label.divided {
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
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
    background: var(--ink-3, #8a8a99);
  }

  .feature-label {
    font: var(--weight-medium) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .cell {
    display: flex;
    justify-content: center;
    text-align: center;
  }

  .free-check {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #8a8a99);
  }

  .free-text,
  .pro-text {
    font: var(--weight-medium) 11.5px/1.25 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .pro-text {
    font-weight: var(--weight-semibold);
    color: var(--ink, #ececf1);
  }

  .dash {
    width: 10px;
    height: 1.5px;
    border-radius: 2px;
    background: var(--ink-4, #5a5a66);
  }

  .pro-check {
    width: 16px;
    height: 16px;
    background: var(--accent, #ff5672);
  }

  .table-end {
    height: 8px;
  }

  .extend-note {
    flex: none;
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .strong {
    font-weight: var(--weight-semibold);
    color: var(--ink, #ececf1);
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    cursor: pointer;
    user-select: none;
  }

  .token-button.open {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .token-button:hover,
  .token-option:hover,
  .top-up:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
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
    color: var(--ink, #ececf1);
  }

  .token-balance,
  .token-name {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .token-balance {
    font-variant-numeric: tabular-nums;
  }

  :global(.token-caret) {
    width: 16px;
    height: 16px;
    background: var(--ink-3, #8a8a99);
    transition: transform var(--duration-base, 200ms) var(--ease-out);
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
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-pop, 0 16px 40px rgba(0, 0, 0, 0.45));
    animation: oc-dlg-in var(--duration-base, 200ms) var(--ease-out) both;
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .token-held {
    flex: none;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    font-variant-numeric: tabular-nums;
  }

  .token-check {
    width: 14px;
    height: 14px;
    background: var(--accent, #ff5672);
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    font: var(--weight-semibold) 10.5px/1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .top-up.open {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .top-up-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-2, #c9c9d4);
  }

  .address-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .address-hint {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3, #8a8a99);
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
    color: var(--ink, #ececf1);
  }

  .copy {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .copy:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.14));
  }

  .copy-icon {
    width: 13px;
    height: 13px;
    background: var(--ink, #ececf1);
  }

  .warn {
    flex: none;
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--status-warning, #ffb03d) 9%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-warning, #ffb03d) 30%, transparent);
  }

  .warn-icon {
    width: 16px;
    height: 16px;
    margin-top: 1px;
    background: var(--status-warning, #ffb03d);
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
    color: var(--status-warning, #ffb03d);
  }

  .warn-body {
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .plans {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .plan {
    --plan-ink: var(--ink, #ececf1);
    display: flex;
    align-items: center;
    gap: 14px;
    height: 68px;
    padding: 0 14px 0 16px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    cursor: pointer;
    user-select: none;
  }

  .plan.life {
    --plan-ink: var(--accent, #ff5672);
    background: color-mix(in oklch, var(--accent, #ff5672) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 40%, transparent);
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
    color: var(--ink-3, #8a8a99);
  }

  .short .plan-sub {
    color: var(--status-warning, #ffb03d);
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
    background: var(--ink-3, #8a8a99);
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
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .refresh:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  :global(.refresh-icon) {
    width: 14px;
    height: 14px;
    background: var(--accent, #ff5672);
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
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
    color: var(--ink, #e4e4ec);
  }

  .renew-help {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3, #8a8a99);
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
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
    color: var(--ink-3, #8a8a99);
  }

  .summary-value {
    flex: none;
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    font-variant-numeric: tabular-nums;
  }

  .summary-value.accent {
    color: var(--accent, #ff5672);
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-22) var(--space-32);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .member-line {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font: var(--weight-medium) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .member-badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-pill);
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 18%, transparent);
  }

  .member-check {
    width: 13px;
    height: 13px;
    background: var(--status-online, #2ee6a8);
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
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .text-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .text-button.accent {
    color: var(--accent, #ff5672);
  }

  .text-button.busy {
    cursor: default;
    opacity: 0.5;
  }

  .solid-button {
    padding: 0 22px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    color: var(--ink, #ececf1);
  }

  .solid-button:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.14));
  }

  .footer-note {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
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
    background: var(--accent, #ff5672);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--on-accent, #fff);
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
    background: var(--on-accent, #fff);
  }
</style>

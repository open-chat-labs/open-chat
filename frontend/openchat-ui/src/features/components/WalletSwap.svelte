<!-- In-place Swap for the wallet main column: Details → Quote (host's best DEX, until its expiresAt) → Swap (five on-chain
     steps grouped into three phases). The host does the work: onQuote returns the quote (output, fees, impact, expiry) and
     onSwap runs it, reporting progress through onStep; either rejecting keeps the amount and shows an error.
     Editing amount/tokens drops a live quote; slippage doesn't (min. received recomputes). Below 760px the quote panel
     stacks under the form. Pay offers only held tokens; Get offers anything swappable, yours first. -->
<script lang="ts" module>
  export interface SwapRequest {
    from: string;
    to: string;
    amount: number;
    /** Max slippage, in percent. */
    slippagePct: number;
  }

  export interface SwapQuote {
    /** Host's handle for this quote, passed back to onSwap. */
    id?: string;
    /** DEX that gave the best rate. */
    dex: string;
    /** e.g. "0.30%". */
    dexFee: string;
    /** Amount of `to` received at the quoted rate. */
    out: number;
    impactPct: number;
    networkFeeUsd: number;
    /** When the quote stops being valid (ms epoch). */
    expiresAt: number;
  }
</script>

<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import { amountText, cleanAmount, floorTo, parseAmount } from '../../lib/amount';
  import { onDestroy } from 'svelte';
  import type { WalletToken } from '../../lib/types';
  import AmountCard from '../../lib/components/AmountCard.svelte';
  import Banner from '../../lib/components/Banner.svelte';
  import DetailRow from '../../lib/components/DetailRow.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import Pill from '../../lib/components/Pill.svelte';
  import ProgressTimeline from '../../lib/components/ProgressTimeline.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import SideCard from '../../lib/components/SideCard.svelte';
  import Spinner from '../../lib/components/Spinner.svelte';
  import StepIndicator from '../../lib/components/StepIndicator.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';
  const i18n = getI18n(); // number formatting follows the host locale

  const SLIPS = [0.1, 0.5, 1, 3];
  const STEPS = 5;
  const fmt = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 0, maximumFractionDigits: dp });
  const usd = (v: number) => `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  type Stage = 'form' | 'quoting' | 'quoted' | 'progress' | 'done';

  interface Props {
    tokens: WalletToken[];
    /** Symbol to pay with; falls back to ICP. */
    token?: string;
    /** DEX names shown while a quote is found ("Checking KongSwap, ICPSwap and Sonic"). */
    dexes?: string[];
    /** How many of the pay token's ledger fees (WalletToken.fee) a swap spends on top of the amount, e.g. 2 for a DEX
     *  that takes an approve and a transfer. They are kept back from Max and count against the balance. */
    payFees?: number;
    /** Find the best quote. Reject to go back to the form with an error. Without it, no quote can be fetched. */
    onQuote?: (r: SwapRequest) => Promise<SwapQuote>;
    /** Run the swap; call onStep(i) as each of the 5 steps (deposit, transfer, notify, swap, withdraw) starts.
     *  Resolve (optionally with the actual output) when it's in the wallet; reject to show an error. */
    onSwap?: (r: { request: SwapRequest; quote: SwapQuote; onStep: (step: number) => void }) => Promise<{ out?: number } | void>;
    onClose?: () => void;
    /** After a completed swap, when the user leaves with Done. */
    onSwapped?: (s: { from: string; to: string; amount: number; out: number; fiat: number; fromDp: number; toDp: number }) => void;
  }

  let { tokens, token, dexes = [], payFees = 1, onQuote, onSwap, onClose, onSwapped }: Props = $props();
  // `t` is the receiving token below, so the translator is `tr`
  const tr = useT();

  // swappable tokens, the ones you hold first
  const list = $derived(tokens.filter((t) => t.price > 0).sort((x, y) => Number(y.held > 0) - Number(x.held > 0)));
  const find = (sym: string | undefined, fallback: string) => list.find((x) => x.symbol === sym) ?? list.find((x) => x.symbol === fallback) ?? list[0];

  const start = find(token, 'ICP');
  const usdt = find('USDT', 'USDT');
  let from = $state(start?.symbol ?? '');
  let to = $state((start === usdt ? find('ICP', 'ICP') : usdt)?.symbol ?? '');
  let amt = $state('');
  let slipIdx = $state(1);
  let stage = $state<Stage>('form');
  let left = $state(0);
  let prog = $state(0);
  let quote = $state<SwapQuote | null>(null);
  let received = $state<number | null>(null);
  let error = $state<'' | 'quote' | 'swap'>('');
  // a newer quote request (or an edit) makes an older pending one stale
  let run = 0;
  let pick = $state<'from' | 'to' | null>(null);
  let width = $state(0);

  // display-only: counts down to the host's expiresAt
  let countdown: ReturnType<typeof setInterval> | undefined;
  onDestroy(() => {
    run++;
    clearInterval(countdown);
  });

  const narrow = $derived(width > 0 && width < 760);
  const f = $derived(list.find((x) => x.symbol === from) ?? list[0]);
  const t = $derived(list.find((x) => x.symbol === to) ?? list[0]);
  const n = $derived(parseAmount(amt));
  const usdIn = $derived(f ? n * f.price : 0);
  const impactPct = $derived(quote?.impactPct ?? 0);
  const out = $derived(received ?? quote?.out ?? 0);
  const slip = $derived(SLIPS[slipIdx]);
  // what can be swapped: the balance less the ledger fees the swap itself costs
  const spendable = $derived(f ? Math.max(0, f.held - (f.fee ?? 0) * payFees) : 0);
  const over = $derived(!!f && n > spendable);
  const ok = $derived(n > 0 && !over && !!onQuote);
  const dexName = $derived(quote?.dex ?? '');
  const listFmt = new Intl.ListFormat(i18n.locale ?? 'en', { type: 'conjunction' });
  const quoted = $derived(stage === 'quoted');
  const done = $derived(stage === 'done');
  const busy = $derived(stage === 'progress' || done);
  const showOut = $derived(quoted || busy);
  // while quoting, swapping or done the form can't change under the quote: no flip, amount, chips or token picks
  const locked = $derived(busy || stage === 'quoting');
  const stepIdx = $derived(stage === 'form' || stage === 'quoting' ? 0 : quoted ? 1 : 2);
  const amtIn = $derived(`${n > 0 ? fmt(n, f.dp) : '0'} ${f?.symbol}`);
  const amtOut = $derived(`${n > 0 ? fmt(out, t.dp) : '0'} ${t?.symbol}`);

  // the real swap is 5 on-chain steps; grouped into the 3 phases people care about
  const subSteps = $derived([
    tr('ui.walletSwap.sub.deposit'),
    tr('ui.walletSwap.sub.transfer', { amount: amtIn, dex: dexName }),
    tr('ui.walletSwap.sub.notify', { dex: dexName }),
    tr('ui.walletSwap.sub.swap', { from: f?.symbol, to: t?.symbol }),
    tr('ui.walletSwap.sub.withdraw', { amount: amtOut, dex: dexName }),
  ]);
  const phases = $derived(
    (
      [
        [tr('ui.walletSwap.phase.send', { dex: dexName }), [0, 1, 2]],
        [tr('ui.walletSwap.phase.swap'), [3]],
        [tr('ui.walletSwap.phase.return'), [4]],
      ] as [string, number[]][]
    ).map(([title, ks]) => ({
      title,
      steps: ks.map((k) => ({ label: subSteps[k], state: (done || k < prog ? 'done' : k === prog ? 'active' : 'todo') as 'done' | 'active' | 'todo' })),
    })),
  );

  const rows = $derived.by(() => {
    const impact = `${impactPct < 0.01 ? '<0.01' : impactPct.toFixed(2)}%`;
    const impactInk = impactPct > 3 ? 'var(--status-danger,#F5493D)' : impactPct > 1 ? '#FFB03D' : '#2EE6A8';
    const all = [
      { k: tr('ui.walletSwap.row.via'), v: dexName, ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.priceImpact'), v: impact, ink: impactInk },
      { k: tr('ui.walletSwap.row.minReceived'), v: `${fmt(out * (1 - slip / 100), t.dp)} ${t.symbol}`, ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.dexFee'), v: quote?.dexFee ?? '', ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.networkFees'), v: `~${usd(quote?.networkFeeUsd ?? 0)}`, ink: 'var(--ink,#ECECF1)' },
    ];
    return all.map((r, i) => ({ ...r, rule: (i < all.length - 1 ? 'bottom' : 'none') as 'bottom' | 'none' }));
  });

  const pickTokens = $derived(
    !pick
      ? []
      : list
          .filter((x) => pick === 'to' || x.held > 0)
          .map((x) => ({
            symbol: x.symbol,
            name: x.name,
            mark: x.mark,
            gradient: x.grad,
            owned: x.held > 0,
            held: x.held > 0 ? `${fmt(x.held, x.dp)} ${x.symbol}` : undefined,
            note: x.held > 0 ? usd(x.held * x.price) : undefined,
          })),
  );

  // editing amount or tokens drops a pending or live quote
  function drop() {
    error = '';
    if (stage === 'quoted' || stage === 'quoting') {
      run++;
      clearInterval(countdown);
      quote = null;
      stage = 'form';
    }
  }

  const request = (): SwapRequest => ({ from: f.symbol, to: t.symbol, amount: n, slippagePct: slip });

  async function getQuote() {
    if (!ok || !onQuote) return;
    const mine = ++run;
    clearInterval(countdown);
    error = '';
    stage = 'quoting';
    let q: SwapQuote;
    try {
      q = await onQuote(request());
    } catch {
      if (mine !== run) return;
      error = 'quote';
      stage = 'form';
      return;
    }
    if (mine !== run) return;
    quote = q;
    received = null;
    stage = 'quoted';
    const tickLeft = () => (left = Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000)));
    tickLeft();
    countdown = setInterval(tickLeft, 1000);
  }

  async function swap() {
    // only from a live quote: a second press (even before the next render) can't start another swap
    if (stage !== 'quoted' || !quote || !onSwap || left <= 0) return;
    const q = quote;
    const mine = ++run;
    clearInterval(countdown);
    error = '';
    stage = 'progress';
    prog = 0;
    try {
      const onStep = (i: number) => {
        if (mine === run) prog = Math.max(prog, Math.min(i, STEPS - 1));
      };
      const res = await onSwap({ request: request(), quote: q, onStep });
      if (mine !== run) return;
      if (res && typeof res.out === 'number') received = res.out;
      prog = STEPS;
      stage = 'done';
    } catch {
      if (mine !== run) return;
      // the quote is spent either way; the amount stays for a fresh quote
      quote = null;
      error = 'swap';
      stage = 'form';
    }
  }

  function chooseAmount(k: number) {
    if (locked) return;
    drop();
    amt = amountText(floorTo(spendable * k, f.dp), f.dp);
  }

  function flip() {
    if (locked) return;
    const nextAmt = n > 0 && showOut ? String(+out.toFixed(Math.min(t.dp, 6))) : amt;
    drop();
    [from, to] = [to, from];
    amt = nextAmt;
  }

  // picking the other side's token flips the pair; paying with a token you don't hold keeps the pay side
  function picked(sym: string) {
    if (locked) return;
    const chosen = list.find((x) => x.symbol === sym);
    if (!chosen) return;
    const other = pick === 'from' ? to : from;
    let nextFrom = from,
      nextTo = to;
    if (sym === other) [nextFrom, nextTo] = [to, from];
    else if (pick === 'from') nextFrom = sym;
    else nextTo = sym;
    if ((list.find((x) => x.symbol === nextFrom)?.held ?? 0) <= 0) {
      nextTo = sym === from ? to : sym;
      nextFrom = from;
    }
    drop();
    from = nextFrom;
    to = nextTo;
    pick = null;
  }

  // the swap in progress can't be left: its result (or failure) has to be shown here
  function back() {
    if (stage === 'progress') return;
    onClose?.();
  }

  function finish() {
    onSwapped?.({ from: f.symbol, to: t.symbol, amount: n, out, fiat: usdIn, fromDp: f.dp, toDp: t.dp });
    onClose?.();
  }
</script>

<div class="swap" bind:clientWidth={width} data-screen-label="Wallet swap">
  {#if f && t}
    <PageHeader title={tr('ui.walletSwap.titleToken', { symbol: f.symbol })} onBack={back} avatarMark={f.mark} avatarGradient={f.grad}
      ><StepIndicator steps={[tr('ui.walletSwap.step.details'), tr('ui.walletSwap.step.quote'), tr('ui.walletSwap.step.swap')]} current={stepIdx} complete={done} compact={narrow} /></PageHeader
    >
    <div class="scroll">
      <div class="layout" class:narrow>
        <div class="form" class:busy class:locked inert={locked}>
          <div class="cards">
            <AmountCard
              label={tr('ui.walletSwap.youPay')}
              meta={tr('ui.walletSwap.balance', { amount: fmt(f.held, f.dp), symbol: f.symbol })}
              value={amt}
              onChange={(e) => {
                if (locked) return;
                drop();
                amt = cleanAmount(e.currentTarget.value);
              }}
              tone={over ? 'danger' : 'default'}
              note={over ? tr('ui.walletSwap.overBalance') : `≈ ${usd(usdIn)}`}
              symbol={f.symbol}
              mark={f.mark}
              gradient={f.grad}
              onTokenClick={() => !locked && (pick = 'from')}
              onQuickSelect={chooseAmount}
              position="top"
            />
            <div class="flip-row"><span class="flip" onclick={flip} tabindex="0" aria-label={tr('ui.walletSwap.flip')} role="button" title={tr('ui.walletSwap.flip')}><span class="flip-icon"></span></span></div>
            <AmountCard
              label={tr(quoted ? 'ui.walletSwap.youGetQuoted' : 'ui.walletSwap.youGet')}
              meta={tr('ui.walletSwap.balance', { amount: fmt(t.held, t.dp), symbol: t.symbol })}
              value={showOut ? (n > 0 ? fmt(out, t.dp) : '0') : ''}
              note={showOut ? `≈ ${usd(out * t.price)}` : tr('ui.walletSwap.getQuoteToSee')}
              symbol={t.symbol}
              mark={t.mark}
              gradient={t.grad}
              onTokenClick={() => !locked && (pick = 'to')}
              position="bottom"
            />
          </div>
          <div class="slippage">
            <div class="slippage-head">
              <ListSectionLabel label={tr('ui.walletSwap.maxSlippageLabel')} /><span class="slippage-note"
                >{tr('ui.walletSwap.slippageNote')}</span
              >
            </div>
            <SegmentedTabs labels={SLIPS.map((v) => `${v}%`)} selectedIndex={slipIdx} onSelect={(i) => (slipIdx = i)} dotOnLast={false} />
          </div>
          {#if quoted}<Banner tone="info" text={tr('ui.walletSwap.quoteDropNote')} actionLabel="" />{/if}
        </div>
        <div class="side">
          <SideCard minHeight={narrow ? '0' : '560px'}>
            {#if stage === 'form'}
              <ListSectionLabel label={tr('ui.walletSwap.quoteLabel')} />
              <div class="placeholder">
                <span class="placeholder-badge"><span class="placeholder-icon"></span></span>
                <span class="placeholder-title">{tr('ui.walletSwap.noQuote')}</span>
                <span class="placeholder-body">{tr('ui.walletSwap.noQuoteBody')}</span>
              </div>
              {#if error}<span class="swap-error" role="alert">{tr(error === 'quote' ? 'ui.walletSwap.quoteFailed' : 'ui.walletSwap.swapFailed')}</span>{/if}
              <span class="cta" class:disabled={!ok} onclick={getQuote} tabindex="0" role="button" aria-disabled={!ok}
                >{over ? tr('ui.walletSwap.notEnough', { symbol: f.symbol }) : n > 0 ? tr('ui.walletSwap.getQuote') : tr('ui.walletSwap.enterAmount')}</span
              >
            {:else if stage === 'quoting'}
              <ListSectionLabel label={tr('ui.walletSwap.quoteLabel')} />
              <div class="finding">
                <Spinner size={36} label={tr('ui.walletSwap.findingRate')} />
                <span class="finding-title">{tr('ui.walletSwap.findingRateEllipsis')}</span>
                {#if dexes.length}<span class="finding-note">{tr('ui.walletSwap.checkingDexList', { list: listFmt.format(dexes) })}</span>{/if}
              </div>
            {:else if quoted}
              <div class="quote-head">
                <ListSectionLabel label={tr('ui.walletSwap.quoteLabel')} /><span class="grow"></span><Pill
                  size="md"
                  label={left > 0 ? `0:${String(left).padStart(2, '0')}` : tr('ui.walletSwap.expired')}
                  tone={left > 10 ? 'neutral' : left > 0 ? 'warning' : 'danger'}
                />
              </div>
              <div class="quote-figures">
                <span class="pair">{n > 0 ? fmt(n, f.dp) : '0'} {f.symbol} → {n > 0 ? fmt(out, t.dp) : '0'} {t.symbol}</span>
                <span class="rate">1 {f.symbol} ≈ {fmt(n > 0 ? out / n : 0, t.dp)} {t.symbol}</span>
              </div>
              <div class="rows">
                <DetailRow label={tr('ui.walletSwap.row.maxSlippage')} value="{slip}%" rule="bottom" />
                {#each rows as r}<DetailRow label={r.k} value={r.v} valueColor={r.ink} rule={r.rule} />{/each}
              </div>
              <span class="spacer"></span>
              {#if left > 0}
                <span class="cta" onclick={swap} tabindex="0" role="button">{tr('ui.walletSwap.swapCta')}</span>
              {:else}
                <span class="cta requote" onclick={getQuote} tabindex="0" role="button"><span class="requote-icon"></span>{tr('ui.walletSwap.requote')}</span>
              {/if}
            {:else}
              <ListSectionLabel label={tr(done ? 'ui.walletSwap.completeLabel' : 'ui.walletSwap.swappingLabel')} />
              <div class="progress-head">
                <span class="progress-title">{done ? tr('ui.walletSwap.swapped', { amountIn: amtIn, amountOut: amtOut }) : `${amtIn} → ${amtOut}`}</span>
                <span class="progress-note"
                  >{done ? tr('ui.walletSwap.inWallet') : tr('ui.walletSwap.stepOf', { step: Math.min(prog + 1, STEPS), total: STEPS, label: subSteps[Math.min(prog, STEPS - 1)] })}</span
                >
              </div>
              <ProgressTimeline {phases} density="compact" collapseDone={true} />
              <span class="spacer"></span>
              {#if done}
                <span class="cta" onclick={finish} role="button" tabindex="0">{tr('ui.common.done')}</span>
              {:else}
                <span class="leave-note">{tr('ui.walletSwap.leaveNote')}</span>
              {/if}
            {/if}
          </SideCard>
        </div>
      </div>
    </div>
    {#if pick}
      <DialogShell title={tr(pick === 'from' ? 'ui.walletSwap.pickFrom' : 'ui.walletSwap.pickTo')} onClose={() => (pick = null)}
        ><TokenPicker
          tokens={pickTokens}
          placeholder={tr(pick === 'from' ? 'ui.walletSwap.searchYourTokens' : 'ui.walletSwap.searchTokens')}
          ownedHeading="ui.tokenPicker.ownedHeading"
          otherHeading={pick === 'from' ? '' : 'ui.tokenPicker.otherHeading'}
          onSelect={picked}
        /></DialogShell
      >
    {/if}
  {:else}
    <PageHeader title={tr('ui.walletSwap.title')} onBack={() => onClose?.()} />
  {/if}
</div>

<style>
  .swap {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .layout {
    box-sizing: border-box;
    max-width: 1024px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 28px;
    padding: 28px 32px;
  }

  .layout.narrow {
    grid-template-columns: minmax(0, 1fr);
    padding: 24px 22px 28px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  .form.busy {
    opacity: 0.45;
  }

  .form.locked {
    pointer-events: none;
  }

  .cards {
    display: flex;
    flex-direction: column;
  }

  .flip-row {
    height: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .flip {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-1, #0e0e12);
    box-shadow: inset 0 0 0 1px var(--line-2);
    cursor: pointer;
  }

  .flip:hover {
    box-shadow: inset 0 0 0 1px var(--line-3);
  }

  .flip-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-swap) center/contain no-repeat;
  }

  .slippage {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }

  .slippage-head {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .slippage-note {
    font: 400 12.5px/1.5 'Plus Jakarta Sans', sans-serif;
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .side {
    min-width: 0;
    align-self: start;
    position: sticky;
    top: 0;
  }

  .placeholder,
  .finding {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }

  .swap-error {
    font: 500 13px/1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
    text-align: center;
  }

  .placeholder {
    text-align: center;
    padding: 28px 8px;
  }

  .finding {
    padding: 28px 0;
  }

  .placeholder-badge {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-2);
  }

  .placeholder-icon {
    width: 20px;
    height: 20px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-swap) center/contain no-repeat;
  }

  .placeholder-title {
    font: 600 15px/1.3 'Plus Jakarta Sans', sans-serif;
    color: var(--ink, #ececf1);
  }

  .placeholder-body {
    font: 400 13px/1.5 'Plus Jakarta Sans', sans-serif;
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }

  .finding-title {
    font: 600 14px/1.3 'Plus Jakarta Sans', sans-serif;
    color: var(--ink, #ececf1);
  }

  .finding-note {
    font: 400 12.5px/1.5 'Plus Jakarta Sans', sans-serif;
    color: var(--ink-4, #8a8a99);
  }

  .cta {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 46px;
    border-radius: 12px;
    background: var(--accent, #ff5672);
    font: 700 14px/1 'Plus Jakarta Sans', sans-serif;
    color: var(--on-accent, #2e0512);
    cursor: pointer;
    user-select: none;
  }

  .cta.disabled {
    background: var(--overlay-2);
    color: #7c7c8c;
    cursor: default;
  }

  .cta.requote {
    background: var(--overlay-2);
    color: var(--ink, #ececf1);
  }

  .requote-icon {
    width: 14px;
    height: 14px;
    background: var(--ink, #ececf1);
    mask: var(--icon-refresh) center/contain no-repeat;
  }

  .quote-head {
    display: flex;
    align-items: center;
  }

  .grow {
    flex: 1;
  }

  .quote-figures,
  .progress-head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px 0 22px;
  }

  .pair {
    font: 700 24px/1.15 'Plus Jakarta Sans', sans-serif;
    color: var(--ink, #ececf1);
    overflow-wrap: anywhere;
  }

  .rate {
    font: 500 13px/1 'JetBrains Mono', monospace;
    color: var(--ink-3, #9a9aa8);
  }

  .rows {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--line-1);
  }

  .spacer {
    flex: 1;
    min-height: 20px;
  }

  .progress-title {
    font: 700 22px/1.2 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--ink, #ececf1);
    overflow-wrap: anywhere;
    text-wrap: pretty;
  }

  .progress-note,
  .leave-note {
    font: 400 12.5px/1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }

  .leave-note {
    flex: none;
    font-size: 12px;
    text-align: center;
  }
</style>

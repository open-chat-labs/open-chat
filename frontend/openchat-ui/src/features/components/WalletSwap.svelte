<!-- In-place Swap for the wallet main column, in two steps: Details (amount, slippage, then a quote fetched with "Get quote"
     and shown inline until its expiresAt) → Swap (what you pay and get, then the three on-chain steps: approve, swap,
     withdraw). One column at most 700px wide. The host does the work: onQuote returns the quote (DEX, output, fees, impact,
     expiry) and onSwap runs it, reporting each step through onStep; either rejecting keeps the amount and shows an error.
     Editing amount/tokens drops a live quote; slippage doesn't (min. received recomputes). Pay offers only held tokens;
     Get offers anything swappable, yours first.
     The amount is everything that leaves the wallet: the host takes the swap's ledger fees out of it (2 × WalletToken.fee,
     approve + pull), so Max is the whole balance and an amount of 3 fees or less is too small to swap. -->
<script lang="ts" module>
  export interface SwapRequest {
    from: string;
    to: string;
    /** Everything taken from the wallet, ledger fees included (the host swaps it less those fees). */
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
  import { amountText, cleanAmount, floorTo, parseAmount, toUnits } from '../../lib/amount';
  import { onDestroy } from 'svelte';
  import type { WalletToken } from '../../lib/types';
  import AmountCard from '../../lib/components/AmountCard.svelte';
  import Banner from '../../lib/components/Banner.svelte';
  import DetailRow from '../../lib/components/DetailRow.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import Pill from '../../lib/components/Pill.svelte';
  import ProgressTimeline, { type TimelineFunds, type TimelineStep } from '../../lib/components/ProgressTimeline.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Spinner from '../../lib/components/Spinner.svelte';
  import StepIndicator from '../../lib/components/StepIndicator.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';
  const i18n = getI18n(); // number formatting follows the host locale

  const SLIPS = [0.1, 0.5, 1, 3];
  // the on-chain steps the host reports through onStep: approve, swap, withdraw
  const STEPS = 3;
  const fmt = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 0, maximumFractionDigits: dp });
  const usd = (v: number) => `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // m:ss, at least a second
  const clock = (ms: number) => {
    const sec = Math.max(1, Math.round(ms / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  type Stage = 'form' | 'quoting' | 'quoted' | 'progress' | 'done';

  interface Props {
    tokens: WalletToken[];
    /** Symbol to pay with; falls back to ICP. */
    token?: string;
    /** Find the best quote. Reject to go back to the form with an error. Without it, no quote can be fetched. */
    onQuote?: (r: SwapRequest) => Promise<SwapQuote>;
    /** Run the swap; call onStep(i) as each of the 3 on-chain steps (0 approve, 1 swap, 2 withdraw) starts.
     *  Resolve (optionally with the actual output) when it's in the wallet; reject to show an error. */
    onSwap?: (r: { request: SwapRequest; quote: SwapQuote; onStep: (step: number) => void }) => Promise<{ out?: number } | void>;
    onClose?: () => void;
    /** After a completed swap, when the user leaves with Done. */
    onSwapped?: (s: { from: string; to: string; amount: number; out: number; fiat: number; fromDp: number; toDp: number }) => void;
  }

  let { tokens, token, onQuote, onSwap, onClose, onSwapped }: Props = $props();
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
  // when each step started (index STEPS: when the swap finished), for per-step times and the elapsed clock
  let times = $state<number[]>([]);
  let now = $state(Date.now());
  let quote = $state<SwapQuote | null>(null);
  let received = $state<number | null>(null);
  let error = $state<'' | 'quote' | 'swap'>('');
  // a newer quote request (or an edit) makes an older pending one stale
  let run = 0;
  let pick = $state<'from' | 'to' | null>(null);
  let width = $state(0);

  // display-only: counts down to the host's expiresAt, and ticks the elapsed clock while swapping
  let countdown: ReturnType<typeof setInterval> | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;
  onDestroy(() => {
    run++;
    clearInterval(countdown);
    clearInterval(ticker);
  });

  const narrow = $derived(width > 0 && width < 760);
  const f = $derived(list.find((x) => x.symbol === from) ?? list[0]);
  const t = $derived(list.find((x) => x.symbol === to) ?? list[0]);
  const n = $derived(parseAmount(amt));
  const usdIn = $derived(f ? n * f.price : 0);
  const impactPct = $derived(quote?.impactPct ?? 0);
  const out = $derived(received ?? quote?.out ?? 0);
  const slip = $derived(SLIPS[slipIdx]);
  // compared in whole units, so Max (the balance to its last decimal) is never "over" by a float hair
  const over = $derived(!!f && toUnits(n, f.dp) > toUnits(f.held, f.dp));
  // the approve and pull fees come out of the amount, and what's left must still be more than a fee
  const tooSmall = $derived(!!f && n > 0 && toUnits(n, f.dp) <= 3n * toUnits(f.fee ?? 0, f.dp));
  const ok = $derived(n > 0 && !over && !tooSmall && !!onQuote);
  const dexName = $derived(quote?.dex ?? '');
  const quoting = $derived(stage === 'quoting');
  const quoted = $derived(stage === 'quoted');
  const done = $derived(stage === 'done');
  const busy = $derived(stage === 'progress' || done);
  const showOut = $derived(quoted || busy);
  const live = $derived(quoted && left > 0);
  const amtIn = $derived(`${n > 0 ? fmt(n, f.dp) : '0'} ${f?.symbol}`);
  const amtOut = $derived(`${n > 0 ? fmt(out, t.dp) : '0'} ${t?.symbol}`);

  const ctaText = $derived(
    quoting
      ? tr('ui.walletSwap.gettingQuote')
      : over
        ? tr('ui.walletSwap.notEnough', { symbol: f.symbol })
        : tooSmall
          ? tr('ui.walletSwap.amountTooSmall')
          : n > 0
            ? tr('ui.walletSwap.getQuote')
            : tr('ui.walletSwap.enterAmount'),
  );

  // the quote in three lines: what you'll get at least, what it costs, how much the price moves
  const quoteRows = $derived.by(() => {
    const impact = `${impactPct < 0.01 ? '<0.01' : impactPct.toFixed(2)}%`;
    const impactInk = impactPct > 3 ? 'var(--status-danger,#F5493D)' : impactPct > 1 ? 'var(--status-warning,#FFB03D)' : 'var(--status-online,#2EE6A8)';
    const all = [
      { k: tr('ui.walletSwap.row.minimumReceived'), v: `${fmt(out * (1 - slip / 100), t.dp)} ${t.symbol}`, ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.fees'), v: tr('ui.walletSwap.feesValue', { dexFee: quote?.dexFee ?? '', network: usd(quote?.networkFeeUsd ?? 0) }), ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.priceImpact'), v: impact, ink: impactInk },
    ];
    return all.map((r, i) => ({ ...r, rule: (i < all.length - 1 ? 'bottom' : 'none') as 'bottom' | 'none' }));
  });

  // the three on-chain steps, each with what's happening and how long it took (completion shows in funds and elapsed,
  // so the bar counts only real steps)
  const timeline = $derived.by((): TimelineStep[] => {
    const rows = [
      [tr('ui.walletSwap.timeline.approve', { dex: dexName, amount: amtIn }), tr('ui.walletSwap.timeline.approveHint', { dex: dexName, symbol: f?.symbol })],
      [tr('ui.walletSwap.timeline.swap', { from: f?.symbol, to: t?.symbol }), tr('ui.walletSwap.timeline.swapHint', { slip })],
      [tr('ui.walletSwap.timeline.withdraw', { amount: amtOut }), tr('ui.walletSwap.timeline.withdrawHint', { dex: dexName, symbol: t?.symbol })],
    ];
    return rows.map(([label, hint], k) => {
      const state = done || k < prog ? 'done' : k === prog ? 'active' : 'todo';
      const took = times[k] != null && times[k + 1] != null ? clock(times[k + 1] - times[k]) : undefined;
      return { label, hint, state, meta: took };
    });
  });
  // where the money is: ICPSwap pulls it from the wallet as the swap runs, then pays the output back
  const funds = $derived<TimelineFunds>(
    done
      ? { text: tr('ui.walletSwap.funds.done', { amount: amtOut }), tone: 'done' }
      : prog === 0
        ? { text: tr('ui.walletSwap.funds.wallet', { amount: amtIn }), tone: 'active' }
        : prog === 1
          ? { text: tr('ui.walletSwap.funds.atDex', { amount: amtIn, dex: dexName }), tone: 'active' }
          : { text: tr('ui.walletSwap.funds.returning', { amount: amtOut }), tone: 'active' },
  );
  const elapsed = $derived(times[0] == null ? '' : done ? tr('ui.walletSwap.took', { time: clock((times[STEPS] ?? now) - times[0]) }) : clock(now - times[0]));

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

  // "Get quote", the refresh button on a live quote and "Get new quote" on an expired one
  async function getQuote() {
    if (!ok || !onQuote || quoting || busy) return;
    const mine = ++run;
    clearInterval(countdown);
    error = '';
    stage = 'quoting';
    let q: SwapQuote;
    try {
      q = await onQuote(request());
    } catch {
      if (mine !== run) return;
      quote = null;
      error = 'quote';
      stage = 'form';
      return;
    }
    if (mine !== run) return;
    quote = q;
    received = null;
    stage = 'quoted';
    // counts down to expiry, then stops
    const tickLeft = () => {
      left = Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000));
      if (left === 0) clearInterval(countdown);
    };
    countdown = setInterval(tickLeft, 1000);
    tickLeft();
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
    times = [Date.now()];
    now = Date.now();
    clearInterval(ticker);
    ticker = setInterval(() => (now = Date.now()), 1000);
    try {
      const onStep = (i: number) => {
        if (mine !== run) return;
        const next = Math.min(Math.max(0, Math.floor(i)), STEPS - 1);
        if (next <= prog) return;
        // a skipped report still starts every step up to this one now
        const at = Date.now();
        const nextTimes = [...times];
        for (let k = prog + 1; k <= next; k++) nextTimes[k] = at;
        times = nextTimes;
        prog = next;
      };
      const res = await onSwap({ request: request(), quote: q, onStep });
      if (mine !== run) return;
      if (res && typeof res.out === 'number') received = res.out;
      const at = Date.now();
      const nextTimes = [...times];
      for (let k = prog + 1; k <= STEPS; k++) nextTimes[k] = at;
      times = nextTimes;
      prog = STEPS;
      stage = 'done';
    } catch {
      if (mine !== run) return;
      // the quote is spent either way; the amount stays for a fresh quote
      quote = null;
      error = 'swap';
      stage = 'form';
    } finally {
      if (mine === run) clearInterval(ticker);
    }
  }

  function chooseAmount(k: number) {
    if (stage === 'quoting') return;
    drop();
    amt = amountText(floorTo(f.held * k, f.dp), f.dp);
  }

  // picking the other side's token flips the pair; paying with a token you don't hold keeps the pay side
  function picked(sym: string) {
    if (stage === 'quoting' || busy) return;
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

  // after a finished swap: back to an empty form for the next one
  function again() {
    if (!done) return;
    run++;
    quote = null;
    received = null;
    prog = 0;
    times = [];
    amt = '';
    error = '';
    stage = 'form';
  }

  function finish() {
    onSwapped?.({ from: f.symbol, to: t.symbol, amount: n, out, fiat: usdIn, fromDp: f.dp, toDp: t.dp });
    onClose?.();
  }
</script>

<div class="swap" bind:clientWidth={width} data-screen-label="Wallet swap">
  {#if f && t}
    <PageHeader title={tr('ui.walletSwap.titleToken', { symbol: f.symbol })} onBack={back} avatarMark={f.mark} avatarGradient={f.grad}
      ><StepIndicator steps={[tr('ui.walletSwap.step.details'), tr('ui.walletSwap.step.swap')]} current={busy ? 1 : 0} complete={done} compact={narrow} /></PageHeader
    >
    <div class="scroll">
      <div class="column" class:narrow>
        {#if !busy}
          <div class="form" class:quoting inert={quoting}>
            <div class="cards">
              <AmountCard
                label={tr('ui.walletSwap.youPay')}
                meta={tr('ui.walletSwap.balance', { amount: fmt(f.held, f.dp), symbol: f.symbol })}
                value={amt}
                onChange={(e) => {
                  if (quoting) return;
                  drop();
                  amt = cleanAmount(e.currentTarget.value);
                }}
                tone={over || tooSmall ? 'danger' : 'default'}
                note={over ? tr('ui.walletSwap.overBalance') : tooSmall ? tr('ui.walletSwap.tooSmall', { min: fmt(3 * (f.fee ?? 0), f.dp), symbol: f.symbol }) : `≈ ${usd(usdIn)}`}
                symbol={f.symbol}
                mark={f.mark}
                gradient={f.grad}
                onTokenClick={() => !quoting && (pick = 'from')}
                onQuickSelect={chooseAmount}
                position="top"
              />
              <div class="arrow-row" aria-hidden="true"><span class="arrow"><span class="arrow-icon"></span></span></div>
              <AmountCard
                label={tr(quoted ? 'ui.walletSwap.youGetQuoted' : 'ui.walletSwap.youGet')}
                meta={tr('ui.walletSwap.balance', { amount: fmt(t.held, t.dp), symbol: t.symbol })}
                value={showOut ? (n > 0 ? fmt(out, t.dp) : '0') : ''}
                note={showOut ? `≈ ${usd(out * t.price)}` : tr('ui.walletSwap.getQuoteToSee')}
                muted={true}
                symbol={t.symbol}
                mark={t.mark}
                gradient={t.grad}
                onTokenClick={() => !quoting && (pick = 'to')}
                position="bottom"
              />
            </div>
            <div class="slippage">
              <div class="slippage-head">
                <ListSectionLabel label={tr('ui.walletSwap.maxSlippageLabel')} /><span class="slippage-note">{tr('ui.walletSwap.slippageNote')}</span>
              </div>
              <SegmentedTabs labels={SLIPS.map((v) => `${v}%`)} selectedIndex={slipIdx} onSelect={(i) => (slipIdx = i)} dotOnLast={false} />
            </div>
            {#if quoted}<Banner tone="info" text={tr('ui.walletSwap.quoteDropNote')} actionLabel="" />{/if}
            {#if error}<span class="swap-error" role="alert">{tr(error === 'quote' ? 'ui.walletSwap.quoteFailed' : 'ui.walletSwap.swapFailed')}</span>{/if}
            {#if quoted}
              <div class="quote">
                <div class="quote-head">
                  <span class="rate">1 {f.symbol} ≈ {fmt(n > 0 ? out / n : 0, t.dp)} {t.symbol}</span>
                  <Pill size="md" label={left > 0 ? `0:${String(left).padStart(2, '0')}` : tr('ui.walletSwap.expired')} tone={left > 10 ? 'neutral' : left > 0 ? 'warning' : 'danger'} />
                  {#if live}<IconButton icon="refresh" label="ui.walletSwap.refreshQuote" variant="ghost" onClick={getQuote} />{/if}
                </div>
                <div class="quote-rows">
                  {#each quoteRows as r}<DetailRow label={r.k} value={r.v} valueColor={r.ink} size="sm" rule={r.rule} />{/each}
                </div>
              </div>
              {#if live}
                <span class="cta" onclick={swap} tabindex="0" role="button">{tr('ui.walletSwap.swapCta')}</span>
              {:else}
                <span class="cta" onclick={getQuote} tabindex="0" role="button"><span class="cta-icon"></span>{tr('ui.walletSwap.getNewQuote')}</span>
              {/if}
            {:else}
              <span class="cta" class:disabled={!ok || quoting} onclick={getQuote} tabindex="0" role="button" aria-disabled={!ok || quoting} aria-busy={quoting || undefined}
                >{#if quoting}<Spinner size={16} tone="ink" label="ui.walletSwap.gettingQuote" />{/if}{ctaText}</span
              >
            {/if}
          </div>
        {:else}
          <div class="progress">
            <div class="kicker" class:done><span>{tr(done ? 'ui.walletSwap.completeLabel' : 'ui.walletSwap.swappingLabel')}</span><span class="kicker-rule"></span></div>
            <div class="legs">
              {#each [{ label: 'ui.walletSwap.youPay', amount: amtIn, value: usd(usdIn), tk: f }, { label: 'ui.walletSwap.youGet', amount: amtOut, value: usd(out * t.price), tk: t }] as leg}
                <div class="leg">
                  <TokenAvatar mark={leg.tk.mark} gradient={leg.tk.grad} size={40} />
                  <div class="leg-text"><span class="leg-label">{tr(leg.label)}</span><span class="leg-amount">{leg.amount}</span></div>
                  <span class="leg-usd">{leg.value}</span>
                </div>
              {/each}
              <div class="leg-rows">
                {#each quoteRows as r}<DetailRow label={r.k} value={r.v} valueColor={r.ink} size="sm" rule={r.rule} />{/each}
              </div>
            </div>
            <ProgressTimeline steps={timeline} {funds} {elapsed} />
            {#if done}
              <div class="done-actions">
                <span class="cta secondary" onclick={again} role="button" tabindex="0">{tr('ui.walletSwap.swapAgain')}</span>
                <span class="cta" onclick={finish} role="button" tabindex="0">{tr('ui.common.done')}</span>
              </div>
            {:else}
              <span class="progress-note">{tr('ui.walletSwap.progressNote')}</span>
            {/if}
          </div>
        {/if}
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

  .column {
    box-sizing: content-box;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    padding: 28px 32px;
  }

  .column.narrow {
    padding: 24px 22px 28px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  .form.quoting {
    pointer-events: none;
  }

  .cards {
    display: flex;
    flex-direction: column;
  }

  .arrow-row {
    height: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .arrow {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-1, #0e0e12);
  }

  .arrow-icon {
    width: 14px;
    height: 14px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-arrow-down) center/contain no-repeat;
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
    font: 400 12.5px/1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .swap-error {
    font: 500 13px/1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
    text-wrap: pretty;
  }

  .quote {
    border-radius: 14px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .quote-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
  }

  .rate {
    flex: 1;
    min-width: 0;
    font: 600 13px/1.3 var(--font-mono);
    color: var(--ink, #ececf1);
    overflow-wrap: anywhere;
  }

  .quote-rows {
    display: flex;
    flex-direction: column;
    padding: 0 16px 6px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .cta {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 52px;
    border-radius: 12px;
    background: var(--accent, #ff5672);
    font: 700 14.5px/1 var(--font-sans);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
    user-select: none;
  }

  .cta:hover {
    filter: brightness(1.08);
  }

  .cta.disabled {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    color: var(--ink-4, #8a8a99);
    cursor: default;
    filter: none;
  }

  .cta.secondary {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font-weight: 600;
    font-size: 14px;
    color: var(--ink, #ececf1);
    filter: none;
  }

  .cta.secondary:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.14));
  }

  .cta-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
    mask: var(--icon-refresh) center/contain no-repeat;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  .kicker {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 500 10px/1 var(--font-mono);
    letter-spacing: 0.09em;
    color: var(--accent-bright, #ff8298);
  }

  .kicker.done {
    color: var(--status-online, #2ee6a8);
  }

  .kicker-rule {
    flex: 1;
    height: 1px;
    background: var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .legs {
    border-radius: 16px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    overflow: hidden;
  }

  .leg {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .leg-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .leg-label {
    font: 500 10px/1 var(--font-mono);
    letter-spacing: 0.09em;
    color: var(--ink-4, #8a8a99);
  }

  .leg-amount {
    font: 700 18px/1.15 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow-wrap: anywhere;
  }

  .leg-usd {
    flex: none;
    font: 500 12.5px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .leg-rows {
    display: flex;
    flex-direction: column;
    padding: 2px 16px 6px;
  }

  .done-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .progress-note {
    font: 400 12.5px/1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }
</style>

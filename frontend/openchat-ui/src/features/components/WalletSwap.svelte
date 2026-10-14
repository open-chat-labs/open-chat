<!-- In-place Swap for the wallet main column: Details → Quote (30s, single best DEX) → Swap (three on-chain steps).
     Editing amount/tokens drops a live quote; slippage doesn't (min. received recomputes). Below 760px the quote panel
     stacks under the form. Pay offers only held tokens; Get offers anything swappable, yours first. -->
<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
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

  const DEX = [
    { name: 'KongSwap', fee: '0.30%' },
    { name: 'ICPSwap', fee: '0.30%' },
    { name: 'Sonic', fee: '0.25%' },
  ];
  const SLIPS = [0.1, 0.5, 1, 3];
  const QUOTE_SECS = 30;
  const fmt = (v: number, dp: number) => v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 0, maximumFractionDigits: dp });
  const usd = (v: number) => `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  type Stage = 'form' | 'quoting' | 'quoted' | 'progress' | 'done';

  interface Props {
    tokens: WalletToken[];
    /** Symbol to pay with; falls back to ICP. */
    token?: string;
    onClose?: () => void;
    onSwapped?: (s: { from: string; to: string; amount: number; out: number; fiat: number; fromDp: number; toDp: number }) => void;
  }

  let { tokens, token, onClose, onSwapped }: Props = $props();
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
  let left = $state(QUOTE_SECS);
  let prog = $state(0);
  let dexIdx = $state(0);
  let pick = $state<'from' | 'to' | null>(null);
  let width = $state(0);

  let countdown: ReturnType<typeof setInterval> | undefined;
  let progress: ReturnType<typeof setInterval> | undefined;
  let quoteTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    clearInterval(countdown);
    clearInterval(progress);
    clearTimeout(quoteTimer);
  });

  const narrow = $derived(width > 0 && width < 760);
  const f = $derived(list.find((x) => x.symbol === from) ?? list[0]);
  const t = $derived(list.find((x) => x.symbol === to) ?? list[0]);
  const n = $derived(parseFloat(amt.replace(/,/g, '')) || 0);
  const usdIn = $derived(f ? n * f.price : 0);
  const impactPct = $derived(Math.min(9, (usdIn / 40000) * 100));
  const out = $derived(t ? (usdIn / t.price) * (1 - impactPct / 100) * 0.997 : 0);
  const slip = $derived(SLIPS[slipIdx]);
  const over = $derived(!!f && n > f.held);
  const ok = $derived(n > 0 && !over);
  const dex = $derived(DEX[dexIdx]);
  const quoted = $derived(stage === 'quoted');
  const done = $derived(stage === 'done');
  const busy = $derived(stage === 'progress' || done);
  const showOut = $derived(quoted || busy);
  const stepIdx = $derived(stage === 'form' || stage === 'quoting' ? 0 : quoted ? 1 : 2);
  const amtIn = $derived(`${n > 0 ? fmt(n, f.dp) : '0'} ${f?.symbol}`);
  const amtOut = $derived(`${n > 0 ? fmt(out, t.dp) : '0'} ${t?.symbol}`);

  // the real swap is 5 on-chain steps; grouped into the 3 phases people care about
  const subSteps = $derived([
    tr('ui.walletSwap.sub.deposit'),
    tr('ui.walletSwap.sub.transfer', { amount: amtIn, dex: dex.name }),
    tr('ui.walletSwap.sub.notify', { dex: dex.name }),
    tr('ui.walletSwap.sub.swap', { from: f?.symbol, to: t?.symbol }),
    tr('ui.walletSwap.sub.withdraw', { amount: amtOut, dex: dex.name }),
  ]);
  const phases = $derived(
    (
      [
        [tr('ui.walletSwap.phase.send', { dex: dex.name }), [0, 1, 2]],
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
      { k: tr('ui.walletSwap.row.via'), v: dex.name, ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.priceImpact'), v: impact, ink: impactInk },
      { k: tr('ui.walletSwap.row.minReceived'), v: `${fmt(out * (1 - slip / 100), t.dp)} ${t.symbol}`, ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.dexFee'), v: dex.fee, ink: 'var(--ink,#ECECF1)' },
      { k: tr('ui.walletSwap.row.networkFees'), v: '~$0.01', ink: 'var(--ink,#ECECF1)' },
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
    if (stage === 'quoted' || stage === 'quoting') {
      clearInterval(countdown);
      clearTimeout(quoteTimer);
      stage = 'form';
    }
  }

  function getQuote() {
    if (!ok) return;
    clearInterval(countdown);
    clearTimeout(quoteTimer);
    stage = 'quoting';
    quoteTimer = setTimeout(() => {
      stage = 'quoted';
      left = QUOTE_SECS;
      dexIdx = Math.floor(Math.random() * DEX.length);
      countdown = setInterval(() => {
        if (left > 0) left--;
      }, 1000);
    }, 1300);
  }

  function swap() {
    clearInterval(countdown);
    stage = 'progress';
    prog = 0;
    progress = setInterval(() => {
      prog++;
      if (prog >= 5) {
        clearInterval(progress);
        stage = 'done';
      }
    }, 900);
  }

  function chooseAmount(k: number) {
    const p = Math.pow(10, Math.min(f.dp, 6));
    drop();
    amt = String(Math.floor(f.held * k * p) / p);
  }

  function flip() {
    const nextAmt = n > 0 && showOut ? String(+out.toFixed(Math.min(t.dp, 6))) : amt;
    drop();
    [from, to] = [to, from];
    amt = nextAmt;
  }

  // picking the other side's token flips the pair; paying with a token you don't hold keeps the pay side
  function picked(sym: string) {
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

  function finish() {
    onSwapped?.({ from: f.symbol, to: t.symbol, amount: n, out, fiat: usdIn, fromDp: f.dp, toDp: t.dp });
    onClose?.();
  }
</script>

<div class="swap" bind:clientWidth={width} data-screen-label="Wallet swap">
  {#if f && t}
    <PageHeader title={tr('ui.walletSwap.titleToken', { symbol: f.symbol })} onBack={() => onClose?.()} avatarMark={f.mark} avatarGradient={f.grad}
      ><StepIndicator steps={[tr('ui.walletSwap.step.details'), tr('ui.walletSwap.step.quote'), tr('ui.walletSwap.step.swap')]} current={stepIdx} complete={done} compact={narrow} /></PageHeader
    >
    <div class="scroll">
      <div class="layout" class:narrow>
        <div class="form" class:busy class:locked={busy || stage === 'quoting'}>
          <div class="cards">
            <AmountCard
              label={tr('ui.walletSwap.youPay')}
              meta={tr('ui.walletSwap.balance', { amount: fmt(f.held, f.dp), symbol: f.symbol })}
              value={amt}
              onChange={(e) => {
                drop();
                amt = e.currentTarget.value.replace(/[^0-9.,]/g, '');
              }}
              tone={over ? 'danger' : 'default'}
              note={over ? tr('ui.walletSwap.overBalance') : `≈ ${usd(usdIn)}`}
              symbol={f.symbol}
              mark={f.mark}
              gradient={f.grad}
              onTokenClick={() => (pick = 'from')}
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
              onTokenClick={() => (pick = 'to')}
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
              <span class="cta" class:disabled={!ok} onclick={getQuote} tabindex="0" role="button" aria-disabled={!ok}
                >{ok ? tr('ui.walletSwap.getQuote') : over ? tr('ui.walletSwap.notEnough', { symbol: f.symbol }) : tr('ui.walletSwap.enterAmount')}</span
              >
            {:else if stage === 'quoting'}
              <ListSectionLabel label={tr('ui.walletSwap.quoteLabel')} />
              <div class="finding">
                <Spinner size={36} label={tr('ui.walletSwap.findingRate')} />
                <span class="finding-title">{tr('ui.walletSwap.findingRateEllipsis')}</span>
                <span class="finding-note">{tr('ui.walletSwap.checkingDexes', { a: DEX[0].name, b: DEX[1].name, c: DEX[2].name })}</span>
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
                <span class="rate">1 {f.symbol} ≈ {fmt(f.price / t.price, t.symbol === 'BTC' ? 8 : 4)} {t.symbol}</span>
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
                <span class="progress-note">{done ? tr('ui.walletSwap.inWallet') : tr('ui.walletSwap.stepOf', { step: Math.min(prog + 1, 5), total: 5, label: subSteps[Math.min(prog, 4)] })}</span>
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

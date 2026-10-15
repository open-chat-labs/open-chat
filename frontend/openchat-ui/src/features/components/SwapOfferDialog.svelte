<!-- Swap offer builder (composer + → Swap crypto). You offer / You want cards (wallet Swap parts) with flip,
     price chips (Market / +2 / +5 / +10% fill "You want"), expiry pills, escrow line by the button. No review step.
     "Attach offer" → onAttach(offer); host shows the composer chip and posts a SwapOffer on send. `initial` edits a previous value.
     Tokens (balances, fees, minimums, USD prices for the market rate) come from the host via `tokens`. The offer carries
     numeric amounts and the expiry in ms alongside the display strings.
     Esc closes the token picker, then the dialog; Cmd/Ctrl+Enter attaches. -->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { SwapOffer } from '../../lib/types';
  import type { CryptoToken } from './SendCryptoDialog.svelte';
  import AmountCard from '../../lib/components/AmountCard.svelte';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import TokenPicker from '../../lib/components/TokenPicker.svelte';
  import { getI18n, useT, durationText } from '../../lib/i18n';
  import { cleanAmount, parseAmount } from '../../lib/amount';
  const i18n = getI18n(); // number formatting follows the host locale

  // expiry options: the duration id (shown via durationText) and the short form reported as expiresIn
  const H = 3600e3, D = 24 * H;
  const DURS: { id: string; count: number; unit: 'h' | 'd'; short: string; ms: number }[] = [
    { id: '1 hour', count: 1, unit: 'h', short: '1h', ms: H },
    { id: '6 hours', count: 6, unit: 'h', short: '6h', ms: 6 * H },
    { id: '1 day', count: 1, unit: 'd', short: '1d', ms: D },
    { id: '7 days', count: 7, unit: 'd', short: '7d', ms: 7 * D },
    { id: '30 days', count: 30, unit: 'd', short: '30d', ms: 30 * D },
    { id: '90 days', count: 90, unit: 'd', short: '90d', ms: 90 * D },
  ];
  // price chip labels: resource keys or literal text
  const PRICES: [string, number][] = [
    ['ui.swapOfferDialog.market', 0],
    ['+2%', 0.02],
    ['+5%', 0.05],
    ['+10%', 0.1],
  ];
  const fmt = (n: number, dp: number) => Number(n.toFixed(dp)).toLocaleString(i18n.locale ?? 'en', { maximumFractionDigits: dp });
  const usdFmt = (v: number) => (!v ? '$0.00' : v < 0.01 ? `$${v.toPrecision(2)}` : `$${v.toLocaleString(i18n.locale ?? 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const q4 = (n: number) => String(Number(n.toPrecision(4)));

  interface Props {
    /** Tokens to offer or ask for: balances, fees, minimums and USD prices (for the market rate). */
    tokens: CryptoToken[];
    z?: number;
    initial?: SwapOffer | null;
    onAttach?: (offer: SwapOffer) => void;
    onClose?: () => void;
  }

  let { tokens, z = 80, initial = null, onAttach, onClose }: Props = $props();
  const t = useT();
  const durLabel = (i: number) => durationText(t, DURS[i].id);
  const durShort = (i: number) => t('ui.swapOfferDialog.durationShort', { count: DURS[i].count, unit: DURS[i].unit });

  const draft = initial?.draft;
  // a new offer starts from the first token you hold, asking for the next one
  const firstHeld = untrack(() => tokens.find((x) => x.bal > 0) ?? tokens[0]);
  let give = $state(draft?.give ?? firstHeld?.symbol ?? '');
  let get = $state(draft?.get ?? untrack(() => tokens.find((x) => x.symbol !== give))?.symbol ?? '');
  let amt = $state(draft?.amt ?? '');
  let want = $state(draft?.want ?? '');
  let dur = $state(draft?.dur ?? 2);
  // chosen premium over market, or null once the ask is typed by hand
  let prem = $state<number | null>(draft ? draft.prem : 0);
  let picker = $state<'give' | 'get' | null>(null);
  let box: HTMLDivElement;

  onMount(() => {
    const timer = setTimeout(() => box?.querySelector('input')?.focus(), 60);
    return () => clearTimeout(timer);
  });

  const EMPTY: CryptoToken = { symbol: '', mark: '', gradient: 'var(--overlay-2)', bal: 0, fee: 0, min: 0, usd: 0, dp: 2 };
  // a token the host no longer lists keeps its symbol but has no balance or price
  const lookup = (s: string) => tokens.find((x) => x.symbol === s) ?? { ...EMPTY, symbol: s };
  const G = $derived(lookup(give));
  const R = $derived(lookup(get));
  const a = $derived(parseAmount(amt));
  const w = $derived(parseAmount(want));
  const fees = $derived(G.fee * 2);
  const lock = $derived(a + fees);
  const max = $derived(Math.max(0, G.bal - fees));
  // no market rate without both prices
  const market = $derived(G.usd > 0 && R.usd > 0 ? (a * G.usd) / R.usd : 0);
  // why the offer can't be attached yet: a prompt (quiet) or a problem (warn)
  const problem = $derived<{ text: string; quiet: boolean } | null>(
    !a
      ? { text: t('ui.swapOfferDialog.enterOffer'), quiet: true }
      : a < G.min
        ? { text: t('ui.swapOfferDialog.minimum', { amount: fmt(G.min, G.dp), symbol: G.symbol }), quiet: false }
        : a > max
          ? { text: t('ui.swapOfferDialog.notEnough', { amount: fmt(max, G.dp), symbol: G.symbol }), quiet: false }
          : !w
            ? { text: t('ui.swapOfferDialog.enterWant'), quiet: true }
            : null,
  );
  const ok = $derived(!problem);
  const pct = $derived(market && w ? Math.round((w / market - 1) * 100) : 0);
  const hasMarket = $derived(G.usd > 0 && R.usd > 0);
  const vs = $derived(
    !a || !w || !hasMarket ? '' : Math.abs(pct) < 1 ? t('ui.swapOfferDialog.atMarket') : t(pct > 0 ? 'ui.swapOfferDialog.aboveMarket' : 'ui.swapOfferDialog.belowMarket', { pct: Math.abs(pct) }),
  );
  const title = $derived(t(initial ? 'ui.swapOfferDialog.editTitle' : 'ui.swapOfferDialog.createTitle'));

  // amount edits keep the chosen price chip in sync
  function wantFor(v: number, premium: number | null) {
    if (premium == null || !(G.usd > 0 && R.usd > 0)) return;
    want = v ? q4(((v * G.usd) / R.usd) * (1 + premium)) : '';
  }

  function attach() {
    if (!ok || !onAttach) return;
    const giveSide = { amount: fmt(a, G.dp), symbol: G.symbol, mark: G.mark, gradient: G.gradient, usd: `≈ ${usdFmt(a * G.usd)}` };
    const getSide = { amount: fmt(w, R.dp), symbol: R.symbol, mark: R.mark, gradient: R.gradient, usd: `≈ ${usdFmt(w * R.usd)}` };
    onAttach({
      type: 'swap',
      give: giveSide,
      get: getSide,
      pair: [
        { symbol: G.symbol, mark: G.mark, gradient: G.gradient },
        { symbol: R.symbol, mark: R.mark, gradient: R.gradient },
      ],
      giveAmount: a,
      getAmount: w,
      expiresIn: DURS[dur].short,
      expiresInMs: DURS[dur].ms,
      title: `${giveSide.amount} ${G.symbol} → ${getSide.amount} ${R.symbol}`,
      summary: t('ui.swapOfferDialog.summary', { expires: durShort(dur), amount: fmt(lock, G.dp), symbol: G.symbol }),
      hint: t('ui.swapOfferDialog.hint', { duration: durLabel(dur), amount: fmt(lock, G.dp), symbol: G.symbol }),
      draft: { give, get, amt, want, dur, prem },
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (picker) picker = null;
      else onClose?.();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      attach();
    }
  }

  function flip() {
    if (!R.bal) return;
    [give, get] = [get, give];
    [amt, want] = [want, amt];
    prem = null;
  }

  function picked(s: string) {
    if (picker === 'give') give = s;
    else get = s;
    picker = null;
    if (prem != null) want = '';
  }

  const pickerTokens = $derived(
    tokens.map((tok) => ({
      symbol: tok.symbol,
      name: tok.name ?? tok.symbol,
      mark: tok.mark,
      gradient: tok.gradient,
      held: fmt(tok.bal, tok.dp),
      owned: tok.bal > 0,
      disabled: picker === 'give' ? !tok.bal || tok.symbol === get : tok.symbol === give,
      current: tok.symbol === (picker === 'give' ? give : get),
      title: picker === 'give' && !tok.bal ? t('ui.swapOfferDialog.dontHold', { symbol: tok.symbol }) : '',
    })),
  );
</script>

<div class="layer" style:z-index={z}>
  <div class="scrim" onclick={() => onClose?.()} aria-hidden="true"></div>
  <div class="dialog" bind:this={box} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={title} onkeydown={onKey}>
    <div class="header">
      <span class="title">{title}</span>
      <IconButton variant="ghost" icon="close" label="ui.common.close" onClick={() => onClose?.()} />
    </div>
    <div class="body">
      <div class="cards">
        <AmountCard
          label={t('ui.swapOfferDialog.youOffer')}
          meta={t('ui.swapOfferDialog.balance', { amount: fmt(G.bal, G.dp), symbol: G.symbol })}
          value={amt}
          onChange={(e) => {
            amt = cleanAmount(e.currentTarget.value);
            wantFor(parseAmount(amt), prem);
          }}
          tone={a > max ? 'danger' : 'default'}
          note="≈ {usdFmt(a * G.usd)}"
          symbol={G.symbol}
          mark={G.mark}
          gradient={G.gradient}
          onTokenClick={() => (picker = 'give')}
          onQuickSelect={(f) => {
            const v = Number((max * f).toFixed(G.dp));
            amt = String(v);
            wantFor(v, prem);
          }}
          position="top"
        />
        <div class="flip-row"><span class="flip" onclick={flip} tabindex="0" aria-label={t('ui.swapOfferDialog.flip')} role="button" title={t('ui.swapOfferDialog.flip')}><span class="flip-icon"></span></span></div>
        <AmountCard
          label={t('ui.swapOfferDialog.youWant')}
          meta={t('ui.swapOfferDialog.youHold', { amount: fmt(R.bal, R.dp), symbol: R.symbol })}
          value={want}
          onChange={(e) => {
            want = cleanAmount(e.currentTarget.value);
            prem = null;
          }}
          note="≈ {usdFmt(w * R.usd)}"
          symbol={R.symbol}
          mark={R.mark}
          gradient={R.gradient}
          onTokenClick={() => (picker = 'get')}
          position="bottom"
        />
      </div>
      <div class="price">
        <div class="price-head"><label>{t('ui.swapOfferDialog.price')}</label><span class="vs" class:warn={pct <= -5}>{vs}</span></div>
        {#if hasMarket}
        <div class="price-chips">
          {#each PRICES as [label, k]}
            <button
              class="chip"
              class:on={prem === k}
              onclick={() => {
                prem = k;
                wantFor(a, k);
              }}
              aria-pressed={prem === k}>{t(label)}</button
            >
          {/each}
        </div>
        {/if}
        <!-- without both USD prices there is no market rate to show, only the rate the offer itself sets -->
        <span class="rate">{a && w ? `1 ${G.symbol} = ${q4(w / a)} ${R.symbol}` : hasMarket ? t('ui.swapOfferDialog.marketRate', { from: G.symbol, rate: q4(G.usd / R.usd), to: R.symbol }) : ''}</span>
      </div>
      <div class="expiry">
        <label>{t('ui.swapOfferDialog.expiresAfter')}</label>
        <div class="durations">
          {#each DURS as d, i (d.id)}
            <button class="chip pill" class:on={i === dur} onclick={() => (dur = i)} aria-pressed={i === dur}>{durLabel(i)}</button>
          {/each}
        </div>
      </div>
    </div>
    <div class="footer">
      <span class="lock-icon"></span>
      <span class="foot" class:quiet={problem?.quiet} class:warn={problem && !problem.quiet}
        >{problem ? problem.text : t('ui.swapOfferDialog.locks', { amount: fmt(lock, G.dp), symbol: G.symbol })}</span
      >
      <Button label={initial ? 'ui.swapOfferDialog.update' : 'ui.swapOfferDialog.attach'} disabled={!ok} onClick={attach} />
    </div>

    {#if picker}
      <div class="picker-layer">
        <div class="picker" role="dialog" aria-label={t(picker === 'give' ? 'ui.swapOfferDialog.tokenToOffer' : 'ui.swapOfferDialog.tokenToAsk')}>
          <div class="picker-head"
            ><span class="picker-title">{t(picker === 'give' ? 'ui.swapOfferDialog.tokenToOffer' : 'ui.swapOfferDialog.tokenToAsk')}</span><IconButton
              variant="ghost"
              icon="close"
              label="ui.common.close"
              onClick={() => (picker = null)}
            /></div
          >
          <div class="picker-body"><div class="picker-fill"><div class="picker-abs"><TokenPicker tokens={pickerTokens} onSelect={picked} /></div></div></div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .dialog {
    position: relative;
    width: 100%;
    max-width: 500px;
    max-height: 100%;
    outline: none;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl, 22px);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 24px 64px rgba(0, 0, 0, 0.45);
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--header-h, 66px);
    box-sizing: border-box;
    padding: 0 12px 0 22px;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .title {
    flex: 1;
    font: 700 17px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 20px 22px 24px;
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
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    cursor: pointer;
  }

  .flip:hover {
    box-shadow: inset 0 0 0 1px var(--line-3, rgba(255, 255, 255, 0.22));
  }

  .flip-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-swap) center/contain no-repeat;
    -webkit-mask: var(--icon-swap) center/contain no-repeat;
  }

  .price {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .price-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  label {
    font: 600 13px/1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .vs {
    font: 600 12.5px/1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .vs.warn {
    color: var(--status-warning, #ffb03d);
  }

  .price-chips {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .chip {
    height: 36px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    color: var(--ink-2, #c9c9d4);
    font: 600 13px/1 var(--font-sans);
    cursor: pointer;
  }

  .chip.pill {
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
  }

  .chip.on {
    background: color-mix(in oklch, var(--accent, #ff5672) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 55%, transparent);
    color: var(--accent-bright, #ff8298);
  }

  .rate {
    font: 500 12.5px/1.3 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }

  .expiry {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .durations {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .lock-icon {
    width: 15px;
    height: 15px;
    flex: none;
    background: var(--ink-3, #9a9aa8);
    -webkit-mask: var(--icon-lock) center/contain no-repeat;
    mask: var(--icon-lock) center/contain no-repeat;
  }

  .foot {
    flex: 1;
    min-width: 0;
    font: 500 12.5px/1.4 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .foot.quiet {
    color: var(--ink-4, #8a8a99);
  }

  .foot.warn {
    color: var(--status-warning, #ffb03d);
  }

  .picker-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    border-radius: var(--radius-xl, 22px);
    background: var(--scrim, rgba(0, 0, 0, 0.55));
    backdrop-filter: blur(4px);
  }

  .picker {
    width: 100%;
    max-width: 400px;
    height: min(520px, 100%);
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    background: var(--surface-2, #15151b);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 16px 40px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .picker-head {
    flex: none;
    display: flex;
    align-items: center;
    height: 54px;
    padding: 0 8px 0 18px;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .picker-title {
    flex: 1;
    font: 700 15px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .picker-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: var(--space-14, 14px) var(--space-16, 16px) var(--space-16, 16px);
  }

  .picker-fill {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .picker-abs {
    position: absolute;
    inset: 0;
  }
</style>

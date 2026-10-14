<!-- Prize builder (composer + → Prize). Amount first; winners, expiry and claim restrictions as summary rows that open in place.
     Preview + cost column beside the form at ≥960px. "Attach prize" → onAttach(prize): the host puts it in the composer,
     where the user adds a caption and sends. Pass `initial` (a previous onAttach value) to edit. Ctrl/⌘+Enter attaches, Esc closes. -->
<script lang="ts" module>
  /** A token the prize can be paid in, with what the builder needs to price and validate it. */
  export interface PrizeToken {
    symbol: string;
    mark: string;
    gradient: string;
    /** Wallet balance. */
    bal: number;
    /** Ledger fee per transfer. */
    fee: number;
    /** Minimum amount per winner. */
    minPer: number;
    /** Display decimals. */
    dp: number;
  }
</script>

<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import { cleanAmount, parseAmount } from '../../lib/amount';
  import { onMount } from 'svelte';
  import type { Prize, PrizeDraft } from '../../lib/types';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import PrizeMessage from '../../lib/components/PrizeMessage.svelte';
  import QuickAmountChips from '../../lib/components/QuickAmountChips.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';

  // [long label key, short label key, ms]; labels are resolved at render time
  const D = 'ui.prizeBuilderDialog.durations.';
  const DURS: [string, string, number][] = [
    [D + 'oneHour', D + 'oneHourShort', 3600e3],
    [D + 'sixHours', D + 'sixHoursShort', 6 * 3600e3],
    [D + 'oneDay', D + 'oneDayShort', 86400e3],
    [D + 'sevenDays', D + 'sevenDaysShort', 7 * 86400e3],
    [D + 'thirtyDays', D + 'thirtyDaysShort', 30 * 86400e3],
    [D + 'ninetyDays', D + 'ninetyDaysShort', 90 * 86400e3],
  ];
  type GateKey = 'auth' | 'diamond' | 'lifetime' | 'chit' | 'streak';
  const GATES: { k: GateKey; label: string; icon: string; pick?: 'chit' | 'streak' }[] = [
    { k: 'auth', label: 'ui.prizeBuilderDialog.gates.auth', icon: 'passkey' },
    { k: 'diamond', label: 'ui.prizeBuilderDialog.gates.diamond', icon: 'diamond-outline' },
    { k: 'lifetime', label: 'ui.prizeBuilderDialog.gates.lifetime', icon: 'diamond' },
    { k: 'chit', label: 'ui.prizeBuilderDialog.gates.chit', icon: 'chit', pick: 'chit' },
    { k: 'streak', label: 'ui.prizeBuilderDialog.gates.streak', icon: 'flame', pick: 'streak' },
  ];
  // title and amount keys; amounts are formatted with t() at render time
  const PICKS = {
    streak: { title: 'ui.prizeBuilderDialog.minStreak', opts: [3, 7, 14, 30, 100, 365], amount: 'ui.prizeBuilderDialog.streakDays', short: (n: number) => n },
    chit: { title: 'ui.prizeBuilderDialog.minChit', opts: [1000, 5000, 10000, 50000, 100000], amount: 'ui.prizeBuilderDialog.chitAmount', short: (n: number) => (n >= 1000 ? n / 1000 + 'k' : n) },
  };
  const fmt = (n: number, dp: number) => Number(n.toFixed(dp)).toLocaleString(i18n.locale ?? 'en', { maximumFractionDigits: dp });

  interface Props {
    /** Tokens the prize can be paid in; the first is the default. */
    tokens: PrizeToken[];
    z?: number;
    /** A previous onAttach value, to edit it. */
    initial?: Prize | null;
    onAttach?: (prize: Prize) => void;
    onClose?: () => void;
  }

  let { tokens, z = 80, initial = null, onAttach, onClose }: Props = $props();
  const t = useT();
  const i18n = getI18n();
  const K = 'ui.prizeBuilderDialog.';

  const start: PrizeDraft = { tok: tokens[0].symbol, amt: '', win: '20', dur: 2, even: false, gates: {}, streak: 7, chit: 10000, ...initial?.draft };
  let tok = $state(start.tok);
  let amt = $state(start.amt);
  let win = $state(start.win);
  let dur = $state(start.dur);
  let even = $state(start.even);
  let gates = $state<Record<string, boolean | number>>(start.gates);
  let streak = $state(start.streak);
  let chit = $state(start.chit);
  let pick = $state<'chit' | 'streak' | null>(null);
  let tokOpen = $state(false);
  let row = $state<'win' | 'dur' | 'who' | null>(null);
  let vw = $state(typeof window === 'undefined' ? 1200 : window.innerWidth);
  let amountInput: HTMLInputElement;

  const T = $derived(tokens.find((t) => t.symbol === tok) ?? tokens[0]);
  const a = $derived(parseAmount(amt));
  const w = $derived(parseInt(win, 10) || 0);
  const fee = $derived(T.fee * (Math.max(w, 1) + 1));
  const min = $derived(T.minPer * Math.max(w, 1));
  const max = $derived(Math.max(0, T.bal - fee));
  const F = (n: number) => fmt(n, T.dp);
  const pickAmount = (p: 'chit' | 'streak', n: number) => t(PICKS[p].amount, { count: n, n: PICKS[p].short(n) });
  // why Attach is disabled: a resource key under ui.prizeBuilderDialog ('' = ready)
  const reason = $derived(
    w < 1 || w > 1000
      ? 'winnersRange'
      : !a
        ? 'enterAmount'
        : a < min
          ? 'minimum'
          : a > max
            ? 'notEnough'
            : '',
  );
  const reasonText = $derived(reason ? t(K + reason, { count: w, min: F(min), max: F(max), symbol: T.symbol }) : '');
  const ok = $derived(!reason);
  const gateOn = $derived(GATES.filter((g) => gates[g.k]));
  const gateLabel = (g: (typeof GATES)[number]) =>
    g.k === 'streak'
      ? t(K + 'gateStreak', { count: streak })
      : g.k === 'chit'
        ? t(K + 'gateChit', { amount: pickAmount('chit', chit) })
        : g.k === 'diamond'
          ? t(K + 'gateDiamond')
          : g.k === 'auth'
            ? t(K + 'gateAuth')
            : t(g.label);
  const total = $derived(a + fee);
  const wide = $derived(vw >= 960);
  const perWinner = $derived(
    !a || !w ? t(K + 'perWinnerShare') : t(even ? K + 'perWinnerEach' : K + 'perWinnerRandom', { amount: F(a / w), symbol: T.symbol }),
  );
  const rows = $derived([
    { k: 'win' as const, icon: 'trophy', label: t(K + 'winners'), value: `${w} · ${t(even ? K + 'evenSplit' : K + 'randomAmounts')}` },
    { k: 'dur' as const, icon: 'timer', label: t(K + 'endsAfter'), value: t(DURS[dur][0]) },
    { k: 'who' as const, icon: 'shield', label: t(K + 'whoCanClaim'), value: gateOn.length ? gateOn.map(gateLabel).join(' · ') : t(K + 'anyone') },
  ]);
  const costRows = $derived([
    { label: t(K + 'costPrize'), value: `${F(a)} ${T.symbol}` },
    { label: t(K + 'costFees'), value: `${F(fee)} ${T.symbol}` },
    { label: t(K + 'costTotal'), value: `${F(total)} ${T.symbol}`, strong: true },
    { label: t(K + 'balanceAfter'), value: `${F(Math.max(0, T.bal - total))} ${T.symbol}`, short: T.bal - total < 0 },
  ]);
  const quiet = $derived(ok || reason === 'enterAmount');

  function toggleGate(g: (typeof GATES)[number]) {
    if (gates[g.k]) {
      const n = { ...gates };
      delete n[g.k];
      gates = n;
      pick = null;
      return;
    }
    if (g.pick) {
      pick = pick === g.pick ? null : g.pick;
      return;
    }
    const n: Record<string, boolean | number> = { ...gates, [g.k]: true };
    // Lifetime already counts as Diamond, so the two replace each other
    if (g.k === 'diamond') delete n.lifetime;
    if (g.k === 'lifetime') delete n.diamond;
    gates = n;
    pick = null;
  }

  function choose(n: number) {
    if (!pick) return;
    if (pick === 'chit') chit = n;
    else streak = n;
    gates = { ...gates, [pick]: true };
    pick = null;
  }

  function attach() {
    if (!ok || !onAttach) return;
    onAttach({
      token: { symbol: T.symbol, mark: T.mark, gradient: T.gradient },
      amount: a,
      amountText: `${F(a)} ${T.symbol}`,
      winners: w,
      even,
      endsIn: t(DURS[dur][1]),
      endsInLabel: t(DURS[dur][0]),
      endsAt: Date.now() + DURS[dur][2],
      gates: gateOn.map((g) => ({ label: gateLabel(g), met: true })),
      fee,
      feeText: `${F(fee)} ${T.symbol}`,
      totalText: `${F(total)} ${T.symbol}`,
      summary: [t(K + 'summaryWinners', { count: w }), t(DURS[dur][1]), ...(gateOn.length ? [t(K + 'summaryRules', { count: gateOn.length })] : [])].join(' · '),
      draft: { tok, amt, win, dur, even, gates, streak, chit },
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (tokOpen) tokOpen = false;
      else onClose?.();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      attach();
    }
  }

  onMount(() => {
    const timer = setTimeout(() => amountInput?.focus(), 60);
    return () => clearTimeout(timer);
  });
</script>

<svelte:window bind:innerWidth={vw} />

<div class="layer" style:z-index={z}>
  <div class="scrim" onclick={() => onClose?.()} aria-hidden="true"></div>
  <div class="dialog" class:wide data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={t(initial ? K + 'editTitle' : K + 'title')} onkeydown={onKey}>
    <div class="head">
      <span class="title">{t(initial ? K + 'editTitle' : K + 'title')}</span>
      <IconButton variant="ghost" icon="close" label="ui.common.close" onClick={() => onClose?.()} />
    </div>
    <div class="body">
      <div class="form">
        <div class="amount-card">
          <div class="token" onclick={() => (tokOpen = true)} role="button" tabindex="0" aria-label={t(K + 'changeToken')} aria-haspopup="dialog">
            <TokenAvatar symbol={T.symbol} mark={T.mark} gradient={T.gradient} size={28} />
            <span class="token-symbol">{T.symbol}</span>
            <span class="token-bal">{F(T.bal)} {T.symbol}</span>
            <span class="chevron"></span>
          </div>
          <input
            class="amount"
            bind:this={amountInput}
            value={amt}
            oninput={(e) => (amt = cleanAmount(e.currentTarget.value))}
            inputmode="decimal"
            placeholder="0"
            aria-label={t(K + 'totalAmount')}
          />
          <span class="amount-hint" class:warn={!quiet}>{ok ? t(K + 'feeAdded', { fee: F(fee), symbol: T.symbol, count: Math.max(w, 1) + 1 }) : reasonText}</span>
          <QuickAmountChips size="sm" onSelect={(f) => (amt = String(Number((max * f).toFixed(T.dp))))} />
        </div>
        <div class="rows">
          {#each rows as r, i}
            <div class="row" class:ruled={i > 0}>
              <div
                class="row-head"
                onclick={() => {
                  row = row === r.k ? null : r.k;
                  pick = null;
                }}
                role="button"
                tabindex="0"
                aria-expanded={row === r.k}
              >
                <span class="row-icon" style:mask="var(--icon-{r.icon}) center/contain no-repeat" style:-webkit-mask="var(--icon-{r.icon}) center/contain no-repeat"></span>
                <span class="row-label">{r.label}</span>
                <span class="row-value">{r.value}</span>
                <span class="row-chevron" class:open={row === r.k}></span>
              </div>
              {#if row === r.k && r.k === 'win'}
                <div class="panel column">
                  <div class="stepper">
                    <button class="step" onclick={() => (win = String(Math.max(1, w - 1)))} aria-label={t(K + 'fewerWinners')}>−</button>
                    <input value={win} oninput={(e) => (win = e.currentTarget.value.replace(/\D/g, '').slice(0, 4))} inputmode="numeric" aria-label={t(K + 'numberOfWinners')} />
                    <button class="step" onclick={() => (win = String(Math.min(1000, w + 1)))} aria-label={t(K + 'moreWinners')}>+</button>
                  </div>
                  <span class="range">{t(K + 'winnersRangeHint')}</span>
                  <Toggle label={t(K + 'splitEvenly')} help={t(K + 'splitEvenlyHelp')} on={even} onChange={(v) => (even = v)} />
                </div>
              {/if}
              {#if row === r.k && r.k === 'dur'}
                <div class="panel wrap">
                  {#each DURS as d, j}
                    <button class="choice" class:on={j === dur} onclick={() => (dur = j)} aria-pressed={j === dur}>{t(d[0])}</button>
                  {/each}
                </div>
              {/if}
              {#if row === r.k && r.k === 'who'}
                <div class="panel column gap10">
                  <div class="chips">
                    {#each GATES as g}
                      {@const on = !!gates[g.k]}
                      <button class="choice gate" class:on onclick={() => toggleGate(g)} aria-pressed={on}>
                        <span class="gate-icon" style:mask="var(--icon-{g.icon}) center/contain no-repeat" style:-webkit-mask="var(--icon-{g.icon}) center/contain no-repeat"></span>{on
                          ? gateLabel(g)
                          : t(g.label)}<span
                          class="gate-trail"
                          style:mask="var(--icon-{on ? 'close' : g.pick ? 'chevron-down' : 'plus'}) center/contain no-repeat"
                          style:-webkit-mask="var(--icon-{on ? 'close' : g.pick ? 'chevron-down' : 'plus'}) center/contain no-repeat"
                        ></span>
                      </button>
                    {/each}
                  </div>
                  {#if pick}
                    <div class="picker">
                      <span class="picker-title">{t(PICKS[pick].title)}</span>
                      <div class="chips">
                        {#each PICKS[pick].opts as n}
                          <button class="choice small" class:on={n === (pick === 'chit' ? chit : streak)} onclick={() => choose(n)}>{t(K + 'orMore', { amount: pickAmount(pick, n) })}</button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
      {#if wide}
        <div class="aside">
          <span class="caption">{t(K + 'preview')}</span>
          <PrizeMessage
            token={{ symbol: T.symbol, mark: T.mark, gradient: T.gradient }}
            winners={Math.max(1, w)}
            claimed={0}
            endsIn={t(DURS[dur][1])}
            endingSoon={false}
            gates={gateOn.map((g) => ({ label: gateLabel(g), met: true }))}
            state="open"
            note=""
            time="now"
          />
          <div class="costs">
            {#each costRows as c, i}
              <div class="cost" class:total={i === 2}>
                <span class="cost-label" class:strong={c.strong}>{c.label}</span>
                <span class="cost-value" class:strong={c.strong} class:warn={c.short}>{c.value}</span>
              </div>
            {/each}
          </div>
          <span class="per-winner">{t(K + 'perWinnerNote', { perWinner })}</span>
        </div>
      {/if}
    </div>
    <div class="foot">
      <span class="foot-text" class:quiet={reason === 'enterAmount'} class:warn={!quiet}>{ok ? t(K + 'totalInclFees', { total: F(total), symbol: T.symbol }) : reasonText}</span>
      <Button label="ui.common.cancel" variant="ghost" onClick={() => onClose?.()} />
      <Button label={initial ? K + 'update' : K + 'attach'} disabled={!ok} onClick={attach} />
    </div>
    {#if tokOpen}
      <div class="token-layer">
        <div class="token-sheet" role="dialog" aria-label={t(K + 'prizeToken')}>
          <div class="sheet-head"><span class="sheet-title">{t(K + 'prizeToken')}</span><IconButton variant="ghost" icon="close" label="ui.common.close" onClick={() => (tokOpen = false)} /></div>
          <div class="sheet-list">
            {#each tokens as tk}
              <div
                class="sheet-row"
                class:current={tk.symbol === T.symbol}
                onclick={() => {
                  tok = tk.symbol;
                  tokOpen = false;
                }}
                role="button"
                tabindex="0"
              >
                <TokenAvatar symbol={tk.symbol} mark={tk.mark} gradient={tk.gradient} size={40} />
                <span class="sheet-symbol">{tk.symbol}</span>
                <span class="sheet-bal">{fmt(tk.bal, tk.dp)}</span>
              </div>
            {/each}
          </div>
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
    max-width: 540px;
    max-height: 100%;
    outline: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-xl, 22px);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 24px 64px rgba(0, 0, 0, 0.45);
  }

  .dialog.wide {
    max-width: 900px;
  }

  .head {
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
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .wide .body {
    grid-template-columns: minmax(0, 1fr) 360px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
    min-width: 0;
  }

  .amount-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 22px 16px 18px;
    border-radius: 18px;
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .token {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px 6px 6px;
    border-radius: 999px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    cursor: pointer;
  }

  .token:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
  }

  .token:focus-visible,
  .sheet-row:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .token-symbol {
    font: 700 14px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .token-bal {
    font: 500 12px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }

  .chevron,
  .row-chevron {
    width: 14px;
    height: 14px;
    flex: none;
    -webkit-mask: var(--icon-chevron-down) center/contain no-repeat;
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .chevron {
    background: var(--ink-3, #9a9aa8);
  }

  .amount {
    width: 100%;
    border: 0;
    outline: none;
    background: transparent;
    text-align: center;
    font: 700 40px/1.1 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--ink, #ececf1);
  }

  .amount-hint {
    font: 400 12px/1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-align: center;
  }

  .amount-hint.warn,
  .foot-text.warn,
  .cost-value.warn {
    color: var(--status-warning, #ffb03d);
  }

  .rows {
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    background: var(--surface-2, #15151b);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    overflow: hidden;
  }

  .row {
    display: flex;
    flex-direction: column;
    border-top: 0;
  }

  .row.ruled {
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .row-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
  }

  .row-head:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .row-head:focus-visible {
    box-shadow: inset var(--focus-ring);
    outline: none;
  }

  .row-icon {
    width: 18px;
    height: 18px;
    flex: none;
    background: var(--ink-3, #9a9aa8);
  }

  .row-label {
    flex: none;
    font: 600 13.5px/1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .row-value {
    flex: 1;
    min-width: 0;
    text-align: right;
    font: 500 13px/1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-chevron {
    background: var(--ink-4, #8a8a99);
    transform: rotate(0deg);
    transition: transform 0.2s;
  }

  .row-chevron.open {
    transform: rotate(180deg);
  }

  .panel {
    display: flex;
    padding: 2px 16px 16px;
  }

  .panel.column {
    flex-direction: column;
    gap: 12px;
  }

  .panel.column.gap10 {
    gap: 10px;
  }

  .panel.wrap {
    flex-wrap: wrap;
    gap: 6px;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 4px;
    border-radius: 12px;
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .step {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 9px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    color: var(--ink, #ececf1);
    font: 500 20px/1 var(--font-sans);
    cursor: pointer;
  }

  .step:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
  }

  .stepper input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    text-align: center;
    font: 700 16px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .range {
    margin-top: -4px;
    font: 400 12px/1.4 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .choice {
    height: 34px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    color: var(--ink-2, #c9c9d4);
    font: 600 13px/1 var(--font-sans);
    cursor: pointer;
  }

  .choice.on {
    background: color-mix(in oklch, var(--accent, #ff5672) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 55%, transparent);
    color: var(--accent-bright, #ff8298);
  }

  .choice.gate {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 12px 0 10px;
  }

  .choice.small {
    height: 32px;
    padding: 0 12px;
    font-size: 12.5px;
  }

  .gate-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
  }

  .gate-trail {
    width: 12px;
    height: 12px;
    background: currentColor;
    opacity: 0.8;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 12px;
    background: var(--surface-1, #0e0e12);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .picker-title {
    font: 600 12.5px/1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .aside {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
    background: var(--surface-0, #07070a);
    border-left: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .caption {
    font: 600 11px/1 var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--ink-4, #8a8a99);
  }

  .costs {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 14px;
    background: var(--surface-1, #0e0e12);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .cost {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding-top: 0;
    border-top: 0;
  }

  .cost.total {
    padding-top: 10px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .cost-label,
  .cost-value {
    font: 500 13px/1.3 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .cost-value {
    font-family: var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .cost-label.strong,
  .cost-value.strong {
    font-weight: 700;
    color: var(--ink, #ececf1);
  }

  .per-winner {
    font: 400 12px/1.5 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    text-wrap: pretty;
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .foot-text {
    flex: 1;
    min-width: 0;
    font: 500 12.5px/1.35 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .foot-text.quiet {
    color: var(--ink-4, #8a8a99);
  }

  .token-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--scrim, rgba(0, 0, 0, 0.5));
    backdrop-filter: blur(4px);
  }

  .token-sheet {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    background: var(--surface-2, #15151b);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 16px 40px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .sheet-head {
    display: flex;
    align-items: center;
    padding: 0 8px 0 18px;
    height: 54px;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .sheet-title {
    flex: 1;
    font: 700 15px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .sheet-list {
    display: flex;
    flex-direction: column;
    padding: 6px;
  }

  .sheet-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
  }

  .sheet-row.current,
  .sheet-row:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .sheet-symbol {
    flex: 1;
    font: 600 14px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .sheet-bal {
    font: 500 13px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }
</style>

<!-- Buy streak insurance: a week of day-cells (covered / adding now / tap to add) on a rising price ladder, a summary
     and Pay. Priced on each day's position in your holding, so buying one day at a time costs the same as several at once.
     Back returns to CHIT (onBack, else onClose); ×, the veil and a purchase close. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { getI18n } from '../../lib/i18n';

  const STEPS = [1, 2, 4, 12, 28, 60, 124];
  const MAX_DAYS = STEPS.length;
  const fmt = (n: number) => n.toLocaleString('en-US');

  interface Props {
    /** Current streak, in days. */
    streak: number;
    /** Days of cover bought so far. */
    insured?: number;
    /** Insured days already spent on missed days. */
    used?: number;
    /** CHAT balance. */
    balance: number;
    onBuy?: (days: number, cost: number) => void;
    onBack?: () => void;
    onClose?: () => void;
  }

  let { streak, insured = 0, used = 0, balance, onBuy, onBack, onClose }: Props = $props();
  const t = useT();

  const i18n = getI18n();
  // ordinals pick their form from the locale's ordinal plural category (one → 1st, two → 2nd, few → 3rd …)
  const ordinal = (n: number) => t('ui.streakInsuranceDialog.ordinal', { n, kind: new Intl.PluralRules(i18n.locale ?? 'en', { type: 'ordinal' }).select(n) });
  const days = (n: number) => t('ui.streakInsuranceDialog.days', { count: n });

  let picked = $state(1);

  // cover in hand is what has been bought minus what a missed day has spent
  const held = $derived(Math.min(Math.max(insured - used, 0), MAX_DAYS));
  const room = $derived(MAX_DAYS - held);
  const qty = $derived(Math.min(picked, room));
  const total = $derived(STEPS.slice(held, held + qty).reduce((sum, v) => sum + v, 0));
  const affordable = $derived(total <= balance);
  const canPay = $derived(qty > 0 && affordable);

  const summaryTitle = $derived(qty > 0 ? t('ui.streakInsuranceDialog.adding', { days: days(qty) }) : t(room === 0 ? 'ui.streakInsuranceDialog.fullWeek' : 'ui.streakInsuranceDialog.tapToAddCover'));
  const summaryHint = $derived(
    qty > 0
      ? qty === 1
        ? t('ui.streakInsuranceDialog.hintOne', { from: ordinal(held + 1) })
        : t('ui.streakInsuranceDialog.hintRange', { from: ordinal(held + 1), to: ordinal(held + qty) })
      : used > 0
        ? t('ui.streakInsuranceDialog.usedSoFar', { days: days(used) })
        : t('ui.streakInsuranceDialog.hintDefault'),
  );
  const payLabel = $derived(room === 0 ? t('ui.streakInsuranceDialog.fullyCovered') : qty === 0 ? t('ui.streakInsuranceDialog.pickADay') : t('ui.streakInsuranceDialog.pay', { days: days(qty), amount: fmt(total) }));

  let closing = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  // play the exit animation, then hand control back
  function leave(then?: () => void) {
    if (closing) return;
    closing = true;
    timer = setTimeout(() => then?.(), 170);
  }

  function pay() {
    if (!canPay) return;
    onBuy?.(qty, total);
    leave(onClose);
  }

  // tapping the last added cell takes it back off again
  function tap(i: number) {
    picked = i === held + qty - 1 ? i - held : i - held + 1;
  }
</script>

<div class="layer" class:closing data-screen-label="Streak insurance" role="dialog" aria-modal="true" use:modal={() => leave(onClose)}>
  <div class="veil" onclick={() => leave(onClose)} aria-hidden="true"></div>

  <div class="card">
    <div class="head">
      <span class="icon-button back" onclick={() => leave(onBack ?? onClose)} role="button" tabindex="0" aria-label={t('ui.streakInsuranceDialog.backToChit')} title={t('ui.streakInsuranceDialog.backToChit')}><span class="back-icon"></span></span>
      <span class="badge"><span class="badge-icon"></span></span>
      <div class="titles">
        <span class="title">{t('ui.streakInsuranceDialog.title')}</span>
        <span class="subtitle">{t('ui.streakInsuranceDialog.subtitle', { streak, cover: held > 0 ? t('ui.streakInsuranceDialog.covered', { days: days(held) }) : t('ui.streakInsuranceDialog.noCover') })}</span>
      </div>
      <span class="icon-button close" onclick={() => leave(onClose)} role="button" tabindex="0"><span class="close-icon"></span></span>
    </div>

    <div class="body">
      <div class="ladder">
        <div class="cells">
          {#each STEPS as price, i}
            {@const owned = i < held}
            {@const adding = !owned && i < held + qty}
            {@const title = owned ? t('ui.streakInsuranceDialog.cellOwned', { n: i + 1 }) : t('ui.streakInsuranceDialog.cellOpen', { ordinal: ordinal(i + 1), price })}
            <div class="cell" class:owned class:adding onclick={owned ? undefined : () => tap(i)} role="button" tabindex="0" aria-label={title} {title}>
              <span class="cell-icon"></span>
              <span class="cell-label">{owned ? t('ui.streakInsuranceDialog.day', { n: i + 1 }) : `+${price}`}</span>
            </div>
          {/each}
        </div>
        <div class="legend">
          <span class="key"><span class="swatch owned"></span>{t('ui.streakInsuranceDialog.alreadyCovered')}</span>
          <span class="key"><span class="swatch adding"></span>{t('ui.streakInsuranceDialog.addingNow')}</span>
          <span class="key"><span class="swatch open"></span>{t('ui.streakInsuranceDialog.tapToAdd')}</span>
        </div>
      </div>

      <div class="summary">
        <div class="summary-text">
          <span class="summary-title">{summaryTitle}</span>
          <span class="summary-hint">{summaryHint}</span>
        </div>
        <span class="total">{fmt(total)} CHAT</span>
      </div>
    </div>

    <div class="foot">
      <span class="balance" class:short={!affordable}
        >{t(affordable ? 'ui.streakInsuranceDialog.balanceCap' : 'ui.streakInsuranceDialog.balanceShort', { amount: fmt(balance), max: MAX_DAYS })}</span
      >
      <span class="pay" class:ready={canPay} onclick={pay} role="button" tabindex="0" aria-disabled={!canPay}>{payLabel}</span>
    </div>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 73;
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

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 560px;
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

  .closing .veil {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-24) var(--space-32);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .back {
    width: 32px;
    height: 32px;
    margin-inline-start: -10px;
  }

  .back-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .close {
    width: 30px;
    height: 30px;
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
  }

  .badge-icon {
    width: 18px;
    height: 18px;
    background: var(--accent, #ff5672);
    mask: var(--icon-shield) center/contain no-repeat;
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-26);
    padding: var(--space-26) var(--space-32) var(--space-32);
  }

  .ladder {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .cells {
    display: flex;
    gap: var(--space-8);
  }

  .cell {
    --cell-ink: var(--ink-4, #7c7c8c);
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    padding: 14px 0 12px;
    border-radius: var(--radius-md);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    cursor: pointer;
    user-select: none;
  }

  .cell:hover {
    filter: brightness(1.25);
  }

  .cell.adding {
    --cell-ink: var(--status-chit, #ff9f45);
    background: color-mix(in srgb, var(--status-chit, #ff9f45) 14%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-chit, #ff9f45) 45%, transparent);
  }

  .cell.owned {
    --cell-ink: var(--accent, #ff5672);
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
    cursor: default;
  }

  .cell-icon {
    width: 19px;
    height: 19px;
    background: var(--cell-ink);
    mask: var(--icon-shield) center/contain no-repeat;
    opacity: 0.45;
  }

  .owned .cell-icon,
  .adding .cell-icon {
    opacity: 1;
  }

  .cell-label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    color: var(--cell-ink);
  }

  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-16);
    padding: 2px var(--space-10) 0;
  }

  .key {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .swatch {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
  }

  .swatch.owned {
    background: var(--accent, #ff5672);
  }

  .swatch.adding {
    background: var(--status-chit, #ff9f45);
  }

  .swatch.open {
    box-shadow: inset 0 0 0 1px var(--line-3, rgba(255, 255, 255, 0.24));
  }

  .summary {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-18);
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .summary-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .summary-title {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .summary-hint {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .total {
    flex: none;
    font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-18) var(--space-32);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .balance {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .balance.short {
    color: var(--status-danger, #f5493d);
  }

  .pay {
    flex: none;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 var(--space-18);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    opacity: 0.7;
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    white-space: nowrap;
    cursor: not-allowed;
    user-select: none;
  }

  .pay.ready {
    background: var(--accent, #ff5672);
    opacity: 1;
    color: var(--on-accent, #2e0512);
    cursor: pointer;
  }

  .pay:hover {
    filter: brightness(1.07);
  }
</style>

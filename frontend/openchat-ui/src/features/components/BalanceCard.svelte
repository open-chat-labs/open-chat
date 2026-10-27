<!-- Balance summary card: label, big amount (+ optional fiat), optional veil and refresh toggles, an optional allocation bar
     with a hover tooltip per segment, and Send / Receive / Swap actions. Veiled: amounts blur and the bar shows equal segments
     so relative holdings don't leak. Empty (nothing owned yet): the bar is a plain track, Receive leads and Send / Swap are
     disabled ("Add funds first"). -->
<script lang="ts" module>
  export interface AllocationSegment {
    share: number;
    /** CSS background. */
    gradient: string;
    /** Box-shadow ring, e.g. an outline for a pooled "other" segment. */
    ring?: string;
    label?: string;
    /** Tooltip title; defaults to label. */
    tipLabel?: string;
    tipValue?: string;
  }
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  interface Props {
    /** Resource key (or literal text). */
    label?: string;
    amount: string;
    fiat?: string;
    veiled?: boolean;
    spinning?: boolean;
    allocation?: AllocationSegment[];
    /** Shows the eye toggle. */
    onToggleVeil?: () => void;
    /** Shows the refresh button. */
    onRefresh?: () => void;
    onSend?: () => void;
    onReceive?: () => void;
    onSwap?: () => void;
    /** Nothing owned yet: a plain track for the bar, Receive first, Send and Swap disabled. */
    empty?: boolean;
  }

  let { label = 'ui.balanceCard.totalBalance', amount, fiat = '', veiled = false, spinning = false, allocation = [], onToggleVeil, onRefresh, onSend, onReceive, onSwap, empty = false }: Props = $props();
  const t = useT();

  let hovered = $state<number | null>(null);

  const shares = $derived(allocation.map((s) => Math.max(s.share || 0, 0.001)));
  const totalShare = $derived(shares.reduce((sum, v) => sum + v, 0) || 1);
  // hiding a token can shrink the bar out from under the pointer
  const seg = $derived(hovered !== null && hovered < allocation.length ? hovered : null);
  const tip = $derived(seg === null ? null : allocation[seg]);
  const tipLeft = $derived.by(() => {
    if (seg === null) return '0px';
    const before = shares.slice(0, seg).reduce((sum, v) => sum + v, 0);
    const centre = (veiled ? (seg + 0.5) / allocation.length : (before + shares[seg] / 2) / totalShare) * 100;
    return `clamp(0px, calc(${centre.toFixed(1)}% - 79px), calc(100% - 158px))`;
  });
</script>

<div class="card">
  <div class="head">
    <span class="label">{t(label)}</span>
    {#if onToggleVeil}
      <span class="head-button" onclick={onToggleVeil} role="button" tabindex="0" aria-label={t(veiled ? 'ui.balanceCard.showBalance' : 'ui.balanceCard.hideBalance')} title={t(veiled ? 'ui.balanceCard.showBalance' : 'ui.balanceCard.hideBalance')}>
        <span class="head-icon" style:mask="var(--icon-{veiled ? 'eye-off' : 'eye'}) center/contain no-repeat"></span>
      </span>
    {/if}
    {#if onRefresh}
      <span class="head-button" onclick={onRefresh} role="button" tabindex="0" aria-label={t('ui.balanceCard.refresh')} title={t('ui.balanceCard.refresh')}>
        <span class="head-icon refresh" class:spinning></span>
      </span>
    {/if}
  </div>

  <div class="figures">
    <span class="amount" class:veiled>{amount}</span>
    {#if fiat}
      <span class="fiat" class:veiled>{fiat}</span>
    {/if}
  </div>

  {#if empty}
    <span class="track"></span>
  {:else if allocation.length > 0}
    <div class="bar">
      {#each allocation as s, i}
        <span
          class="segment"
          style:flex={veiled ? 1000 : Math.round((shares[i] / totalShare) * 1000)}
          style:background={s.gradient}
          style:box-shadow={s.ring ?? 'none'}
          onmouseenter={() => (hovered = i)}
          onmouseleave={() => (hovered = null)}
          role="presentation"
        ></span>
      {/each}
      {#if tip}
        <div class="tip" style:inset-inline-start={tipLeft}>
          <div class="tip-head">
            <span class="tip-dot" style:background={tip.gradient} style:box-shadow={tip.ring ?? 'none'}></span>
            <span class="tip-label">{tip.tipLabel ?? tip.label ?? ''}</span>
          </div>
          <span class="tip-value">{tip.tipValue ?? ''}</span>
        </div>
      {/if}
    </div>
  {/if}

  {#if empty}
    <div class="actions">
      <span class="action send" onclick={onReceive} role="button" tabindex="0">
        <span class="action-icon" style:mask="var(--icon-receive) center/contain no-repeat"></span>
        <span class="action-label">{t('ui.balanceCard.receive')}</span>
      </span>
      <span class="action disabled" role="button" tabindex="0" aria-disabled="true" title={t('ui.balanceCard.addFundsFirst')} data-tip={t('ui.balanceCard.addFundsFirst')}>
        <span class="action-icon" style:mask="var(--icon-wallet-send) center/contain no-repeat"></span>
        <span class="action-label">{t('ui.common.send')}</span>
      </span>
      <span
        class="action disabled square"
        role="button"
        tabindex="0"
        aria-disabled="true"
        aria-label={t('ui.balanceCard.swap')}
        title={t('ui.balanceCard.addFundsFirst')}
        data-tip={t('ui.balanceCard.addFundsFirst')}
      >
        <span class="action-icon" style:mask="var(--icon-swap) center/contain no-repeat"></span>
      </span>
    </div>
  {:else}
    <div class="actions">
      <span class="action send" onclick={onSend} role="button" tabindex="0">
        <span class="action-icon" style:mask="var(--icon-wallet-send) center/contain no-repeat"></span>
        <span class="action-label">{t('ui.common.send')}</span>
      </span>
      <span class="action outline" onclick={onReceive} role="button" tabindex="0">
        <span class="action-icon" style:mask="var(--icon-receive) center/contain no-repeat"></span>
        <span class="action-label">{t('ui.balanceCard.receive')}</span>
      </span>
      <span class="action outline square" onclick={onSwap} role="button" tabindex="0" aria-label={t('ui.balanceCard.swap')} title={t('ui.balanceCard.swap')}>
        <span class="action-icon" style:mask="var(--icon-swap) center/contain no-repeat"></span>
      </span>
    </div>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    padding: var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .head-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .head-button:hover {
    background: var(--overlay-2);
  }

  .head-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-4);
  }

  .refresh {
    mask: var(--icon-refresh) center/contain no-repeat;
  }

  .refresh.spinning {
    animation: oc-spin 700ms linear;
  }

  .figures {
    display: flex;
    align-items: flex-end;
    gap: var(--space-12);
    min-width: 0;
  }

  .amount,
  .fiat {
    filter: none;
    transition: filter var(--duration-base) var(--ease-out);
  }

  .amount.veiled,
  .fiat.veiled {
    filter: blur(9px);
  }

  .amount {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-3xl) / 1.1 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink);
  }

  .fiat {
    flex: none;
    font: var(--weight-semibold) var(--text-lg) / 1.3 var(--font-mono);
    color: var(--accent);
  }

  .track {
    display: block;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
  }

  .bar {
    position: relative;
    display: flex;
    gap: 3px;
    height: 8px;
    min-width: 0;
  }

  .segment {
    min-width: 6px;
    border-radius: var(--radius-pill);
    transition:
      flex var(--duration-slow) var(--ease-out),
      filter var(--duration-fast) var(--ease-out);
  }

  .segment:hover {
    filter: brightness(1.18);
  }

  .tip {
    position: absolute;
    z-index: 5;
    inset-block-end: calc(100% + 7px);
    width: 158px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 6px var(--space-10);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 10px 24px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: oc-tip-in 90ms var(--ease-out) both;
  }

  .tip-head {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .tip-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
  }

  .tip-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tip-value {
    font: var(--weight-medium) var(--text-sm) / 1.2 var(--font-mono);
    color: var(--ink-3);
    white-space: nowrap;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-6);
    height: 36px;
    border-radius: var(--radius-md);
    cursor: pointer;
    user-select: none;
    --action-ink: var(--ink-2);
  }

  .action.send {
    background: var(--accent);
    --action-ink: var(--on-accent);
  }

  .action.send:hover {
    filter: brightness(1.08);
  }

  .action.outline {
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .action.outline:hover {
    background: var(--overlay-1);
  }

  .action.disabled {
    box-shadow: inset 0 0 0 1px var(--line-1);
    cursor: not-allowed;
    --action-ink: var(--ink-4);
  }

  .action.square {
    flex: none;
    width: 36px;
  }

  .action-icon {
    width: 14px;
    height: 14px;
    background: var(--action-ink);
  }

  .action-label {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--action-ink);
  }
</style>

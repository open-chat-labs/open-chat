<!-- One wallet transaction. With a token (mark + gradient) it shows the token avatar badged with the kind (All activity);
     without, a neutral kind icon (a single token's page). onClick makes it a hover row; divider draws the list rule above it. -->
<script lang="ts">
  import { useT } from '../i18n';
  import Pill from './Pill.svelte';
  import TokenAvatar from './TokenAvatar.svelte';

  type Kind = 'send' | 'receive' | 'swap';

  interface Props {
    title: string;
    sub: string;
    /** Formatted, signed amount, e.g. "+385.60 ICP". */
    amount: string;
    fiat: string;
    kind?: Kind;
    /** Green amount; defaults to kind === 'receive'. */
    positive?: boolean;
    /** Masks amount and fiat. */
    hidden?: boolean;
    symbol?: string;
    mark?: string;
    gradient?: string;
    /** Status pill: resource key (or literal text). */
    status?: string;
    statusTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
    divider?: boolean;
    /** Just arrived: soft green wash. */
    fresh?: boolean;
    onClick?: () => void;
  }

  let {
    title,
    sub,
    amount,
    fiat,
    kind = 'receive',
    positive,
    hidden = false,
    symbol = '',
    mark,
    gradient,
    status,
    statusTone = 'neutral',
    divider = false,
    fresh = false,
    onClick,
  }: Props = $props();
  const t = useT();

  const pressable = $derived(!!onClick);
</script>

<div
  class="row"
  class:pressable
  class:fresh
  class:divider
  onclick={onClick}
  role={pressable ? 'button' : undefined}
  tabindex={pressable ? 0 : undefined}
>
  {#if mark}
    <TokenAvatar size={40} {symbol} {mark} {gradient} badge={kind} />
  {:else}
    <span class="kind"><span class="kind-icon" style:mask="var(--icon-{kind}) center/contain no-repeat"></span></span>
  {/if}
  <span class="main">
    <span class="title">{title}</span>
    <span class="sub"><span class="sub-text">{sub}</span>{#if status}<Pill label={t(status)} tone={statusTone} dot={true} />{/if}</span>
  </span>
  <span class="figures" aria-label={hidden ? t('ui.transactionRow.amountHidden') : undefined}>
    <span class="amount" class:positive={!hidden && (positive ?? kind === 'receive')}>{hidden ? '••••' : amount}</span>
    <span class="fiat">{hidden ? '••••' : fiat}</span>
  </span>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 64px;
    padding: 0;
    box-sizing: border-box;
    border-radius: 0;
    background: transparent;
    cursor: default;
  }

  .pressable {
    min-height: 72px;
    cursor: pointer;
  }

  .pressable,
  .fresh {
    padding: 0 var(--space-10);
    border-radius: var(--radius-md, 12px);
  }

  .fresh {
    background: rgba(46, 230, 168, 0.06);
  }

  .divider {
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.06));
  }

  .pressable:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .kind {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-2, rgba(255, 255, 255, 0.06));
  }

  .kind-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-2, #c9c9d4);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .title {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sub {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .sub-text {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .figures {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
  }

  .amount {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-mono);
    color: var(--ink, #ececf1);
  }

  .amount.positive {
    color: var(--status-online, #2ee6a8);
  }

  .fiat {
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }
</style>

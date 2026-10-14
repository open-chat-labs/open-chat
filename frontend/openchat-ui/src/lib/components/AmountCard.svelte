<!-- You pay / you get card: label + balance, big amount (input when onChange is given), token pill that opens a picker,
     fiat/notice line, optional quick chips. position "top" | "bottom" adds the extra padding a flip button overlapping the seam needs. -->
<script lang="ts">
  import { useT } from '../i18n';
  import ListSectionLabel from './ListSectionLabel.svelte';
  import QuickAmountChips from './QuickAmountChips.svelte';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** Resource key (or literal text). */
    meta?: string;
    value?: string;
    /** Resource key (or literal text), e.g. a fiat estimate or a balance warning. */
    note?: string;
    tone?: 'default' | 'danger';
    muted?: boolean;
    symbol: string;
    mark?: string;
    gradient?: string;
    position?: 'top' | 'bottom' | 'alone';
    onChange?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onQuickSelect?: (fraction: number) => void;
    onTokenClick?: () => void;
  }

  let {
    label,
    meta = '',
    value,
    note = '',
    tone = 'default',
    muted = false,
    symbol,
    mark,
    gradient,
    position = 'top',
    onChange,
    onQuickSelect,
    onTokenClick,
  }: Props = $props();
  const t = useT();

  const empty = $derived(!onChange && (value == null || value === ''));
</script>

<div class="amount-card {position}">
  <ListSectionLabel {label} {meta} />
  <div class="main">
    {#if onChange}
      <input
        class="amount"
        class:danger={tone === 'danger'}
        class:muted
        value={value ?? ''}
        oninput={onChange}
        inputmode="decimal"
        placeholder="0"
        aria-label={t(label)}
      />
    {:else}
      <span class="amount shown" class:danger={tone === 'danger'} class:muted={empty || muted}>{empty ? '—' : value}</span>
    {/if}
    <span class="token" onclick={onTokenClick} aria-label={t('ui.amountCard.changeToken')} role="button" tabindex="0" title={t('ui.amountCard.changeToken')}>
      <TokenAvatar size={28} {symbol} {mark} {gradient} />
      <span class="symbol">{symbol}</span>
      <span class="caret"></span>
    </span>
  </div>
  <div class="foot">
    <span class="note" class:danger={tone === 'danger'}>{t(note)}</span>
    {#if onQuickSelect}<QuickAmountChips onSelect={onQuickSelect} />{/if}
  </div>
</div>

<style>
  .amount-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    box-sizing: border-box;
    border-radius: 12px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .top {
    padding: 18px 18px 22px;
  }

  .bottom {
    padding: 22px 18px 18px;
  }

  .main {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .amount {
    flex: 1;
    min-width: 0;
    font: 700 32px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  input.amount {
    border: 0;
    outline: 0;
    padding: 0;
    background: transparent;
  }

  .shown {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .amount.muted {
    color: var(--ink-5, #6e6e7c);
  }

  .amount.danger {
    color: var(--status-danger, #f5493d);
  }

  .token {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 10px 0 6px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    cursor: pointer;
    user-select: none;
  }

  .token:hover {
    background: var(--btn-hover);
  }

  .symbol {
    font: 700 14px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .caret {
    width: 12px;
    height: 12px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .foot {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .note {
    flex: 1;
    min-width: 120px;
    font: 500 12.5px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .note.danger {
    color: var(--status-danger, #f5493d);
  }
</style>

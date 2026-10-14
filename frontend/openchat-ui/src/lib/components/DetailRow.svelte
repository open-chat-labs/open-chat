<!-- Label left, mono value right; for quotes, summaries and token facts. Optional copy, value tone (or raw valueColor),
     rule above/below, bold total. -->
<script lang="ts">
  import { useT } from '../i18n';
  import CopyButton from './CopyButton.svelte';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    value: string;
    tone?: 'default' | 'positive' | 'warning' | 'danger' | 'muted';
    valueColor?: string;
    size?: 'sm' | 'md' | 'lg';
    rule?: 'top' | 'bottom' | 'none';
    strong?: boolean;
    copyValue?: string;
    /** Resource key (or literal text). */
    copyLabel?: string;
  }

  let {
    label,
    value,
    tone = 'default',
    valueColor,
    size = 'md',
    rule = 'top',
    strong = false,
    copyValue = '',
    copyLabel = 'ui.common.copy',
  }: Props = $props();
  const t = useT();
</script>

<div class="detail-row {size}" class:rule-top={rule === 'top'} class:rule-bottom={rule === 'bottom'} class:strong>
  <span class="label">{t(label)}</span>
  <span class="value {tone}" style:color={valueColor || undefined}>{value}</span>
  {#if copyValue}
    <span class="copy"><CopyButton value={copyValue} label={copyLabel} /></span>
  {/if}
</div>

<style>
  .detail-row {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: 50px;
    box-sizing: border-box;
  }

  .sm {
    min-height: 42px;
  }

  .lg {
    min-height: 56px;
  }

  .rule-top {
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.06));
  }

  .rule-bottom {
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.06));
  }

  .label {
    flex: none;
    font: var(--weight-medium) 13.5px/1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .strong .label {
    font: 700 14.5px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .value {
    flex: 1;
    min-width: 0;
    text-align: end;
    font: 600 13px/1.3 var(--font-mono);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .strong .value {
    font: 700 15px/1.3 var(--font-mono);
  }

  .positive {
    color: var(--status-online, #2ee6a8);
  }

  .warning {
    color: var(--status-gold, #ffb03d);
  }

  .danger {
    color: var(--status-danger, #f5493d);
  }

  .muted {
    color: var(--ink-3, #9a9aa8);
  }

  .copy {
    flex: none;
    display: flex;
    margin-inline-end: -6px;
  }
</style>

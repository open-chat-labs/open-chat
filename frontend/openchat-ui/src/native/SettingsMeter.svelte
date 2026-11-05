<!-- Settings row with a meter (Storage): the label and the amount in mono, a 6px bar filled in the accent, and
     optional help. The fill eases to a new amount over 300ms (not with reduced motion). -->
<script lang="ts">
  import { useT } from '../lib/i18n';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** Resource key (or literal text): the amount as shown ("3.4 of 10 GB"). */
    value: string;
    /** How full, 0 to 1. */
    fraction: number;
    /** Resource key (or literal text). */
    help?: string;
  }

  let { label, value, fraction, help = '' }: Props = $props();
  const t = useT();

  const fill = $derived(Math.min(1, Math.max(0, fraction)));
</script>

<div class="settings-row meter-row">
  <span class="head">
    <span class="label">{t(label)}</span>
    <span class="value">{t(value)}</span>
  </span>
  <span class="bar" role="meter" aria-label={t(label)} aria-valuemin={0} aria-valuemax={1} aria-valuenow={fill} aria-valuetext={t(value)}>
    <span class="fill" style:width="{fill * 100}%"></span>
  </span>
  {#if help}<span class="help">{t(help)}</span>{/if}
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .meter-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .value {
    flex: none;
    font: var(--weight-semibold) text-size(13px) / 1 var(--font-mono);
    color: var(--ink-2);
  }

  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--overlay-2);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    transition: width 0.3s;
  }

  .help {
    font: var(--weight-medium) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink-4);
  }

  @include reduced-motion {
    .fill {
      transition: none;
    }
  }
</style>

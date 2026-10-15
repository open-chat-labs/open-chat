<!-- Fraction-of-balance shortcuts. Emits onSelect(fraction); the parent turns it into an amount (respecting decimals and fees). -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    options?: number[];
    size?: 'sm' | 'md';
    onSelect?: (fraction: number) => void;
  }

  let { options = [0.25, 0.5, 0.75, 1], size = 'sm', onSelect }: Props = $props();
  const t = useT();
</script>

<div class="chips" role="group" aria-label={t('ui.quickAmountChips.label')}>
  {#each options as fraction}
    <span class="chip" class:md={size === 'md'} onclick={() => onSelect?.(fraction)} role="button" tabindex="0">
      {fraction >= 1 ? t('ui.quickAmountChips.max') : t('ui.quickAmountChips.percent', { percent: Math.round(fraction * 100) })}
    </span>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .chip {
    flex: none;
    height: 28px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    border-radius: 8px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
    font: 600 12px/1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .chip:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
  }

  .md {
    height: 30px;
    padding: 0 12px;
    border-radius: 9px;
    font-size: 12.5px;
  }
</style>

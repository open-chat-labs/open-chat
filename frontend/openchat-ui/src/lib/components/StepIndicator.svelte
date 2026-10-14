<!-- Horizontal journey steps for page headers (Details → Quote → Swap). current is 0-based; complete ticks every step.
     compact shows only the current step's label (narrow layouts). -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    /** Step labels: resource keys (or literal text). */
    steps: string[];
    current?: number;
    complete?: boolean;
    compact?: boolean;
  }

  let { steps, current = 0, complete = false, compact = false }: Props = $props();
  const t = useT();
</script>

<div class="steps" aria-label={t('ui.stepIndicator.progress', { step: Math.min(current, steps.length - 1) + 1, total: steps.length })}>
  {#each steps as label, i}
    <span class="step" class:current={i === current} aria-current={!complete && i === current ? 'step' : undefined}>
      <span class="num" class:on={complete || i <= current}>{complete || i < current ? '✓' : i + 1}</span>
      {#if !compact || i === current}<span>{t(label)}</span>{/if}
      {#if i < steps.length - 1}<span class="sep"></span>{/if}
    </span>
  {/each}
</div>

<style>
  .steps {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 6px;
    font: var(--weight-semibold) 12px/1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
    white-space: nowrap;
  }

  .step.current {
    color: var(--ink, #ececf1);
  }

  .num {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    font: 700 11px/1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .num.on {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .sep {
    width: 14px;
    height: 1px;
    background: var(--line-2, rgba(255, 255, 255, 0.14));
  }
</style>

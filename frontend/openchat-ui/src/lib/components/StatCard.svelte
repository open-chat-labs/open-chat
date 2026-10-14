<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    /** Resource key (or literal text). */
    label: string;
    value: string;
    emphasis?: boolean;
  }

  let { label, value, emphasis = false }: Props = $props();
  const t = useT();
</script>

<div class="stat-card">
  <div class="card">
    <span class="label">{t(label)}</span>
    <span class="value" class:emphasis>{value}</span>
  </div>
</div>

<style>
  .stat-card {
    width: 100%;
  }

  .card {
    box-sizing: border-box;
    padding: var(--space-14) var(--space-16);
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .label {
    font: var(--weight-medium) var(--text-2xs) / 1 var(--font-mono);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-4, #6e6e7c);
  }

  .value {
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .emphasis {
    color: var(--accent-bright, #ff8298);
  }
</style>

<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    size?: number;
    tone?: 'accent' | 'ink';
    /** Resource key (or literal text) for the accessible name. */
    label?: string;
  }

  let { size = 32, tone = 'accent', label = 'ui.spinner.loading' }: Props = $props();
  const t = useT();

  const stroke = $derived(size <= 20 ? 2 : size <= 36 ? 2.5 : 3);
  const r = $derived(12 - stroke / 2);
  const dash = $derived.by(() => {
    const c = 2 * Math.PI * r;
    return `${c * 0.28} ${c}`;
  });
</script>

<div class="spinner" role="status" aria-label={t(label)}>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" {r} stroke="var(--overlay-2,rgba(255,255,255,.1))" stroke-width={stroke} />
    <circle
      cx="12"
      cy="12"
      {r}
      stroke={tone === 'ink' ? 'var(--ink,#ECECF1)' : 'var(--accent,#FF5672)'}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={dash}
    />
  </svg>
</div>

<style>
  .spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }

  svg {
    display: block;
    animation: oc-spin 0.9s linear infinite;
  }
</style>

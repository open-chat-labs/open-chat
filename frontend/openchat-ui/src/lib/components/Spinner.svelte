<!-- `delay`: it stays hidden that long (invisible, and out of the accessibility tree, so it isn't announced), then fades
     in, so a load that finishes sooner never shows it. Under reduced motion it just appears after the delay. -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    size?: number;
    tone?: 'accent' | 'ink';
    /** Resource key (or literal text) for the accessible name. */
    label?: string;
    /** ms it stays hidden before fading in (0: shown at once). */
    delay?: number;
  }

  let { size = 32, tone = 'accent', label = 'ui.spinner.loading', delay = 0 }: Props = $props();
  const t = useT();

  const stroke = $derived(size <= 20 ? 2 : size <= 36 ? 2.5 : 3);
  const r = $derived(12 - stroke / 2);
  const dash = $derived.by(() => {
    const c = 2 * Math.PI * r;
    return `${c * 0.28} ${c}`;
  });
</script>

<div
  class="spinner"
  class:delayed={delay > 0}
  style:--spinner-delay="{delay}ms"
  role="status"
  aria-label={t(label)}
>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" {r} stroke="var(--overlay-2)" stroke-width={stroke} />
    <circle
      cx="12"
      cy="12"
      {r}
      stroke={tone === 'ink' ? 'var(--ink)' : 'var(--accent)'}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={dash}
    />
  </svg>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .spinner {
    @include flex-center(inline-flex);
    line-height: 0;

    /* hidden for the delay (its space kept, so nothing moves), then a short fade in */
    &.delayed {
      animation: spinner-in 220ms ease-out var(--spinner-delay) both;

      @include reduced-motion {
        animation-duration: 1ms;
      }
    }
  }

  @keyframes spinner-in {
    from {
      opacity: 0;
      visibility: hidden;
    }
    to {
      opacity: 1;
      visibility: visible;
    }
  }

  svg {
    display: block;
    animation: oc-spin 0.9s linear infinite;
  }
</style>

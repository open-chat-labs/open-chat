<!-- Thin share bar (token's share of the wallet). Minimum 2% sliver so tiny holdings stay visible;
     veiled (balances hidden) animates every bar to the same 33% so lengths don't leak holdings. -->
<script lang="ts">
  interface Props {
    share: number;
    gradient?: string;
    thickness?: number;
    veiled?: boolean;
  }

  let { share, gradient = 'var(--accent,#FF5672)', thickness = 2, veiled = false }: Props = $props();

  const clamped = $derived(Math.max(0, Math.min(100, Number(share))));
  const h = $derived(`${thickness}px`);
</script>

<span
  class="track"
  style:height={h}
  style:border-radius={h}
  role="meter"
  aria-valuenow={veiled ? undefined : Math.round(clamped)}
  aria-valuemin={0}
  aria-valuemax={100}
>
  <span
    class="fill"
    style:height={h}
    style:border-radius={h}
    style:width={veiled ? '33%' : `${Math.max(2, clamped).toFixed(1)}%`}
    style:background={gradient}
  ></span>
</span>

<style>
  .track {
    display: block;
    width: 100%;
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
  }

  .fill {
    display: block;
    transition: width 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
</style>

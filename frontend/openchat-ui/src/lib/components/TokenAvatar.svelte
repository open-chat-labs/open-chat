<!-- Token mark on its brand gradient. Sizes in use: 28 (headers, pills), 40 (rows), 52 (hero). Optional activity badge. -->
<script lang="ts">
  interface Props {
    symbol?: string;
    mark?: string;
    gradient?: string;
    size?: number;
    badge?: 'none' | 'send' | 'receive' | 'swap';
  }

  let {
    symbol = '',
    mark = '∞',
    gradient = 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    size = 40,
    badge = 'none',
  }: Props = $props();
</script>

<span
  class="token-avatar"
  class:small={size < 36}
  style:--size="{size}px"
  style:font-size="{Math.round(size * 0.38)}px"
  style:background={gradient}
  title={symbol}
>
  {mark}
  {#if badge !== 'none'}
    <span class="badge"><span class="badge-icon" style:mask="var(--icon-{badge}) center/contain no-repeat"></span></span>
  {/if}
</span>

<style>
  .token-avatar {
    --badge: 18px;
    --badge-icon: 10px;
    position: relative;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: var(--radius-pill);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    line-height: 1;
    font-family: var(--font-sans);
    color: #0b0b10;
  }

  .small {
    --badge: 14px;
    --badge-icon: 8px;
  }

  .badge {
    position: absolute;
    bottom: -3px;
    right: -3px;
    width: var(--badge);
    height: var(--badge);
    border-radius: var(--radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-3, #1b1b22);
    box-shadow: 0 0 0 2px var(--surface-1, #0e0e12);
  }

  .badge-icon {
    width: var(--badge-icon);
    height: var(--badge-icon);
    background: var(--ink-2, #c9c9d4);
  }
</style>

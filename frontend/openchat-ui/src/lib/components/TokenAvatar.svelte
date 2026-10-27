<!-- Token mark on its brand gradient, or its logo when given. Sizes in use: 28 (headers, pills), 40 (rows), 52 (hero).
     Optional activity badge. -->
<script lang="ts">
  interface Props {
    symbol?: string;
    mark?: string;
    gradient?: string;
    size?: number;
    badge?: 'none' | 'send' | 'receive' | 'swap' | 'own';
    /** The token's logo (an image URL), shown in place of the mark. */
    logo?: string;
  }

  let {
    symbol = '',
    mark = '∞',
    gradient = 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    size = 40,
    badge = 'none',
    logo,
  }: Props = $props();

  // a logo that fails to load falls back to the mark on its gradient
  let failedLogo = $state<string>();
  const showLogo = $derived(!!logo && failedLogo !== logo);
</script>

<span
  class="token-avatar"
  class:small={size < 36}
  style:--size="{size}px"
  style:font-size="{Math.round(size * 0.38)}px"
  style:background={showLogo ? 'transparent' : gradient}
  title={symbol}
>
  {#if showLogo}<img class="logo" src={logo} alt="" onerror={() => (failedLogo = logo)} />{:else}{mark}{/if}
  {#if badge !== 'none'}
    <span class="badge"><span class="badge-icon" style:mask="var(--icon-{badge === 'own' ? 'refresh' : badge}) center/contain no-repeat"></span></span>
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

  .logo {
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
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
    box-shadow: 0 0 0 2px var(--surface-1);
  }

  .badge-icon {
    width: var(--badge-icon);
    height: var(--badge-icon);
    background: var(--ink-2);
  }
</style>

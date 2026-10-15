<!-- Gradient avatar placeholder with an optional online dot. shape: circle | squircle (radius = a third of the size). -->
<script lang="ts">
  const GRADIENTS = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    blue: 'linear-gradient(140deg,#3d7bff,#7a3dff)',
    teal: 'linear-gradient(140deg,#2ee6a8,#1f8fbf)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff5f4d)',
    plum: 'linear-gradient(140deg,#b04dff,#4d2dff)',
  };

  interface Props {
    size?: number;
    shape?: 'circle' | 'squircle';
    color?: keyof typeof GRADIENTS;
    online?: boolean;
  }

  let { size = 42, shape = 'circle', color = 'violet', online = false }: Props = $props();

  const big = $derived(size >= 60);
</script>

<div class="avatar" style:width="{size}px" style:height="{size}px">
  <div
    class="face"
    style:border-radius={shape === 'circle' ? '999px' : `${Math.round(size * 0.33)}px`}
    style:background={GRADIENTS[color] ?? GRADIENTS.violet}
  >
    {#if online}
      <span class="dot" class:big></span>
    {/if}
  </div>
</div>

<style>
  .avatar {
    display: inline-flex;
    flex: none;
  }

  .face {
    position: relative;
    flex: none;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dot {
    position: absolute;
    bottom: 0;
    inset-inline-end: 0;
    width: 11px;
    height: 11px;
    border-radius: var(--radius-pill);
    background: var(--status-online, #2ee6a8);
    box-shadow: 0 0 0 3px var(--card, #0e0e12);
  }

  .dot.big {
    bottom: 2px;
    inset-inline-end: 2px;
    width: 14px;
    height: 14px;
  }
</style>

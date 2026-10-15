<!-- The right-hand card in wallet workspaces (Send summary, Swap quote, token card). Content is children. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    minHeight?: string;
    gap?: string;
    pad?: string;
    children?: Snippet;
  }

  let { minHeight = '0', gap = '0', pad = '24px', children }: Props = $props();
</script>

<div class="side-card" style:min-height={minHeight} style:gap style:padding={pad}>{@render children?.()}</div>

<style>
  .side-card {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg, 14px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }
</style>

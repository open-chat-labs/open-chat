<!-- The right-hand card in wallet workspaces (Send summary, Swap quote, token card). Content is children.
     fill stretches it to its parent's height (e.g. to match the form column next to it). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    minHeight?: string;
    /** Stretch to the parent's height. */
    fill?: boolean;
    gap?: string;
    pad?: string;
    children?: Snippet;
  }

  let { minHeight = '0', fill = false, gap = '0', pad = '24px', children }: Props = $props();
</script>

<div class="side-card" class:fill style:min-height={minHeight} style:gap style:padding={pad}>{@render children?.()}</div>

<style>
  .side-card {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
  }

  .fill {
    height: 100%;
  }
</style>

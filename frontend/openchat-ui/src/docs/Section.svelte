<!-- Docs section: anchor + heading + mono meta line, then the demos. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    title: string;
    /** Source file(s) and key variants, shown in mono beside the heading. */
    meta?: string;
    children?: Snippet;
  }

  let { id, title, meta = '', children }: Props = $props();
</script>

<section {id} class="section">
  <div class="head">
    <h2>{title}</h2>
    {#if meta}<span class="meta">{meta}</span>{/if}
  </div>
  {@render children?.()}
</section>

<style>
  .section { scroll-margin-top: 24px; display: flex; flex-direction: column; gap: 20px; }
  .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line-1); }
  h2 { margin: 0; font: 700 17px/1 var(--font-sans); letter-spacing: -0.015em; color: var(--ink); }
  .meta { font: 400 12px/1.4 var(--font-mono); color: var(--ink-4); }
</style>

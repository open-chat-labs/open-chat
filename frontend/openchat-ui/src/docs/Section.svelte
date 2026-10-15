<!-- Docs section: anchor + heading + mono meta line (+ a Props button when the meta names documented components),
     then the demos. The Props dialog shows one component's table, with chips to switch when the section has several. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import DialogShell from '../lib/components/DialogShell.svelte';
  import PropsTable from './PropsTable.svelte';
  import { componentsIn } from './props';

  interface Props {
    id: string;
    title: string;
    /** Source file(s) and key variants, shown in mono beside the heading. */
    meta?: string;
    /** Off where the section already is the props table (API group). */
    propsButton?: boolean;
    children?: Snippet;
  }

  let { id, title, meta = '', propsButton = true, children }: Props = $props();

  const documented = $derived(propsButton ? componentsIn(meta) : []);
  let open = $state(false);
  let shown = $state(0);
  const current = $derived(documented[Math.min(shown, documented.length - 1)]);
</script>

<section {id} class="section">
  <div class="head">
    <h2>{title}</h2>
    {#if meta}<span class="meta">{meta}</span>{/if}
    {#if documented.length}
      <button class="props-btn" type="button" onclick={() => ((shown = 0), (open = true))}>
        Props{#if documented.length > 1}<span class="count">{documented.length}</span>{/if}
      </button>
    {/if}
  </div>
  {@render children?.()}
</section>

{#if open && current}
  <DialogShell title="{current.name} props" width={860} height="auto" flush onClose={() => (open = false)}>
    <div class="props-body">
      {#if documented.length > 1}
        <div class="chips" role="tablist" aria-label="Component">
          {#each documented as c, i (c.name)}
            <span class="chip" class:on={i === shown} role="tab" tabindex="0" aria-selected={i === shown} onclick={() => (shown = i)}>{c.name}</span>
          {/each}
        </div>
      {/if}
      {#if current.description}<p class="desc">{current.description.split('\n')[0]}</p>{/if}
      <div class="scroll">
        <PropsTable component={current} />
      </div>
    </div>
  </DialogShell>
{/if}

<style>
  .section { scroll-margin-top: 92px; /* clears the floating theme bar */ display: flex; flex-direction: column; gap: 20px; }
  .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line-1); }
  h2 { margin: 0; font: 700 17px/1 var(--font-sans); letter-spacing: -0.015em; color: var(--ink); }
  .meta { flex: 1 1 0; min-width: 0; font: 400 12px/1.4 var(--font-mono); color: var(--ink-4); }

  .props-btn { flex: none; margin-inline-start: auto; align-self: center; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 0; border-radius: var(--radius-sm); background: var(--overlay-1); box-shadow: inset 0 0 0 1px var(--line-1); color: var(--ink-2); font: 600 12px/1 var(--font-sans); cursor: pointer; }
  .props-btn:hover { background: var(--overlay-2); color: var(--ink); }
  .count { font: 500 11px/1 var(--font-mono); color: var(--ink-4); }

  .props-body { display: flex; flex-direction: column; min-height: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 20px 0; }
  .chip { padding: 6px 10px; border-radius: var(--radius-pill); background: var(--overlay-1); box-shadow: inset 0 0 0 1px var(--line-1); font: 600 12px/1 var(--font-sans); color: var(--ink-2); cursor: pointer; user-select: none; }
  .chip:hover { color: var(--ink); }
  .chip.on { background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent-dim); color: var(--accent); }
  .desc { margin: 14px 20px 0; font: 400 13px/1.5 var(--font-sans); color: var(--ink-3); }
  .scroll { max-height: min(62vh, 620px); overflow-y: auto; padding: 16px 20px 16px; }
</style>

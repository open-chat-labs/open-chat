<!-- Generated from lib/SegmentedTabs.dc.html (source hash e4cc2aed) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './SegmentedTabs.logic.js';

  interface Props {
    labels?: string[];
    counts?: (number|null)[];
    selectedIndex?: number;
    dotIndexes?: number[];
    dotOnLast?: boolean;
    onSelect?: (i: number) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%">
  <div style="display:flex;gap:var(--space-4);height:var(--control-xl,44px);box-sizing:border-box;padding:var(--space-4);background:var(--overlay-1,rgba(255,255,255,.045));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.05));border-radius:var(--radius-md)" role="tablist" onkeydown={v.onKeyNav}>
    {#each (v.tabs ?? []) as tab, tab_i}
      <div class="dc-p0" style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;gap:var(--space-4);border-radius:var(--radius-sm);cursor:pointer;" onclick={tab?.onSelect} role="tab" aria-selected={tab?.ariaSel} tabindex={tab?.tabIdx}>
        {#if tab?.selected}
          <div style="position:absolute;inset:0;border-radius:var(--radius-sm);background:var(--card,#0e0e12);box-shadow:0 1px 2px rgba(0,0,0,.16),inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))"></div>
        {/if}
        <span style="position:relative;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{tab?.ink}">{t(tab?.label)}</span>
        {#if tab?.hasCount}
          <span style="position:relative;min-width:18px;box-sizing:border-box;padding:2px 5px;text-align:center;border-radius:var(--radius-pill);background:{tab?.countBg};font:var(--weight-semibold) var(--text-2xs)/1.35 var(--font-mono);color:{tab?.countInk}">{t(tab?.count)}</span>
        {/if}
        {#if tab?.dot}
          <span style="position:relative;width:5px;height:5px;border-radius:var(--radius-pill);background:var(--accent,#FF5672)"></span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>

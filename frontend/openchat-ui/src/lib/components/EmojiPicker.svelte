<!-- Generated from lib/EmojiPicker.dc.html (source hash 20d1754a) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './EmojiPicker.logic.js';

  interface Props {
    recent?: string[];
    selected?: string[];
    autoFocus?: boolean;
    onPick?: (emoji: string) => void;
    onBack?: () => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10,10px);padding:var(--space-10,10px)" role="dialog" aria-label="Pick a reaction" onkeydown={v.onKey}>
  <div style="flex:none;display:flex;align-items:center;gap:var(--space-6,6px)">
    {#if v.hasBack}
      <span class="dc-p0" style="flex:none;width:38px;height:38px;border-radius:var(--radius-md,10px);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-2,#C9C9D4)" onclick={v.back} role="button" tabindex="0" aria-label="Back to actions" data-tip="Back"><span style="width:16px;height:16px;background:currentColor;mask:var(--icon-back) center/contain no-repeat"></span></span>
    {/if}
    <div style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-8,8px);height:38px;padding:0 var(--space-12,12px);border-radius:var(--radius-md,10px);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:none;width:15px;height:15px;background:var(--ink-4,#8A8A99);mask:var(--icon-search) center/contain no-repeat"></span>
      <input style="flex:1;min-width:0;height:100%;padding:0;border:0;outline:none;background:transparent;font:var(--weight-regular) var(--text-sm,13px)/1 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={v.searchRef} value={v.query} oninput={v.onQuery} placeholder="Search emoji" aria-label="Search emoji">
    </div>
  </div>
  <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-12,12px);padding:0 var(--space-2,2px)" use:ref={v.gridRef}>
    {#each v.groups ?? [] as g, i0}
      <div style="display:flex;flex-direction:column;gap:var(--space-6,6px)">
        <span style="padding:0 var(--space-4,4px);font:var(--weight-semibold) var(--text-xs,11px)/1 var(--font-mono);letter-spacing:var(--tracking-wide,.06em);color:var(--ink-4,#8A8A99)">{t(g.label)}</span>
        <div style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:2px" role="grid">
          {#each g.items ?? [] as e, i1}
            <span class="dc-p1" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm,8px);background:{e.bg};box-shadow:{e.ring};font-size:22px;line-height:1;cursor:pointer;user-select:none" data-emoji="" onclick={e.pick} role="button" tabindex="0" aria-label={e.name} aria-pressed={e.pressedStr} title={e.name}>{t(e.char)}</span>
          {/each}
        </div>
      </div>
    {/each}
    {#if v.none}<span style="padding:var(--space-24,24px) 0;text-align:center;font:var(--weight-regular) var(--text-sm,13px)/1.4 var(--font-sans);color:var(--ink-4,#8A8A99)">No emoji match "{t(v.query)}"</span>{/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p1:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
</style>

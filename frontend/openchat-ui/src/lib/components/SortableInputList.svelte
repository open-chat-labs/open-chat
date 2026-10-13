<!-- Generated from lib/SortableInputList.dc.html (source hash eb476c6d) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './SortableInputList.logic.js';

  interface Props {
    values?: string[];
    min?: number;
    max?: number;
    maxLength?: number;
    itemLabel?: string;
    morePlaceholder?: string;
    label?: string;
    onChange?: (values: string[]) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;gap:6px;width:100%" use:ref={v.listRef} role="list" aria-label={v.label}>
  {#each v.rows ?? [] as a, i0}
    <div style="display:flex;align-items:center;gap:8px;height:46px;padding:0 6px 0 4px;border-radius:12px;background:var(--field,#14141a);box-shadow:{a.ring};transform:{a.shift};transition:{a.trans};position:relative;z-index:{a.z}" role="listitem" data-row={a.i}>
      <span class="dc-p0" style="flex:none;width:22px;height:30px;display:flex;align-items:center;justify-content:center;cursor:grab;opacity:{a.handleOp};touch-action:none;border-radius:6px" onpointerdown={a.grab} onkeydown={a.key} role="button" tabindex={a.handleTab} aria-label={a.moveAria} title="Drag to reorder"><span style="width:12px;height:14px;background:radial-gradient(circle,var(--ink-4,#8A8A99) 1.3px,transparent 1.6px) 0 0/6px 5px"></span></span>
      <input style="flex:1;min-width:0;height:100%;border:0;outline:none;background:transparent;padding:0;font:500 14px/1 var(--font-sans);color:var(--ink,#ECECF1)" value={a.value} oninput={a.onInput} onblur={v.tidy} maxlength={v.maxLength} placeholder={a.placeholder} aria-label={a.aria}>
      <span style="display:{a.dupShow};font:500 11.5px/1 var(--font-sans);color:var(--status-warning,#FFB03D)">Duplicate</span>
      <span style="display:{a.countShow};font:500 11.5px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(a.left)}</span>
      <span class="dc-p1" style="flex:none;display:{a.removeShow};width:30px;height:30px;border-radius:8px;align-items:center;justify-content:center;cursor:pointer" onclick={a.remove} role="button" tabindex="0" aria-label={a.removeAria}><span style="width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:var(--icon-close) center/contain no-repeat"></span></span>
    </div>
  {/each}
</div>

<style>
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
</style>

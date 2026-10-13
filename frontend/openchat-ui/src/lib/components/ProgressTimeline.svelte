<!-- Generated from lib/ProgressTimeline.dc.html (source hash 90f18732) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ProgressTimeline.logic.js';

  interface Props {
    phases?: { title: string, sub?: string, error?: string, state?: 'done'|'active'|'todo'|'failed', steps?: { label: string, state: 'done'|'active'|'todo'|'failed' }[] }[];
    density?: string;
    collapseDone?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column" role="list">
  {#if v.showSummary}
    <div style="display:flex;align-items:center;gap:12px;min-height:44px" role="listitem">
      <span style="flex:none;width:{v.dot};height:{v.dot};border-radius:var(--radius-pill);display:flex;align-items:center;justify-content:center;background:rgba(46,230,168,.14)"><span style="width:12px;height:12px;background:var(--status-online,#2EE6A8);mask:{v.checkMask}"></span></span>
      <span style="flex:1;min-width:0;font:600 14px/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.summary)}</span>
      <span style="flex:none;font:600 13px/1 var(--font-sans);color:var(--accent-bright,#FF8298);cursor:pointer;user-select:none" onclick={v.toggle} role="button" tabindex="0" aria-expanded={v.expanded}>View details</span>
    </div>
  {/if}
  {#if v.showList}
    {#each (v.phases ?? []) as ph, ph_i}
      <div style="display:flex;gap:14px" role="listitem">
        <div style="flex:none;display:flex;flex-direction:column;align-items:center">
          <span style="flex:none;width:{v.dot};height:{v.dot};border-radius:var(--radius-pill);display:flex;align-items:center;justify-content:center;background:{ph?.bg};box-shadow:{ph?.ring}"><span style="width:12px;height:12px;background:{ph?.ink};mask:{ph?.mask}"></span></span>
          <span style="flex:1;width:1px;min-height:{v.gapMin};background:{ph?.line}"></span>
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;padding:{v.rowPad}">
          <span style="font:600 14px/1.25 var(--font-sans);color:{ph?.titleInk}">{t(ph?.title)}</span>
          {#if ph?.hasSub}<span style="font:400 12.5px/1.4 var(--font-sans);color:{ph?.subInk};text-wrap:pretty">{t(ph?.sub)}</span>{/if}
          {#if ph?.showSteps}
            <div style="display:flex;flex-direction:column;gap:7px;padding-top:4px">
              {#each (ph?.steps ?? []) as st, st_i}<div style="display:flex;align-items:center;gap:9px;min-width:0"><span style="flex:none;width:14px;height:14px;display:flex;align-items:center;justify-content:center"><span style="width:{st?.size};height:{st?.size};border-radius:var(--radius-pill);background:{st?.fill};box-shadow:{st?.ring};mask:{st?.mask}"></span></span><span style="min-width:0;font:{st?.font};color:{st?.ink}">{t(st?.label)}</span></div>{/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
    {#if v.canHide}<span style="align-self:flex-start;margin:2px 0 0 42px;font:600 13px/1 var(--font-sans);color:var(--accent-bright,#FF8298);cursor:pointer;user-select:none" onclick={v.toggle} role="button" tabindex="0">Hide details</span>{/if}
  {/if}
</div>

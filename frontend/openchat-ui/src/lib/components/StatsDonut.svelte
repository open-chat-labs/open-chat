<!-- Generated from lib/StatsDonut.dc.html (source hash 44598fe9) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './StatsDonut.logic.js';

  interface Props {
    onlineMinutes?: number;
    onlineMinutesPrev?: number;
    slices?: {label:string,count:number,color?:string}[];
    extras?: {label:string,count:string}[];
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-22)">
  <div style="min-width:0;display:flex;flex-direction:column;align-items:center;gap:var(--space-4);padding-top:var(--space-18);text-align:center">
    <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty"><span style="color:var(--accent-bright,#FF8298)">{t(v.onlineNow)}</span> minutes online this month</span>
    <span style="font:var(--weight-regular) var(--text-md)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.onlinePrev)} minutes the previous month</span>
  </div>
  <div style="display:flex;justify-content:center;padding:var(--space-18) 0">
    <div style="flex:none;position:relative;width:220px;height:220px;border-radius:var(--radius-circle,50%);background:{v.ring}">
      <div style="position:absolute;inset:30px;border-radius:var(--radius-circle,50%);background:var(--surface-1,#0e0e12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-8)">
        <span style="font:var(--weight-bold) var(--text-2xl)/1 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">{t(v.totalLabel)}</span>
        <span style="font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">MESSAGES</span>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-6)">
    {#each (v.slices ?? []) as slice, slice_i}
      <div style="min-width:0;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-4);padding:var(--space-12) var(--space-14);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
        <span style="font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:{slice?.color}">{t(slice?.count)}</span>
        <span style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
          <span style="flex:none;width:13px;height:13px;background:var(--ink-4,#7C7C8C);mask:{slice?.mask}"></span>
          <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-xs)/1.3 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(slice?.label)}</span>
        </span>
      </div>
    {/each}
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-6)">
    {#each (v.extras ?? []) as extra, extra_i}
      <div style="min-width:0;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-4);padding:var(--space-12) var(--space-14);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
        <span style="font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(extra?.count)}</span>
        <span style="font:var(--weight-regular) var(--text-xs)/1.3 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(extra?.label)}</span>
      </div>
    {/each}
  </div>
</div>

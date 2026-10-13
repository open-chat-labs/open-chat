<!-- Generated from lib/TimedToggle.dc.html (source hash 3ee63b57) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './TimedToggle.logic.js';

  interface Props {
    label?: string;
    on?: boolean;
    value?: string;
    options?: string[];
    prefix?: string;
    offHint?: string;
    icon?: string | null;
    density?: string;
    defaultOpen?: boolean;
    stayOpen?: boolean;
    readOnly?: boolean;
    onChange?: (on: boolean) => void;
    onDurationChange?: (value: string) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;min-width:0">
  <div class="dc-p0" style="display:flex;align-items:{v.rowAlign};gap:{v.rowGap};min-height:{v.rowMinH};padding:{v.rowPad};box-sizing:border-box;cursor:{v.rowCursor};border-radius:{v.rowRadius};--dc-p0-0-0:{v.rowHover};" onclick={v.toggleExpand} role={v.rowRole} tabindex={v.rowTab} aria-expanded={v.expanded}>
    {#if v.hasIcon}
      <span style="flex:none;width:17px;height:17px;background:var(--ink-3,#9A9AA8);mask:{v.iconMask}"></span>
    {/if}
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:{v.textGap}">
      <span style="font:var(--weight-semibold) {v.titleSize}/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.label)}</span>
      <span style="display:flex;align-items:center;gap:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:{v.subInk};text-wrap:pretty">{t(v.sub)}{#if v.showCaret}<span style="flex:none;width:12px;height:12px;background:currentColor;mask:{v.caretMask};transform:{v.caretRot};transition:transform .15s"></span>{/if}</span>
    </span>
    {#if v.canEdit}
      <span style="flex:none;position:relative;width:42px;height:24px;border-radius:var(--radius-pill);background:{v.track};cursor:pointer;transition:background .15s" onclick={v.onSwitch} tabindex="0" role="switch" aria-checked={v.on} aria-label={v.label}><span style="position:absolute;top:3px;inset-inline-start:3px;width:18px;height:18px;border-radius:var(--radius-pill);background:{v.knob};transform:{v.shift};transition:transform .15s"></span></span>
    {/if}
    {#if v.readOnly}
      <span style="flex:none;padding:5px 10px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.status)}</span>
    {/if}
  </div>
  {#if v.showOptions}
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-6);margin-top:2px;padding:{v.gridPad};border-top:1px dashed var(--line-1,rgba(255,255,255,.07))" role="radiogroup" aria-label={v.label}>
      {#each (v.choices ?? []) as d, d_i}
        <span class="dc-p1" style="display:flex;align-items:center;justify-content:center;height:34px;padding:0 var(--space-6);border-radius:var(--radius-sm);background:{d?.bg};box-shadow:{d?.ring};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{d?.ink};white-space:nowrap;cursor:pointer;user-select:none;" onclick={d?.onPick} tabindex="0" role="radio" aria-checked={d?.on}>{t(d?.label)}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--dc-p0-0-0) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
</style>

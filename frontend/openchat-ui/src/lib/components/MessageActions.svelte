<!-- Generated from lib/MessageActions.dc.html (source hash b8b56d84) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './MessageActions.logic.js';
  import EmojiPicker from './EmojiPicker.svelte';

  interface Props {
    open?: boolean;
    items?: {label:string,variant?:'regular'|'danger'|'separator',mask?:string,onSelect?:()=>void}[];
    point?: {x:number,y:number};
    anchor?: {left:number,right:number,top:number,bottom:number};
    align?: 'start' | 'end';
    focus?: boolean;
    focusRect?: {left:number,top:number,width:number,height:number};
    focusEl?: HTMLElement;
    focusFirst?: boolean;
    reactions?: boolean;
    pickerOnly?: boolean;
    recent?: string[];
    selected?: string[];
    onReact?: (emoji: string) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

{#if v.open}
  {#if v.focus}
    <div style="position:fixed;inset:0;z-index:94;background:rgba(3,3,6,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:ocMaFade .16s ease-out" onclick={v.close} oncontextmenu={v.swallow}></div>
    <div style="position:fixed;z-index:95;left:{v.cloneLeft};top:{v.cloneTop};width:{v.cloneW};height:{v.cloneH};overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;-webkit-mask-image:{v.cloneMask};mask-image:{v.cloneMask};pointer-events:none;visibility:{v.vis};filter:drop-shadow(0 18px 36px rgba(0,0,0,.5));transition:top .18s ease-out" use:ref={v.cloneRef} aria-hidden="true"></div>
  {/if}
  <div style="position:fixed;z-index:96;left:{v.left};top:{v.top};visibility:{v.vis};display:flex;flex-direction:column;gap:{v.stackGap};width:{v.boxW};animation:ocMaIn .14s ease-out" use:ref={v.boxRef} role="menu" aria-label="Message actions" onkeydown={v.onKey} oncontextmenu={v.swallow}>
    {#if v.showStrip}
      <div style="flex:none;display:flex;align-items:center;gap:2px;padding:{v.stripPad};border-radius:{v.stripRadius};background:var(--surface-3,#24242e);box-shadow:{v.stripShadow};align-self:flex-start">
        {#each v.quick ?? [] as e, i0}
          <span class="dc-p0" style="width:{v.emojiBox};height:{v.emojiBox};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:{v.emojiSize};line-height:1;cursor:pointer;user-select:none;background:{e.bg};box-shadow:{e.ring};transition:transform .12s" onclick={e.pick} role="menuitemcheckbox" aria-checked={e.onStr} aria-label={e.label} tabindex="-1" data-ma-item="">{t(e.char)}</span>
        {/each}
        <span class="dc-p1" style="width:{v.emojiBox};height:{v.emojiBox};border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-2,#C9C9D4)" onclick={v.openPicker} role="menuitem" aria-label="More reactions" tabindex="-1" data-ma-item="" data-tip="More reactions"><span style="width:18px;height:18px;background:currentColor;mask:var(--icon-emoji) center/contain no-repeat"></span></span>
      </div>
    {/if}
    {#if v.focus}<div style="flex:none;height:{v.cloneH}" data-ma-slot=""></div>{/if}
    {#if v.showRows}
      <div style="flex:none;display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:16px;background:var(--surface-3,#24242e);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 16px 40px rgba(0,0,0,.5);align-self:flex-start;width:{v.rowsW};box-sizing:border-box">
        {#if v.inlineStrip}
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 6px;margin-bottom:4px;box-shadow:inset 0 -1px 0 var(--line-1,rgba(255,255,255,.07))">
            {#each v.quick ?? [] as e, i1}
              <span class="dc-p2" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;line-height:1;cursor:pointer;user-select:none;background:{e.bg};box-shadow:{e.ring};transition:transform .12s" onclick={e.pick} role="menuitemcheckbox" aria-checked={e.onStr} aria-label={e.label} tabindex="-1" data-ma-item="">{t(e.char)}</span>
            {/each}
            <span class="dc-p3" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-2,#C9C9D4)" onclick={v.openPicker} role="menuitem" aria-label="More reactions" tabindex="-1" data-ma-item="" data-tip="More reactions"><span style="width:18px;height:18px;background:currentColor;mask:var(--icon-emoji) center/contain no-repeat"></span></span>
          </div>
        {/if}
        {#each v.rows ?? [] as r, i2}
          {#if r.sep}<div style="height:1px;margin:4px 6px;background:var(--line-1,rgba(255,255,255,.07))" role="separator"></div>{/if}
          {#if r.row}
            <div class="dc-p4" style="display:flex;align-items:center;gap:10px;height:{v.rowH};padding:0 10px;border-radius:10px;font:500 13.5px/1 var(--font-sans);color:{r.ink};cursor:pointer;user-select:none" onclick={r.pick} role="menuitem" tabindex="-1" data-ma-item=""><span style="flex:none;width:16px;height:16px;background:currentColor;mask:{r.mask}"></span><span style="flex:1;white-space:nowrap">{t(r.label)}</span></div>
          {/if}
        {/each}
      </div>
    {/if}
    {#if v.showPicker}
      <div style="flex:none;width:{v.pickerW};height:{v.pickerH};border-radius:16px;background:var(--surface-3,#24242e);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 16px 40px rgba(0,0,0,.5);display:grid;grid-template-rows:minmax(0,1fr);grid-template-columns:minmax(0,1fr);overflow:hidden">
        <div style="min-height:0;height:100%"><EmojiPicker recent={v.recent} selected={v.selected} onPick={v.pickAny} onBack={v.backFn} onClose={v.close}></EmojiPicker></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;transform:scale(1.12) !important}
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p1:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;transform:scale(1.12) !important}
  .dc-p2:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p3:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p4:focus-visible{background:var(--overlay-2,rgba(255,255,255,.08)) !important;outline:none !important}
</style>

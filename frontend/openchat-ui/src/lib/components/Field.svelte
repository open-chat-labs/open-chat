<!-- Generated from lib/Field.dc.html (source hash 5b2c7160) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Field.logic.js';

  interface Props {
    placeholder?: string;
    value?: string;
    onInput?: (e: Event) => void;
    onClear?: () => void;
    shortcut?: string;
    showIcon?: boolean;
    showShortcut?: boolean;
    help?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%">
  <div style="display:flex;align-items:center;gap:var(--space-8);height:var(--control-xl,44px);box-sizing:border-box;padding:0 var(--space-12);border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.045));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.05))">
    {#if v.showIcon}
      <span style="width:15px;height:15px;flex:none;background:var(--ink-4,#6E6E7C);mask:var(--icon-search) center/contain no-repeat"></span>
    {/if}
    {#if v.isStatic}
      <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-base)/1 var(--font-sans);color:var(--ink-4,#63636F);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.placeholder)}</span>
    {/if}
    {#if v.isInput}
      <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-regular) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1)" value={v.value} oninput={v.onInput} placeholder={v.placeholder} />
    {/if}
    {#if v.showClear}
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));cursor:pointer;" onclick={v.onClear} role="button" tabindex="0">
        <span style="width:11px;height:11px;background:var(--ink-3,#9A9AA8);mask:var(--icon-close) center/contain no-repeat"></span>
      </span>
    {/if}
    {#if v.showShortcut}
      <span style="flex:none;font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#63636F);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));border-radius:var(--radius-xs);padding:var(--space-4) var(--space-4)">{t(v.shortcut)}</span>
    {/if}
  </div>
  {#if v.hasHelp}
    <div style="display:flex;margin-top:7px;padding-inline-start:var(--space-12)">
      {#if v.showIcon}
        <span style="flex:none;inline-size:23px"></span>
      {/if}
      <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-3,#8A8A99);text-wrap:pretty">{t(v.help)}</span>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
</style>

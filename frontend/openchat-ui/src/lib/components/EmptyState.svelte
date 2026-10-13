<!-- Generated from lib/EmptyState.dc.html (source hash 824a4c25) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './EmptyState.logic.js';

  interface Props {
    preset?: string;
    title?: string;
    body?: string;
    actionLabel?: string;
    icon?: string;
    tone?: string;
    actionHandler?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;min-height:220px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-14);padding:var(--space-32) var(--space-26);text-align:center">
  <span style="flex:none;display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:var(--radius-xl);background:{v.iconWash}">
    <span style="width:24px;height:24px;background:{v.iconColor};mask:{v.iconMask}"></span>
  </span>
  <div style="display:flex;flex-direction:column;gap:var(--space-6);max-width:340px">
    <span style="font:var(--weight-bold) var(--text-lg)/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">{t(v.title)}</span>
    <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#8A8A99);text-wrap:pretty">{t(v.body)}</span>
  </div>
  {#if v.hasAction}
    <div class="dc-p0" style="display:inline-flex;align-items:center;justify-content:center;height:var(--control-md);padding:0 var(--space-16);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none;" onclick={v.actionHandler} role="button" tabindex="0">{t(v.actionLabel)}</div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
</style>

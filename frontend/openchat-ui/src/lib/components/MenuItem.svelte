<!-- Generated from lib/MenuItem.dc.html (source hash 81252d62) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './MenuItem.logic.js';

  interface Props {
    label?: string;
    variant?: string;
    mask?: string;
    checkMask?: string;
    minVw?: number;
    maxVw?: number;
    shortcut?: string;
    onSelect?: () => void;
    icon?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%">
  {#if v.isSeparator}
    <span style="display:block;height:1px;margin:var(--space-4) var(--space-6);background:var(--line-2,rgba(255,255,255,.1))"></span>
  {/if}
  {#if v.isAction}
    <div class="dc-p0" style="display:flex;align-items:center;gap:var(--space-10);min-height:var(--control-xl,44px);padding:var(--space-8) var(--space-10);box-sizing:border-box;border-radius:var(--radius-sm);cursor:pointer;white-space:nowrap;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:{v.color};" onclick={v.onSelect} role="menuitem" tabindex="-1">
      {#if v.hasIcon}
        <span style="flex:none;width:16px;height:16px;background:{v.color};mask:{v.mask}"></span>
      {/if}
      <span style="flex:1;min-width:0">{t(v.label)}</span>
      {#if v.hasCheck}
        <span style="flex:none;width:15px;height:15px;background:var(--accent,#FF5672);mask:{v.checkMask}"></span>
      {/if}
      {#if v.hasShortcut}
        <span style="flex:none;font:var(--weight-regular) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#6E6E7C)">{t(v.shortcut)}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>

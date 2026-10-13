<!-- Generated from lib/Banner.dc.html (source hash 0beff5f6) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Banner.logic.js';

  interface Props {
    text?: string;
    tone?: string;
    actionLabel?: string;
    actionHandler?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-10);padding:var(--space-14) var(--space-18);border-radius:var(--radius-md);background:{v.wash};box-shadow:inset 0 0 0 1px {v.line}">
  <span style="flex:none;width:16px;height:16px;background:{v.tint};mask:{v.iconMask}"></span>
  <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1.4 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">{t(v.text)}</span>
  {#if v.hasAction}
    <span style="flex:none;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.tint};cursor:pointer;user-select:none" onclick={v.actionHandler} role="button" tabindex="0">{t(v.actionLabel)}</span>
  {/if}
</div>

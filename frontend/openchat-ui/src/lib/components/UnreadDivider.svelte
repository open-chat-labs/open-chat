<!-- Generated from lib/UnreadDivider.dc.html (source hash d4f40e6e) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './UnreadDivider.logic.js';

  interface Props {
    label?: string;
    tone?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;display:flex;align-items:center;justify-content:center;gap:var(--space-12)">
  {#if v.isPill}
    <span style="flex:none;display:flex;align-items:center;height:26px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-pill);background:var(--field,#14141a);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.pillLabel)}</span>
  {/if}
  {#if v.isLine}
    <span style="flex:1;height:1px;background:{v.lineColor}"></span>
    <span style="flex:none;font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:{v.textColor}">{t(v.label)}</span>
    <span style="flex:1;height:1px;background:{v.lineColor}"></span>
  {/if}
</div>

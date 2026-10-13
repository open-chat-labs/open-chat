<!-- Generated from lib/Tooltip.dc.html (source hash 27d349b2) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Tooltip.logic.js';

  interface Props {
    label?: string;
    placement?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:inline-flex;flex-direction:{v.dir};align-items:center">
  <span style="max-width:240px;padding:6px 9px;border-radius:7px;background:var(--ink,#ECECF1);color:var(--surface-1,#0e0e12);font:600 12px/1.3 var(--font-sans);text-wrap:balance;box-shadow:0 6px 20px rgba(0,0,0,.28)" role="tooltip">{t(v.label)}</span>
</div>

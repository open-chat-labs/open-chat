<!-- Generated from lib/Spinner.dc.html (source hash 8547dbf9) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Spinner.logic.js';

  interface Props {
    size?: number;
    tone?: string;
    label?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:inline-flex;align-items:center;justify-content:center;line-height:0" role="status" aria-label={v.label}><svg width={v.size} height={v.size} viewBox="0 0 24 24" fill="none" style="display:block;animation:oc-spin .9s linear infinite"><circle cx="12" cy="12" r={v.r} stroke="var(--overlay-2,rgba(255,255,255,.1))" stroke-width={v.stroke} /><circle cx="12" cy="12" r={v.r} stroke={v.arc} stroke-width={v.stroke} stroke-linecap="round" stroke-dasharray={v.dash} /></svg></div>

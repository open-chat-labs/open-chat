<!-- Generated from lib/StepIndicator.dc.html (source hash 491490cf) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './StepIndicator.logic.js';

  interface Props {
    steps?: string[];
    current?: number;
    complete?: boolean;
    compact?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="flex:none;display:flex;align-items:center;gap:6px" aria-label={v.aria}>{#each (v.steps ?? []) as st, st_i}<span style="display:flex;align-items:center;gap:6px;font:var(--weight-semibold) 12px/1 var(--font-sans);color:{st?.ink};white-space:nowrap" aria-current={st?.current}><span style="width:20px;height:20px;border-radius:var(--radius-pill);display:flex;align-items:center;justify-content:center;background:{st?.bg};font:700 11px/1 var(--font-mono);color:{st?.numInk}">{t(st?.n)}</span><span style="display:{st?.labelShow}">{t(st?.label)}</span><span style="width:14px;height:1px;background:var(--line-2,rgba(255,255,255,.14));display:{st?.sep}"></span></span>{/each}</div>

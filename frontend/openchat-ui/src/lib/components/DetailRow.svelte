<!-- Generated from lib/DetailRow.dc.html (source hash 10ca55c5) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './DetailRow.logic.js';
  import CopyButton from './CopyButton.svelte';

  interface Props {
    label?: string;
    value?: string;
    tone?: string;
    valueColor?: string;
    size?: string;
    rule?: string;
    strong?: boolean;
    copyValue?: string;
    copyLabel?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;align-items:center;gap:var(--space-10);min-height:{v.minH};box-sizing:border-box;border-top:{v.ruleTop};border-bottom:{v.ruleBottom}">
  <span style="flex:none;font:{v.labelFont};color:{v.labelInk}">{t(v.label)}</span>
  <span style="flex:1;min-width:0;text-align:end;font:{v.valueFont};color:{v.valueInk};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.value)}</span>
  {#if v.hasCopy}<span style="flex:none;display:flex;margin-inline-end:-6px"><CopyButton value={v.copyValue} label={v.copyLabel}></CopyButton></span>{/if}
</div>

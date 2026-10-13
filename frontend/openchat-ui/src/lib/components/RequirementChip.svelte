<!-- Generated from lib/RequirementChip.dc.html (source hash 3ea36e0b) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './RequirementChip.logic.js';

  interface Props {
    label?: string;
    state?: 'met' | 'unmet' | 'neutral';
    met?: boolean;
    icon?: string;
    size?: 'sm' | 'md';
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="flex:none;display:inline-flex;align-items:center;gap:5px;height:{v.h};padding:0 {v.px};border-radius:999px;background:{v.bg};font:600 {v.fs}/1 var(--font-sans);color:{v.ink};white-space:nowrap" role="listitem" aria-label={v.aria}><span style="width:12px;height:12px;background:currentColor;mask:{v.mask}" aria-hidden="true"></span>{t(v.label)}</span>

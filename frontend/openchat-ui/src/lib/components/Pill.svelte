<!-- Generated from lib/Pill.dc.html (source hash 594a3b26) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Pill.logic.js';

  interface Props {
    label?: string;
    tone?: string;
    size?: string;
    dot?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="flex:none;width:max-content;min-width:max-content;display:inline-flex;align-items:center;gap:5px;height:{v.h};padding:0 {v.padX};box-sizing:border-box;border-radius:var(--radius-pill);background:{v.bg};font:{v.font};color:{v.ink};white-space:nowrap">{#if v.dot}<span style="width:6px;height:6px;border-radius:var(--radius-pill);background:{v.ink}"></span>{/if}<span style="flex:none">{t(v.label)}</span></span>

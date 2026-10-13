<!-- Generated from lib/StatCard.dc.html (source hash 99b85629) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './StatCard.logic.js';

  interface Props {
    label?: string;
    value?: string;
    emphasis?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%">
  <div style="box-sizing:border-box;padding:var(--space-14) var(--space-16);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));display:flex;flex-direction:column;gap:var(--space-8)">
    <span style="font:var(--weight-medium) var(--text-2xs)/1 var(--font-mono);letter-spacing:.05em;color:var(--ink-4,#6E6E7C)">{t(v.label)}</span>
    <span style="font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:{v.valueInk}">{t(v.value)}</span>
  </div>
</div>

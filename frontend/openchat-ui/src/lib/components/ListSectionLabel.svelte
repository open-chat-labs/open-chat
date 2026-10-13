<!-- Generated from lib/ListSectionLabel.dc.html (source hash 0ec0eea5) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ListSectionLabel.logic.js';

  interface Props {
    label?: string;
    meta?: string;
    inset?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;align-items:center;gap:var(--space-10);min-width:0;padding-inline-start:{v.inset}">
  <span style="flex:1;min-width:0;font:var(--weight-semibold) 11.5px/1 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4,#8A8A99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.label)}</span>
  {#if v.hasMeta}<span style="flex:none;font:var(--weight-medium) 12px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.meta)}</span>{/if}
</div>

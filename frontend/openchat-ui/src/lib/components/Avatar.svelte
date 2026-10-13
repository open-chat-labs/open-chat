<!-- Generated from lib/Avatar.dc.html (source hash 1f9bbb41) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Avatar.logic.js';

  interface Props {
    size?: number;
    shape?: string;
    color?: string;
    online?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:inline-flex;flex:none;width:{v.size}px;height:{v.size}px">
  <div style="position:relative;flex:none;width:{v.size}px;height:{v.size}px;border-radius:{v.radius}px;background:{v.gradient};display:flex;align-items:center;justify-content:center">
    {#if v.online}
      <span style="position:absolute;bottom:{v.dotOffset}px;inset-inline-end:{v.dotOffset}px;width:{v.dotSize}px;height:{v.dotSize}px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8);box-shadow:0 0 0 3px var(--card,#0e0e12)"></span>
    {/if}
  </div>
</div>

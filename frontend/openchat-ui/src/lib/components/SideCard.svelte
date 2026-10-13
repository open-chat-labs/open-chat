<!-- Generated from lib/SideCard.dc.html (source hash 2385dab3) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './SideCard.logic.js';

  interface Props {
    minHeight?: string;
    gap?: string;
    pad?: string;
    children?: Snippet;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;min-height:{v.minH};box-sizing:border-box;display:flex;flex-direction:column;gap:{v.gap};padding:{v.pad};border-radius:var(--radius-lg,14px);background:var(--overlay-1,rgba(255,255,255,.04))">{@render v.children?.()}</div>

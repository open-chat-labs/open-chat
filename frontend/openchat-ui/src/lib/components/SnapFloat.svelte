<!-- Generated from lib/SnapFloat.dc.html (source hash 87d22dad) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './SnapFloat.logic.js';

  interface Props {
    position?: 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';
    width?: number | string;
    inset?: number;
    safeTop?: number;
    safeBottom?: number;
    zIndex?: number;
    label?: string;
    role?: string;
    onSnap?: (position: string) => void;
    children?: Snippet;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:absolute;z-index:{v.z};left:{v.l};right:{v.r};top:{v.t};bottom:{v.b};translate:{v.tr};width:{v.w};touch-action:none;cursor:grab;user-select:none" use:ref={v.ref} onpointerdown={v.down} ondragstart={v.noDrag} role={v.role} aria-label={v.label}>{@render v.children?.()}</div>

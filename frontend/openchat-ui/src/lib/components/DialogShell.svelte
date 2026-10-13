<!-- Generated from lib/DialogShell.dc.html (source hash 972fe63e) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './DialogShell.logic.js';
  import IconButton from './IconButton.svelte';

  interface Props {
    title?: string;
    width?: number;
    height?: string;
    flush?: boolean;
    z?: number;
    onClose?: () => void;
    children?: Snippet;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:{v.z};display:flex;align-items:center;justify-content:center;padding:24px">
  <div style="position:absolute;inset:0;background:var(--scrim);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)" onclick={v.onClose} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:{v.width};height:{v.height};max-height:100%;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--radius-xl,22px);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 64px rgba(0,0,0,.55);outline:none" use:ref={v.boxRef} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={v.title}>
    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);height:var(--header-h,66px);box-sizing:border-box;padding:0 var(--space-12) 0 var(--space-22,22px);border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.title)}</span>
      <div style="flex:none;display:flex"><IconButton label="Close" variant="ghost" icon="close" onClick={v.onClose}></IconButton></div>
    </div>
    <div style="flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);padding:{v.bodyPad}">{@render v.children?.()}</div>
  </div>
</div>

<!-- Generated from lib/PageHeader.dc.html (source hash 5a474f84) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './PageHeader.logic.js';
  import IconButton from './IconButton.svelte';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    title?: string;
    backLabel?: string;
    avatarMark?: string;
    avatarGradient?: string;
    onBack?: () => void;
    children?: Snippet;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="flex:none;width:100%;height:var(--header-h,66px);box-sizing:border-box;display:flex;align-items:center;gap:var(--space-10);padding:0 var(--space-24) 0 {v.padStart};border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
  {#if v.hasBack}<div style="flex:none;display:flex"><IconButton label={v.backLabel} variant="ghost" icon="back" onClick={v.onBack}></IconButton></div>{/if}
  {#if v.hasAvatar}<TokenAvatar size={28} mark={v.avatarMark} gradient={v.avatarGradient}></TokenAvatar>{/if}
  <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.title)}</span>
  {#if v.hasTrailing}<div style="flex:none;display:flex;align-items:center;gap:var(--space-8)">{@render v.children?.()}</div>{/if}
</div>

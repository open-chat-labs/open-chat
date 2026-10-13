<!-- Generated from lib/AvatarStack.dc.html (source hash 5c9166f0) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './AvatarStack.logic.js';

  interface Props {
    people?: Array<string | { grad?: string; src?: string; initial?: string; name?: string }>;
    max?: number;
    size?: number;
    initials?: boolean;
    ring?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="display:inline-flex;align-items:center;padding-left:{v.overlap}" role="img" aria-label={v.aria}>
  {#each v.shown ?? [] as f, i0}
    <span style="flex:none;width:{v.px};height:{v.px};margin-left:{v.neg};border-radius:50%;background:{f.bg};box-shadow:0 0 0 2px {v.ring};display:flex;align-items:center;justify-content:center;font:700 {v.fpx}/1 var(--font-sans);color:#0e0e12">{t(f.initial)}</span>
  {/each}
  {#if v.hasMore}
    <span style="flex:none;height:{v.px};min-width:{v.px};box-sizing:border-box;margin-left:{v.neg};padding:0 6px;border-radius:999px;background:var(--surface-3,#24242e);box-shadow:0 0 0 2px {v.ring};display:flex;align-items:center;justify-content:center;font:600 {v.fpx}/1 var(--font-mono);color:var(--ink,#ECECF1)">{t(v.more)}</span>
  {/if}
</span>

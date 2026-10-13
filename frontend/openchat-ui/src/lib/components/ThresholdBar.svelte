<!-- Generated from lib/ThresholdBar.dc.html (source hash 3a0c0b95) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ThresholdBar.logic.js';

  interface Props {
    yes?: number;
    no?: number;
    thresholds?: Array<{ at: number; label?: string; strong?: boolean }>;
    height?: number;
    yesColor?: string;
    noColor?: string;
    label?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;gap:6px;width:100%">
  <div style="position:relative;height:14px">
    {#each v.marks ?? [] as m, i0}
      {#if m.strong}<span style="position:absolute;left:{m.at};top:0;width:0;height:0;margin-left:-5px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid var(--ink,#ECECF1)" title={m.label}></span>{/if}
      {#if m.soft}<span style="position:absolute;left:{m.at};top:-2px;width:7px;height:7px;margin-left:-4.5px;box-sizing:border-box;border-right:2px solid var(--ink-2,#C9C9D4);border-bottom:2px solid var(--ink-2,#C9C9D4);transform:rotate(45deg)" title={m.label}></span>{/if}
    {/each}
  </div>
  <div style="position:relative;height:{v.h};margin-top:-6px;border-radius:4px;background:var(--overlay-2,rgba(255,255,255,.08))" role="img" aria-label={v.aria}>
    <span style="position:absolute;left:0;top:0;bottom:0;width:{v.yesW};border-radius:4px 0 0 4px;background:{v.yesInk};transition:width .45s cubic-bezier(.2,.7,.3,1)"></span>
    <span style="position:absolute;right:0;top:0;bottom:0;width:{v.noW};border-radius:0 4px 4px 0;background:{v.noInk};transition:width .45s cubic-bezier(.2,.7,.3,1)"></span>
    {#each v.marks ?? [] as m, i1}
      <span style="position:absolute;left:{m.at};top:-4px;bottom:-4px;width:2px;margin-left:-1px;border-radius:1px;background:{m.line}"></span>
    {/each}
  </div>
</div>

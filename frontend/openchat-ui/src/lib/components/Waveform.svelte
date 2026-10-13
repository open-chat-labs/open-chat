<!-- Generated from lib/Waveform.dc.html (source hash d43e3c8e) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Waveform.logic.js';

  interface Props {
    levels?: number[];
    count?: number;
    seed?: number;
    progress?: number;
    seekable?: boolean;
    handle?: boolean;
    height?: number;
    playedColor?: string;
    restColor?: string;
    ring?: string;
    label?: string;
    onSeek?: (fraction: number) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:{v.hpx};display:flex;align-items:center;justify-content:space-between;cursor:{v.cursor};touch-action:none;user-select:none" use:ref={v.rootRef} onpointerdown={v.down} onkeydown={v.key} role={v.role} tabindex={v.tab} aria-label={v.aria} aria-valuemin="0" aria-valuemax="100" aria-valuenow={v.pct}>
  {#each v.bars ?? [] as b, i0}
    <span style="flex:none;width:3px;height:{b.h};border-radius:999px;background:{b.c};transition:background 120ms"></span>
  {/each}
  {#if v.showHandle}
    <span style="position:absolute;top:50%;left:{v.handleX};width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:{v.playedInk};box-shadow:0 0 0 2px {v.ring};pointer-events:none" aria-hidden="true"></span>
  {/if}
</div>

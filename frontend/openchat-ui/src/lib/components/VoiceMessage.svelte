<!-- Generated from lib/VoiceMessage.dc.html (source hash e210f6a8) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './VoiceMessage.logic.js';
  import Waveform from './Waveform.svelte';

  interface Props {
    progress?: number;
    barCount?: number;
    elapsed?: string;
    total?: string;
    speed?: string;
    side?: string;
    lastInGroup?: boolean;
    time?: string;
    cornerBottomLeft?: number;
    onPlay?: () => void;
    onSpeedChange?: (speed: string) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;display:flex;justify-content:flex-start">
  <div style="text-align:start;width:330px;min-width:0;max-width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-12);background:var(--bubble-recv-bg,#191921);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));border-start-start-radius:{v.radiusTL};border-start-end-radius:{v.radiusTR};border-end-end-radius:{v.radiusBR};border-end-start-radius:{v.radiusBL};padding:var(--space-10) var(--space-14) var(--space-10) var(--space-12)">
    <div style="display:flex;align-items:center;gap:var(--space-14)">
      <div class="dc-p0" style="flex:none;width:30px;height:30px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.09));display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onPlay} role="button" tabindex="0">
        <span style="width:14px;height:14px;background:var(--ink,#E4E4EC);mask:var(--icon-compass) center/contain no-repeat"></span>
      </div>
      <div style="flex:1;min-width:0"><Waveform levels={v.levels} progress={v.prog} seekable={true} onSeek={v.seek} height={22} label="Seek voice message"></Waveform></div>
      <div class="dc-p1" style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:44px;height:22px;padding:0;box-sizing:border-box;border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.06));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-2,#B9B9C6);cursor:pointer;user-select:none" onclick={v.cycleSpeed} role="button" tabindex="0">{t(v.speed)}</div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-10);padding-inline-start:44px">
      <span style="flex:none;font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--accent,#FF5672)">{t(v.elapsed)}<span style="color:var(--ink-3,#8A8A99)"> / </span><span style="color:var(--ink,#E4E4EC)">{t(v.total)}</span></span>
      <span style="flex:none;font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--meta,#9393A2)">{t(v.time)}</span>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--btn-hover,rgba(255,255,255,.14)) !important}
  .dc-p1:hover{background:var(--btn-hover,rgba(255,255,255,.12)) !important}
</style>

<!-- Generated from lib/DmChatSettings.dc.html (source hash a1189237) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './DmChatSettings.logic.js';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';

  interface Props {
    peerName?: string;
    disappearOn?: boolean;
    disappearAfter?: string;
    readReceipts?: boolean;
    onDisappearChange?: (v: { on: boolean, after: string }) => void;
    onReadReceiptsChange?: (on: boolean) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04))">
  <div style="display:grid;grid-template-columns:minmax(0,1fr)"><TimedToggle density="compact" icon="clock" rowRadius="var(--radius-lg) var(--radius-lg) 0 0" label="Disappearing messages" on={v.dmOn} value={v.after} onChange={v.onDmOn} onDurationChange={v.onAfter}></TimedToggle></div>
  <div style="display:flex;align-items:center;gap:var(--space-14);min-height:64px;padding:var(--space-12) var(--space-16);box-sizing:border-box;border-top:1px solid var(--line-1,rgba(255,255,255,.06))">
    <span style="flex:none;width:17px;height:17px;background:var(--ink-3,#9A9AA8);mask:{v.eyeMask}"></span>
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)"><span style="font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Read receipts</span><span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(v.rrHint)}</span></span>
    <span style="flex:none;position:relative;width:42px;height:24px;border-radius:var(--radius-pill);background:{v.rrTrack};cursor:pointer;transition:background .15s" onclick={v.onRrSwitch} tabindex="0" role="switch" aria-checked={v.rrOn} aria-label="Read receipts"><span style="position:absolute;top:3px;inset-inline-start:3px;width:18px;height:18px;border-radius:var(--radius-pill);background:{v.rrKnob};transform:{v.rrShift};transition:transform .15s"></span></span>
  </div>
</div>

<!-- Generated from lib/ProposalMessage.dc.html (source hash e4139d49) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ProposalMessage.logic.js';
  import ThresholdBar from './ThresholdBar.svelte';

  interface Props {
    title?: string;
    kind?: string;
    proposer?: string;
    critical?: boolean;
    state?: 'open' | 'rejected' | 'expired' | 'executed';
    adopt?: number;
    reject?: number;
    softThreshold?: number;
    hardThreshold?: number;
    when?: string;
    myVote?: 'adopt' | 'reject' | null;
    canVote?: boolean;
    time?: string;
    lastInGroup?: boolean;
    onVote?: (side: 'adopt' | 'reject') => void;
    onDetails?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:340px;max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:var(--bubble-recv-bg,#191921);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));opacity:{v.op}">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div style="display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:2px 18px 6px 6px;background:var(--overlay-1,rgba(255,255,255,.045))">
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <span style="display:flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:12px;background:{v.oBg};font:700 11.5px/1 var(--font-sans);color:{v.oInk}"><span style="width:12px;height:12px;background:currentColor;mask:{v.oMask}"></span>{t(v.oLabel)}</span>
        {#if v.critical}<span style="display:flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:12px;background:var(--status-danger-soft,rgba(255,77,77,.12));font:600 11.5px/1 var(--font-sans);color:var(--status-danger,#FF4D4D)"><span style="width:11px;height:11px;background:currentColor;mask:var(--icon-shield) center/contain no-repeat"></span>Critical</span>{/if}
      </div>
      <span style="font:700 15.5px/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">{t(v.title)}</span>
      <span style="font:400 12px/1.4 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.kind)} · by <span style="color:var(--accent-bright,#FF8298);font-weight:600">{t(v.proposer)}</span></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:6px;background:var(--overlay-1,rgba(255,255,255,.045))">
      <ThresholdBar yes={v.tbYes} no={v.tbNo} thresholds={v.tbMarks} label={v.barLabel}></ThresholdBar>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <span style="font:700 14px/1 var(--font-mono);color:var(--status-online,#2EE6A8)">{t(v.yes)}<span style="margin-left:5px;font:500 11.5px/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">adopt</span></span>
        <span style="font:700 14px/1 var(--font-mono);color:var(--status-danger,#FF4D4D)"><span style="margin-right:5px;font:500 11.5px/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">reject</span>{t(v.no)}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 14px;font:500 11.5px/1.3 var(--font-sans);color:var(--ink-3,#9A9AA8)"><span style="display:flex;align-items:center;gap:6px"><span style="width:7px;height:7px;margin:-3px 1px 0;box-sizing:border-box;border-right:2px solid var(--ink-2,#C9C9D4);border-bottom:2px solid var(--ink-2,#C9C9D4);transform:rotate(45deg)"></span>{t(v.softLabel)}</span><span style="display:flex;align-items:center;gap:6px"><span style="width:0;height:0;border-left:4.5px solid transparent;border-right:4.5px solid transparent;border-top:6px solid var(--ink,#ECECF1)"></span>{t(v.hardLabel)}</span></div>
      <span style="display:flex;align-items:center;gap:6px;font:500 12px/1 var(--font-sans);color:{v.whenInk}"><span style="width:12px;height:12px;background:currentColor;mask:var(--icon-clock) center/contain no-repeat"></span>{t(v.when)}</span>
    </div>
    {#if v.canVote}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <span class="dc-p0" style="display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:6px;background:color-mix(in oklch,var(--status-online,#2EE6A8) 16%,transparent);font:700 13.5px/1 var(--font-sans);color:var(--status-online,#2EE6A8);cursor:pointer" onclick={v.adopt} role="button" tabindex="0"><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-check) center/contain no-repeat"></span>Adopt</span>
        <span class="dc-p1" style="display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:6px;background:var(--status-danger-soft,rgba(255,77,77,.12));font:700 13.5px/1 var(--font-sans);color:var(--status-danger,#FF4D4D);cursor:pointer" onclick={v.reject} role="button" tabindex="0"><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-close) center/contain no-repeat"></span>Reject</span>
      </div>
    {/if}
    <span style="display:flex;align-items:center;justify-content:space-between;height:40px;padding:0 14px;border-radius:6px;background:var(--overlay-1,rgba(255,255,255,.045));font:600 12.5px/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer" onclick={v.onDetails} role="button" tabindex="0">Proposal details<span style="width:12px;height:12px;background:currentColor;mask:var(--icon-external) center/contain no-repeat"></span></span>
  </div>
  <div style="display:flex;justify-content:flex-end;padding:6px 10px 4px;font:400 11px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.time)}</div>
</div>

<style>
  .dc-p0:hover{background:color-mix(in oklch,var(--status-online,#2EE6A8) 24%,transparent) !important}
  .dc-p1:hover{background:color-mix(in oklch,var(--status-danger,#FF4D4D) 20%,transparent) !important}
</style>

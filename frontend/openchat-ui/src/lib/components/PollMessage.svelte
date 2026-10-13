<!-- Generated from lib/PollMessage.dc.html (source hash 19377bd9) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './PollMessage.logic.js';
  import AvatarStack from './AvatarStack.svelte';

  interface Props {
    question?: string;
    options?: { label: string; votes?: number; voters?: string[] }[];
    multiple?: boolean;
    publicVotes?: boolean;
    canChange?: boolean;
    closed?: boolean;
    endsIn?: string;
    myVotes?: number[];
    side?: 'received' | 'sent';
    time?: string;
    lastInGroup?: boolean;
    onVote?: (indexes: number[]) => void;
    onViewVotes?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:330px;max-width:100%;padding:4px;box-sizing:border-box;border-radius:{v.shellR};background:{v.bg};box-shadow:{v.ring}">
  <div style="display:flex;flex-direction:column;gap:4px">
    <div style="display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:2px 18px 6px 6px;background:{v.seg}">
      <span style="display:flex;align-items:center;gap:6px;font:600 11.5px/1 var(--font-sans);color:{v.soft}"><span style="width:13px;height:13px;background:currentColor;mask:var(--icon-poll) center/contain no-repeat"></span>Poll</span>
      <span style="font:700 16px/1.3 var(--font-sans);color:{v.ink};text-wrap:pretty">{t(v.question)}</span>
      <div style="display:flex;flex-wrap:wrap;gap:6px">{#each v.rules ?? [] as r, i0}<span style="display:flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:11px;background:{v.chip};font:500 11.5px/1 var(--font-sans);color:{v.soft}"><span style="width:11px;height:11px;background:currentColor;mask:{r.mask}"></span>{t(r.label)}</span>{/each}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:20px;padding:20px 14px;border-radius:6px;background:{v.seg}" role={v.groupRole} aria-label="Poll options">
      {#each v.opts ?? [] as o, i1}
        <div class="dc-p0" style="display:flex;flex-direction:column;gap:7px;cursor:{v.cursor};outline:none" onclick={o.pick} role={o.role} aria-checked={o.checked} tabindex="0">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="flex:none;width:18px;height:18px;border-radius:{v.markR};box-shadow:{o.markRing};background:{o.markBg};display:flex;align-items:center;justify-content:center"><span style="display:{o.tick};width:11px;height:11px;background:{v.onMark};mask:var(--icon-check) center/contain no-repeat"></span></span>
            <span style="flex:1;min-width:0;font:{o.weight} 14px/1.3 var(--font-sans);color:{v.ink}">{t(o.label)}</span>
            <span style="display:{o.showVoters};margin-right:2px"><AvatarStack people={o.voters} size={20} max={4} ring={v.bg}></AvatarStack></span>
            <span style="display:{o.showPct};font:700 12.5px/1 var(--font-mono);color:{v.ink}">{t(o.pct)}</span>
          </div>
          <div style="margin-left:28px;height:6px;border-radius:3px;background:{v.track};overflow:hidden"><span style="display:block;height:100%;width:{o.w};border-radius:3px;background:{o.bar};transition:width .45s cubic-bezier(.2,.7,.3,1)"></span></div>
        </div>
      {/each}
    </div>
    <div style="display:flex;align-items:center;gap:10px;min-height:44px;padding:0 14px;border-radius:6px;background:{v.seg}">
      <span style="flex:1;min-width:0;font:500 12px/1.3 var(--font-sans);color:{v.soft}">{t(v.foot)}</span>
      {#if v.canView}<span style="font:600 12.5px/1 var(--font-sans);color:{v.link};cursor:pointer" onclick={v.onViewVotes} role="button" tabindex="0">View votes</span>{/if}
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;padding:6px 10px 4px;font:400 11px/1 var(--font-mono);color:{v.soft}">{t(v.time)}</div>
</div>

<style>
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;border-radius:6px !important}
</style>

<!-- Hand-edited: live pulse tile is markup (prototype built it with createElement). Generated from lib/CallEvent.dc.html (source hash 229acee3) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './CallEvent.logic.js';
  import AvatarStack from './AvatarStack.svelte';

  interface Props {
    state?: 'live' | 'ended' | 'missed';
    media?: 'video' | 'voice';
    startedBy?: string;
    faces?: string[];
    elapsed?: string;
    duration?: string;
    time?: string;
    calls?: { state: 'ended' | 'missed'; media: 'video' | 'voice'; startedBy?: string; duration?: string; time: string }[];
    joined?: boolean;
    onLeave?: () => void;
    onJoin?: () => void;
    onCallBack?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;justify-content:center;min-width:0;width:100%">
  {#if v.single}
    <div style="display:flex;align-items:center;gap:12px;min-width:min(320px,100%);max-width:100%;box-sizing:border-box;height:62px;padding:0 {v.padR} 0 12px;border-radius:31px;background:{v.pillBg};box-shadow:{v.pillRing}" role="group" aria-label={v.aria}>
      {#if v.live}{#if v.pulseTile}<span style="flex:none;width:38px;height:38px;border-radius:50%;background:color-mix(in oklch,var(--status-online,#2EE6A8) 22%,transparent);display:flex;align-items:center;justify-content:center;animation:ocCallPulse 2.4s ease-out infinite"><span style="width:17px;height:17px;background:var(--status-online,#2EE6A8);mask:{v.pulseMask}"></span></span>{/if}{/if}
      {#if v.notLive}<span style="flex:none;width:38px;height:38px;border-radius:50%;background:{v.iconBg};display:flex;align-items:center;justify-content:center"><span style="width:17px;height:17px;background:{v.iconInk};mask:{v.iconMask}"></span></span>{/if}
      <span style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 14px/1.1 var(--font-sans);color:{v.titleInk};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.title)}</span><span style="font:500 12px/1 var(--font-mono);color:{v.subInk};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.sub)}</span></span>
      {#if v.hasFaces}<span style="flex:none;display:flex;align-items:center"><AvatarStack people={v.stackPeople} size={28} max={4}></AvatarStack></span>{/if}
      {#if v.hasAction}<span class="dc-p0" style="flex:none;display:flex;align-items:center;gap:7px;height:38px;padding:0 16px 0 13px;border-radius:19px;background:{v.btnBg};font:600 13px/1 var(--font-sans);color:{v.btnInk};cursor:pointer;white-space:nowrap" onclick={v.act} role="button" tabindex="0"><span style="width:15px;height:15px;background:currentColor;mask:{v.btnMask}"></span>{t(v.action)}</span>{/if}
    </div>
  {/if}
  {#if v.grouped}
    <div style="min-width:min(320px,100%);max-width:100%;box-sizing:border-box;border-radius:31px;background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));overflow:hidden">
      <div class="dc-p1" style="display:flex;align-items:center;gap:12px;height:62px;padding:0 22px 0 12px;cursor:pointer" onclick={v.toggle} role="button" tabindex="0" aria-expanded={v.openStr} aria-label={v.aria}>
        <span style="flex:none;width:38px;height:38px;border-radius:50%;background:{v.iconBg};display:flex;align-items:center;justify-content:center"><span style="width:17px;height:17px;background:{v.iconInk};mask:{v.iconMask}"></span></span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 14px/1.1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.title)}</span><span style="font:500 12px/1 var(--font-mono);color:var(--ink-4,#8A8A99);white-space:nowrap">{t(v.sub)}</span></span>
        <span style="flex:none;width:16px;height:16px;background:var(--ink-3,#A3A3B2);mask:var(--icon-chevron-down) center/contain no-repeat;transform:{v.chevron};transition:transform .2s"></span>
      </div>
      {#if v.open}
        <div style="display:flex;flex-direction:column;padding:6px 0 14px;box-shadow:inset 0 1px 0 var(--line-1,rgba(255,255,255,.07))">
          {#each v.rows ?? [] as r, i0}
            <div style="display:flex;align-items:center;gap:12px;padding:10px 24px 10px 23px"><span style="flex:none;width:16px;height:16px;background:{r.ink};mask:{r.mask}"></span><span style="flex:1;min-width:0;font:500 13px/1.2 var(--font-sans);color:{r.titleInk};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(r.title)}</span><span style="flex:none;font:500 12px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(r.time)}</span></div>
          {/each}
          {#if v.anyMissed}<div style="display:flex;justify-content:center;padding:6px 12px 0"><span class="dc-p2" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 15px 0 12px;border-radius:17px;background:var(--overlay-2,rgba(255,255,255,.1));font:600 12.5px/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer" onclick={v.callBack} role="button" tabindex="0"><span style="width:14px;height:14px;background:currentColor;mask:var(--icon-phone) center/contain no-repeat"></span>Call back</span></div>{/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{filter:brightness(1.08) !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.04)) !important}
  .dc-p2:hover{filter:brightness(1.15) !important}
</style>

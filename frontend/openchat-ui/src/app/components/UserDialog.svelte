<!-- Generated from lib/UserDialog.dc.html (source hash 47a5b5d4) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './UserDialog.logic.js';
  import Badge from '../../lib/components/Badge.svelte';
  import DetailSection from '../../lib/components/DetailSection.svelte';
  import DmChatSettings from './DmChatSettings.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';

  interface Props {
    title?: string;
    handle?: string;
    about?: string;
    color?: string;
    online?: boolean;
    verified?: boolean;
    cover?: string;
    facts?: {label:string,value:string,dot?:boolean,highlight?:boolean}[] | null;
    onMessage?: () => void;
    onBlock?: () => void;
    onCancel?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onCancel} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:600px;max-height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}" data-panel-root="true">

    <div style="flex:none;display:grid;grid-template-columns:minmax(0,1fr)"><PanelCover cover={v.cover} actions={v.coverActions} trailActions={v.coverTrailActions} handlers={v.coverHandlers}></PanelCover></div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;margin-top:-40px;padding:0 var(--space-26) var(--space-26);display:flex;flex-direction:column;align-items:center;gap:var(--space-10)" onscroll={v.closeMuteMenu}>
      <span style="position:relative;flex:none;width:88px;height:88px;border-radius:var(--radius-pill);background:{v.gradient};box-shadow:0 0 0 4px var(--surface-1,#0e0e12)">
        {#if v.online}
          <span style="position:absolute;bottom:3px;inset-inline-end:3px;width:16px;height:16px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8);border:3px solid var(--surface-1,#0e0e12)"></span>
        {/if}
      </span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-6);max-width:100%">
        <div style="display:flex;align-items:center;gap:var(--space-6);max-width:100%">
          <span style="font:var(--weight-bold) var(--text-2xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.title)}</span>
          {#if v.verified}
            <span style="flex:none;display:grid;grid-template-columns:max-content"><Badge variant="verified"></Badge></span>
          {/if}
        </div>
        {#if v.hasHandle}
          <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.handle)}</span>
        {/if}
      </div>

      {#if v.dmTabs}
        <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:var(--space-8);margin-top:var(--space-8)">
          <span class="dc-p0" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 9px 0 12px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.mutePillBg};box-shadow:inset 0 0 0 1px {v.mutePillLine};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.mutePillInk};cursor:pointer;user-select:none" onclick={v.onMutePill} aria-label={v.muteTitle} role="button" tabindex="0" title={v.muteTitle}>
            <span style="flex:none;width:14px;height:14px;background:{v.mutePillInk};mask:{v.mutePillMask}"></span>{t(v.mutePillLabel)}
            <span style="width:1px;height:16px;margin:0 2px 0 3px;background:var(--line-2,rgba(255,255,255,.12))"></span><span style="flex:none;width:12px;height:12px;background:{v.mutePillInk};mask:{v.caretMask}"></span>
          </span>
          <span class="dc-p1" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 13px 0 12px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.favPillBg};box-shadow:inset 0 0 0 1px {v.favPillLine};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.favPillInk};cursor:pointer;user-select:none" onclick={v.onFavPill} role="button" tabindex="0" aria-pressed={v.fav}>
            <span style="flex:none;width:14px;height:14px;background:{v.favPillInk};mask:{v.heartMask}"></span>{t(v.favPillLabel)}
          </span>
        </div>
        <div style="width:100%;margin-top:var(--space-14);display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.tabLabels} selectedIndex={v.tabIndex} dotOnLast={false} onSelect={v.onTab}></SegmentedTabs></div>
      {/if}

      {#if v.showProfileTab}
      <div style="width:100%;display:flex;flex-direction:column;align-items:stretch;gap:var(--space-10);margin-top:{v.profileTop}">
      <div style="width:100%;display:grid;grid-template-columns:repeat({v.factColumns},minmax(0,1fr));gap:var(--space-6)">
        {#each v.valueFacts ?? [] as f, i0}
          <div style="min-width:0;display:grid;grid-template-columns:minmax(0,1fr)">
            <DetailSection label={f.label} value={f.value} dot={f.dot} highlight={f.highlight}></DetailSection>
          </div>
        {/each}
      </div>

      {#if v.hasAbout}
        <div style="width:100%;display:grid;grid-template-columns:minmax(0,1fr)">
          <DetailSection label="About" value={v.about} variant="prose"></DetailSection>
        </div>
      {/if}
      </div>
      {/if}
      {#if v.showChatTab}
        <div style="width:100%;margin-top:var(--space-10);display:grid;grid-template-columns:minmax(0,1fr)"><DmChatSettings peerName={v.title} disappearOn={v.disappearOn} disappearAfter={v.disappearAfter} readReceipts={v.readReceipts} onDisappearChange={v.onDisappearChange} onReadReceiptsChange={v.onReadReceiptsChange}></DmChatSettings></div>
      {/if}
    </div>

    {#if v.notSelf}
    <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:var(--space-16) var(--space-26);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span class="dc-p2" style="flex:none;padding:var(--space-10) var(--space-14);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--status-danger,#F5493D);cursor:pointer;user-select:none" onclick={v.onBlock} role="button" tabindex="0">Block user</span>
      <span style="flex:1"></span>
      {#if v.showMessage}
      <div class="dc-p3" style="flex:none;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-18);height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.onMessage} role="button" tabindex="0">
        <span>Message</span>
        <span style="width:16px;height:16px;background:var(--on-accent,#2E0512);mask:{v.messageMask}"></span>
      </div>
      {/if}
    </div>
    {/if}
    {#if v.muteMenuOpen}
      <div style="position:absolute;inset:0;z-index:44" onclick={v.closeMuteMenu} aria-hidden="true"></div>
      <div style="position:absolute;z-index:45;top:{v.muteMenuTop};left:{v.muteMenuLeft};width:216px;display:flex;flex-direction:column;gap:2px;padding:var(--space-8);box-sizing:border-box;border-radius:var(--radius-md);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 18px 40px rgba(0,0,0,.5)">
        <span style="padding:var(--space-6) var(--space-8) var(--space-8);font:var(--weight-regular) var(--text-xs)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.muteMenuTitle)}</span>
        {#each v.muteOptions ?? [] as o, i1}
          <div class="dc-p4" style="display:flex;align-items:center;min-width:0;padding:var(--space-8);border-radius:var(--radius-sm);font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={o.onSelect} role="button" tabindex="0">{t(o.label)}</div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--btn-danger-bg,rgba(240,68,56,.08)) !important}
  .dc-p3:hover{background:var(--accent-hover,#ff6d85) !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>

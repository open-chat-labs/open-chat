<!-- Generated from lib/DmPanel.dc.html (source hash 38415146) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './DmPanel.logic.js';
  import type { MenuItem } from '../../lib/types';
  import DetailSection from '../../lib/components/DetailSection.svelte';
  import DmChatSettings from './DmChatSettings.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';

  interface Props {
    title?: string;
    handle?: string;
    about?: string;
    color?: string;
    online?: boolean;
    memberSince?: string;
    chit?: string;
    fav?: boolean;
    muted?: string | null;
    disappearOn?: boolean;
    disappearAfter?: string;
    readReceipts?: boolean;
    cover?: string;
    menuItems?: MenuItem[];
    coverHandlers?: { close?: () => void };
    onMuteChange?: (key: string | null) => void;
    onToggleFavourite?: () => void;
    onDisappearChange?: (v: { on: boolean, after: string }) => void;
    onReadReceiptsChange?: (on: boolean) => void;
    onOpenProfile?: (tab: string) => void;
    onBlock?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12)" data-panel-root="true">
  <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column" onscroll={v.closeMuteMenu}>
    <div style="flex:none;display:grid;grid-template-columns:minmax(0,1fr)"><PanelCover cover={v.cover} actions={v.coverActions} trailActions={v.coverTrailActions} handlers={v.coverHandlers}></PanelCover></div>
    <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-22,22px);padding:0 var(--space-16) var(--space-22,22px);margin-top:-64px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-6);min-width:0">
        <div style="position:relative;flex:none;width:128px;height:128px;margin-bottom:var(--space-8);border-radius:var(--radius-pill);background:{v.avatarGradient};box-shadow:0 0 0 4px var(--surface-1,#0e0e12);cursor:pointer" onclick={v.onOpenProfile} aria-label="View profile" role="button" tabindex="0" title="View profile">
          {#if v.online}
            <span style="position:absolute;bottom:8px;inset-inline-end:8px;width:18px;height:18px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8);border:3px solid var(--surface-1,#0e0e12)"></span>
          {/if}
        </div>
        <span style="max-width:100%;font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-align:center;text-wrap:pretty;cursor:pointer" onclick={v.onOpenProfile} aria-label="View profile" role="button" tabindex="0" title="View profile">{t(v.title)}</span>
        {#if v.hasHandle}
          <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.handle)}</span>
        {/if}
        <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:var(--space-8);margin-top:var(--space-12)">
          <span class="dc-p0" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 9px 0 12px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.mutePillBg};box-shadow:inset 0 0 0 1px {v.mutePillLine};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.mutePillInk};cursor:pointer;user-select:none" onclick={v.onMutePill} aria-label={v.muteTitle} role="button" tabindex="0" title={v.muteTitle}>
            <span style="flex:none;width:14px;height:14px;background:{v.mutePillInk};mask:{v.mutePillMask}"></span>{t(v.mutePillLabel)}
            <span style="width:1px;height:16px;margin:0 2px 0 3px;background:var(--line-2,rgba(255,255,255,.12))"></span><span style="flex:none;width:12px;height:12px;background:{v.mutePillInk};mask:{v.caretMask}"></span>
          </span>
          <span class="dc-p1" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 13px 0 12px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.favPillBg};box-shadow:inset 0 0 0 1px {v.favPillLine};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.favPillInk};cursor:pointer;user-select:none" onclick={v.onFavPill} role="button" tabindex="0" aria-pressed={v.fav}>
            <span style="flex:none;width:14px;height:14px;background:{v.favPillInk};mask:{v.heartMask}"></span>{t(v.favPillLabel)}
          </span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-6)">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-6)">
          <div style="display:grid;grid-template-columns:minmax(0,1fr)"><DetailSection label="Member since" value={v.memberSince}></DetailSection></div>
          <div style="display:grid;grid-template-columns:minmax(0,1fr)"><DetailSection label="CHIT earned" value={v.chit} highlight={true}></DetailSection></div>
        </div>
        {#if v.hasAbout}
          <div style="display:grid;grid-template-columns:minmax(0,1fr)"><DetailSection label="About" value={v.about} variant="prose" clamp={3}></DetailSection></div>
        {/if}
      </div>
    </div>
  </div>

  <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-8) var(--space-16) var(--space-16)">
    <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-4,#8A8A99)">This chat</span>
    <div style="display:grid;grid-template-columns:minmax(0,1fr)"><DmChatSettings peerName={v.title} disappearOn={v.dmOnProp} disappearAfter={v.afterProp} readReceipts={v.rrProp} onDisappearChange={v.onDisappearChange} onReadReceiptsChange={v.onReadReceiptsChange}></DmChatSettings></div>
  </div>

  <div style="flex:none;height:72px;box-sizing:border-box;display:flex;align-items:center;padding:0 var(--space-16);border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
    <span class="dc-p2" style="flex:1;display:flex;align-items:center;justify-content:center;gap:var(--space-8);height:var(--control-lg,40px);border-radius:var(--radius-md);background:var(--btn-danger-bg,rgba(240,68,56,.08));font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--status-danger,#F5493D);cursor:pointer;user-select:none" onclick={v.onBlock} role="button" tabindex="0"><span style="width:15px;height:15px;background:var(--status-danger,#F5493D);mask:{v.banMask}"></span>Block user</span>
  </div>

  {#if v.muteMenuOpen}
    <div style="position:absolute;inset:0;z-index:44" onclick={v.closeMuteMenu} aria-hidden="true"></div>
    <div style="position:absolute;z-index:45;top:{v.muteMenuTop};left:{v.muteMenuLeft};width:216px;display:flex;flex-direction:column;gap:2px;padding:var(--space-8);box-sizing:border-box;border-radius:var(--radius-md);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 18px 40px rgba(0,0,0,.5)">
      <span style="padding:var(--space-6) var(--space-8) var(--space-8);font:var(--weight-regular) var(--text-xs)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.muteMenuTitle)}</span>
      {#each v.muteOptions ?? [] as o, i0}
        <div class="dc-p3" style="display:flex;align-items:center;min-width:0;padding:var(--space-8);border-radius:var(--radius-sm);font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={o.onSelect} role="button" tabindex="0">{t(o.label)}</div>
      {/each}
    </div>
  {/if}

  {#if v.menuOpen}
    <div style="position:absolute;inset:0;z-index:40" onclick={v.closeMenu} aria-hidden="true"></div>
    <div style="position:absolute;top:46px;inset-inline-end:var(--space-16);z-index:41;display:grid;grid-template-columns:max-content;justify-items:end">
      <Menu items={v.menuItems}></Menu>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--btn-danger-hover,rgba(240,68,56,.14)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>

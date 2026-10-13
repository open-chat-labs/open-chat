<!-- Generated from lib/GroupPanel.dc.html (source hash dba9b54f) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './GroupPanel.logic.js';
  import Field from '../../lib/components/Field.svelte';
  import GroupStats from './GroupStats.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import MemberRow from '../../lib/components/MemberRow.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import MessageGroup from '../../lib/components/MessageGroup.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';
  import PanelNavRow from '../../lib/components/PanelNavRow.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';
  import TileButtons from '../../lib/components/TileButtons.svelte';

  interface Props {
    viewRequest?: string;
    storageKey?: string;
    title?: string;
    createdBy?: string;
    about?: string;
    memberTotal?: number;
    members?: {title:string,handle:string,tag?:string,color?:string}[];
    bots?: {title:string,handle:string,tag?:string,color?:string}[];
    tiles?: string[];
    tileHandlers?: Record<string, () => void>;
    onInvite?: () => void;
    cover?: string;
    membersLoading?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12);border-radius:{v.rootRadius}" use:ref={v.awayRef} data-panel-root="true">

  {#if v.isMain}
    <div style="flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:{v.mainPadBottom};display:flex;flex-direction:column" onscroll={v.onMainScroll}>
      <div style="flex:none;display:grid;grid-template-columns:minmax(0,1fr)"><PanelCover cover={v.cover} actions={v.coverActions} trailActions={v.coverTrailActions} handlers={v.coverHandlers}></PanelCover></div>

      <div style="padding:0 var(--space-16) {v.identityPadBottom};margin-top:{v.avatarLift};display:flex;flex-direction:column;align-items:center;gap:var(--space-10)">
        <div style="position:relative;width:{v.avatarSize};height:{v.avatarSize};margin-bottom:{v.avatarGap};border-radius:{v.avatarRadius};background:{v.avatarGradient};box-shadow:0 0 0 4px var(--surface-1,#0e0e12)"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-6);max-width:100%">
          <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-8);min-width:0;max-width:100%">
            <span style="min-width:0;font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);text-align:center;text-wrap:pretty">{t(v.title)}</span>
            {#if v.showFavHeart}
              <span style="flex:none;width:15px;height:15px;background:var(--accent,#FF5672);mask:{v.heartFilled}" title="In your favourites"></span>
            {/if}
          </div>
          {#if v.isChannelScope}
            <span style="display:flex;align-items:center;gap:var(--space-6);font:var(--weight-regular) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{#if v.isQuick}<span style="flex:none;width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.accessMask}"></span>{/if}{t(v.channelIn)}{#if v.notQuick}<a style="color:var(--accent,#FF5672);text-decoration:none" href="#" onclick={v.openCommunity}>{t(v.communityName)}</a>{/if}{#if v.isQuick}<span class="dc-p0" style="display:inline-flex;align-items:center;gap:var(--space-4);height:26px;padding:0 var(--space-6) 0 var(--space-10);border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.08));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.openCommunity} aria-label="View community" role="button" tabindex="0" title="View community">{t(v.communityName)}<span style="flex:none;width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.chevMask}" data-oc-flip=""></span></span>{/if}</span>
          {/if}
          {#if v.showQuickByline}
            <span style="display:flex;align-items:center;gap:var(--space-6);font:var(--weight-regular) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)"><span style="flex:none;width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.accessMask}"></span>{t(v.quickByline)} <a style="color:var(--accent,#FF5672);text-decoration:none" href="#">{t(v.ownerHandle)}</a></span>
          {/if}
          {#if v.showFullByline}
            <span style="font:var(--weight-regular) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.bylineNoun)} created by <a style="color:var(--accent,#FF5672);text-decoration:none" href="#">{t(v.ownerHandle)}</a></span>
          {/if}
          {#if v.notQuick}
          <div class="dc-p1" style="display:flex;align-items:center;gap:var(--space-6);margin-top:var(--space-2);padding:var(--space-4) var(--space-8);border-radius:var(--radius-pill);cursor:pointer" onclick={v.goMembers} role="button" tabindex="0">
            <span style="flex:none;width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.membersMask}"></span>
            <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.roleSummary)}</span>
          </div>
          {/if}
        </div>
        {#if v.isQuick}
          <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:var(--space-8);margin-top:var(--space-8)">
            <span class="dc-p2" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 9px 0 12px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.mutePillBg};box-shadow:inset 0 0 0 1px {v.mutePillLine};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.mutePillInk};cursor:pointer;user-select:none" onclick={v.onMutePill} aria-label={v.muteTitle} role="button" tabindex="0" title={v.muteTitle}>
              <span style="flex:none;width:14px;height:14px;background:{v.mutePillInk};mask:{v.mutePillMask}"></span>{t(v.mutePillLabel)}
              <span style="width:1px;height:16px;margin:0 2px 0 3px;background:var(--line-2,rgba(255,255,255,.12))"></span><span style="flex:none;width:12px;height:12px;background:{v.mutePillInk};mask:{v.caretMask}"></span>
            </span>
            <span class="dc-p3" style="display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 11px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.everyoneBg};box-shadow:inset 0 0 0 1px {v.everyoneLine};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.everyoneInk};cursor:pointer;user-select:none" onclick={v.onEveryonePill} aria-label={v.everyoneTitle} role="button" tabindex="0" title={v.everyoneTitle} aria-pressed={v.everyoneOn}>
              <span style="flex:none;width:14px;height:14px;background:{v.everyoneInk};mask:{v.everyoneMask}"></span>@everyone
            </span>
            {#if v.canFavPill}
              <span class="dc-p4" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 13px 0 12px;box-sizing:border-box;border-radius:var(--radius-pill);background:{v.favPillBg};box-shadow:inset 0 0 0 1px {v.favPillLine};font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:{v.favPillInk};cursor:pointer;user-select:none" onclick={v.onFavPill} role="button" tabindex="0">
                <span style="flex:none;width:14px;height:14px;background:{v.favPillInk};mask:{v.favPillMask}"></span>{t(v.favPillLabel)}
              </span>
            {/if}
          </div>
        {/if}
        {#if v.notQuick}
        <div style="width:100%;margin-top:var(--space-14);display:grid;grid-template-columns:minmax(0,1fr)"><TileButtons columns={v.tileColumns} tiles={v.tiles} handlers={v.tileHandlers}></TileButtons></div>
        {/if}
        {#if v.showAccessCard}
          <div style="width:100%;display:flex;align-items:center;gap:var(--space-12);min-height:56px;padding:var(--space-10) var(--space-12) var(--space-10) var(--space-10);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:var(--overlay-2,rgba(255,255,255,.07))"><span style="width:17px;height:17px;background:var(--ink-2,#C9C9D4);mask:{v.accessMask}"></span></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.accessTitle)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.accessBody)}</span>
            </div>
          </div>
        {/if}
        {#if v.showCommunityCard}
          <div class="dc-p5" style="width:100%;display:flex;align-items:center;gap:var(--space-12);min-height:56px;padding:var(--space-10) var(--space-12) var(--space-10) var(--space-10);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));cursor:pointer;user-select:none" onclick={v.openCommunity} role="button" tabindex="0">
            <span style="flex:none;width:36px;height:36px;border-radius:12px;background:{v.communityGradient}"></span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.communityName)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:var(--ink-3,#9A9AA8)">View community details</span>
            </div>
            <span style="flex:none;width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.chevMask}"></span>
          </div>
        {/if}
        <div style="width:100%;margin-top:var(--space-6);display:flex;flex-direction:column;align-items:center;gap:var(--space-6)">
          <p style="margin:0;font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:{v.aboutInk};text-wrap:pretty;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:{v.aboutClamp};overflow:hidden" use:ref={v.aboutRef}>{t(v.about)}</p>
          {#if v.aboutCanToggle}
            <span class="dc-p6" style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none;padding:var(--space-4) var(--space-6);border-radius:var(--radius-sm)" onclick={v.toggleAbout} role="button" tabindex="0">{t(v.aboutToggleLabel)}</span>
          {/if}
        </div>
      </div>

      <div style="flex:1 0 auto;padding:0 var(--space-16) var(--space-16);display:flex;flex-direction:column;gap:var(--space-22)">


        {#if v.showPinnedRow}
          <div class="dc-p7" style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:var(--space-10) var(--space-12);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer;user-select:none" onclick={v.goPinned} role="button" tabindex="0">
            <span style="flex:none;width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.pinMask}"></span>
            <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Pinned messages</span>
            <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.pinnedCount)}</span>
            <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#7C7C8C);mask:{v.pinChevMask}" data-oc-flip=""></span>
          </div>
        {/if}

        {#if v.isQuick}
          <div style="flex:1 0 auto;display:flex;flex-direction:column;border-radius:var(--radius-xl,16px);background:var(--overlay-1,rgba(255,255,255,.04))">
            <div style="flex:none;display:flex;align-items:center;gap:var(--space-8);min-height:56px;padding:var(--space-18) var(--space-16);box-sizing:border-box;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
              <span style="flex:none;width:8px;height:8px;border-radius:50%;background:var(--status-online,#2EE6A8);box-shadow:0 0 0 3px color-mix(in srgb, var(--status-online,#2EE6A8) 18%, transparent)"></span>
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.onlineTitle)} <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(v.onlineCountLabel)}</span></span>
              <span style="flex:none;font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.onlineOf)}</span>
            </div>
            <div style="flex:1 1 0px;min-height:236px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-4);padding:var(--space-14) var(--space-6)">
              {#if v.membersLoading}<Skeleton variant="member" count={6}></Skeleton>{/if}
{#each v.membersShown ?? [] as m, i0}
                <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow title={m.title} subtitle={m.handle} tag={m.tag} color={m.color} online={m.online} ringColor="var(--surface-2,#191921)" hoverBg="var(--overlay-2,rgba(255,255,255,.09))" activity={m.activity} showMenu={false} onClick={m.onOpen}></MemberRow></div>
              {/each}
              {#if v.noneOnline}
                <span style="padding:var(--space-4) var(--space-10) var(--space-8);font:var(--weight-regular) var(--text-md)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C)">No one else is online. Recently active:</span>
              {/if}
              {#if v.hasMoreOnline}
                <span style="padding:var(--space-10) var(--space-10) var(--space-4);font:var(--weight-medium) var(--text-md)/1 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.moreOnlineLabel)}</span>
              {/if}
            </div>
            <div style="flex:none;display:flex;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
              {#if v.showInviteCard}
                <span class="dc-p8" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:56px;border-inline-end:1px solid var(--line-1,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none;border-end-start-radius:var(--radius-xl,16px)" onclick={v.goInvitePeople} role="button" tabindex="0"><span style="flex:none;width:14px;height:14px;background:var(--ink,#ECECF1);mask:{v.invitePeopleMask}"></span>Invite</span>
              {/if}
              <span class="dc-p9" style="flex:1;display:flex;align-items:center;justify-content:center;height:56px;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none;border-end-end-radius:var(--radius-xl,16px)" onclick={v.goMembers} role="button" tabindex="0">{t(v.viewAllMembersLabel)}</span>
            </div>
          </div>
          {#if v.hasBotsSlim}
            <div class="dc-p10" style="flex:none;display:flex;align-items:center;gap:var(--space-12);min-height:56px;padding:var(--space-12) var(--space-16);box-sizing:border-box;border-radius:var(--radius-xl,16px);background:var(--overlay-1,rgba(255,255,255,.04));cursor:pointer;user-select:none" onclick={v.goBots} role="button" tabindex="0">
              <div style="flex:none;display:flex">
                {#each v.botStack ?? [] as b, i1}<span style="width:30px;height:30px;margin-inline-end:-7px;border-radius:9px;background:{b.gradient};box-shadow:0 0 0 2px var(--surface-1,#0e0e12)"></span>{/each}
              </div>
              <span style="flex:1;min-width:0;margin-inline-start:7px;font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Bots <span style="font-weight:var(--weight-regular);color:var(--ink-3,#9A9AA8)">· {t(v.botNames)}</span></span>
              <span style="flex:none;width:14px;height:14px;background:var(--ink-4,#7C7C8C);mask:{v.chevMask}" data-oc-flip=""></span>
            </div>
          {/if}
        {/if}

        {#if v.showMemberPreview}
        <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <div style="display:flex;align-items:baseline;gap:var(--space-10);padding-top:var(--space-16);border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:1;min-width:0;padding-inline-start:var(--space-8);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">{t(v.membersLabel)}</span>
            <a style="flex:none;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);text-decoration:none" href="#" onclick={v.goMembers}>View all ({t(v.memberTotal)})</a>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            {#each v.memberPreview ?? [] as m, i2}
              <div style="position:relative;display:grid;grid-template-columns:minmax(0,1fr)">
                <MemberRow title={m.title} subtitle={m.handle} tag={m.tag} color={m.color} onClick={m.onOpen} onMenu={m.toggleMenu} showMenu={m.hasMenu}></MemberRow>
                {#if m.menuOpen}
                  <div style="position:fixed;inset:0;z-index:19" onclick={v.closeUgMenu}></div>
                  <div style="position:absolute;inset-inline-end:var(--space-4);top:calc(100% - 6px);z-index:20;display:grid;grid-template-columns:max-content"><Menu minWidth="220px" heading={m.menuHeading} items={m.menuItems}></Menu></div>
                {/if}
                {#if m.ownerAsk}
                  <div style="position:fixed;inset:0;z-index:19" onclick={v.closeUgMenu}></div>
                  <div style="position:absolute;inset-inline-end:var(--space-4);top:calc(100% - 6px);z-index:20;width:260px;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.28))">
                    <div style="display:flex;flex-direction:column;gap:var(--space-6)">
                      <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">Make {t(m.title)} an owner?</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Owners have full control, including deleting the {t(v.nounLower)} and changing other owners.</span>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:var(--space-6)">
                      <span class="dc-p11" style="display:flex;align-items:center;height:34px;padding:0 var(--space-12);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.closeUgMenu} role="button" tabindex="0">Cancel</span>
                      <span class="dc-p12" style="display:flex;align-items:center;height:34px;padding:0 var(--space-14);border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={m.confirmOwner} role="button" tabindex="0">Make owner</span>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
        {/if}

        {#if v.hasBots}
        <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <div style="display:flex;align-items:baseline;gap:var(--space-10);padding-top:var(--space-16);border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:1;min-width:0;padding-inline-start:var(--space-8);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">{t(v.botsSectionLabel)}</span>
            <a style="flex:none;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);text-decoration:none" href="#" onclick={v.goBots}>View all ({t(v.botTotal)})</a>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            {#each v.botPreview ?? [] as b, i3}
              <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow variant={b.variant} title={b.title} subtitle={b.subtitle} tag={b.tag} color={b.color} image={b.image} icon="chevron" showMenu={false} onClick={b.onOpen}></MemberRow></div>
            {/each}
          </div>
        </div>
        {/if}


        {#if v.showUserGroupPreview}
        <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <div style="display:flex;align-items:baseline;gap:var(--space-10);padding-top:var(--space-16);border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:1;min-width:0;padding-inline-start:var(--space-8);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">USER GROUPS</span>
            <a style="flex:none;font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);text-decoration:none" href="#" onclick={v.goUserGroups}>View all ({t(v.userGroupTotal)})</a>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            {#each v.userGroupPreview ?? [] as u, i4}
              <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow title={u.title} subtitle={u.subtitle} color={u.color} icon="chevron" showMenu={false} onClick={u.open}></MemberRow></div>
            {/each}
          </div>
        </div>
        {/if}

        {#if v.showNavRows}
        <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
          <div style="padding-top:var(--space-16);padding-bottom:var(--space-4);border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="padding-inline-start:var(--space-8);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">ACCESS &amp; RULES</span>
          </div>
          {#each v.navRows ?? [] as nav, i5}
            <div style="display:grid;grid-template-columns:minmax(0,1fr)"><PanelNavRow label={nav.label} hint={nav.hint} value={nav.value} highlight={nav.highlight} onClick={nav.onPress}></PanelNavRow></div>
          {/each}
        </div>
        {/if}


      </div>
    </div>
  {/if}

  {#if v.isSubview}
    <div style="flex:none;display:flex;align-items:center;gap:var(--space-10);height:71px;box-sizing:border-box;padding:0 var(--space-16);border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.showBack}
      <span class="dc-p13" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.goBack} role="button" tabindex="0">
        <span style="width:17px;height:17px;background:var(--ink-2,#C9C9D4);mask:{v.backMask}"></span>
      </span>
      {/if}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="min-width:0;font:var(--weight-bold) var(--text-lg)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.subviewTitle)}</span>
        {#if v.hasSubviewSub}
          <span style="min-width:0;font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.subviewSub)}</span>
        {/if}
      </div>
      {#if v.hasSubviewMeta}
        <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(v.subviewMeta)}</span>
      {/if}
      {#if v.hasSubviewShare}
        <div style="flex:none;display:flex"><IconButton label="Add members" variant="ghost" icon="userPlus" onClick={v.goAddMembers}></IconButton></div>
        <div style="flex:none;display:flex"><IconButton label="Share invite link" variant="ghost" icon="share" onClick={v.goShare}></IconButton></div>
      {/if}
      {#if v.isUserGroupsView}
        <div class="dc-p14" style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:34px;padding:0 var(--space-12) 0 var(--space-10);border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.newUserGroup} role="button" tabindex="0"><span style="flex:none;width:14px;height:14px;background:var(--ink,#ECECF1);mask:{v.plusMask}"></span>New user group</div>
      {/if}
      {#if v.isUserGroupView}
        <div style="flex:none;display:flex"><IconButton label="Edit user group" variant="ghost" icon="edit" onClick={v.editUserGroup}></IconButton></div>
      {/if}
      {#if v.hasSubviewEdit}
        <div style="flex:none;display:flex"><IconButton variant="ghost" icon="edit" onClick={v.onSubviewEdit}></IconButton></div>
      {/if}
      {#if v.showHeaderRegister}
        <div class="dc-p15" style="flex:none;display:flex;align-items:center;gap:var(--space-6);height:34px;padding:0 var(--space-12) 0 var(--space-10);border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.registerWebhook} role="button" tabindex="0"><span style="flex:none;width:14px;height:14px;background:var(--ink,#ECECF1);mask:{v.plusMask}"></span>Register webhook</div>
      {/if}
      {#if v.showSubClose}
        <div style="flex:none;display:flex"><IconButton label="Close" variant="ghost" icon="close" onClick={v.onSubClose}></IconButton></div>
      {/if}
    </div>

    <div style="flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;padding:var(--space-16) var(--space-16) var(--space-32);display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;gap:var(--space-16)">

      {#if v.isMembersView}
        <div style="width:100%;max-width:520px;align-self:center;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          {#if v.showMemberTabs}
          <div style="display:grid;grid-template-columns:minmax(0,1fr);padding-top:var(--space-6)"><SegmentedTabs labels={v.memberTabs} selectedIndex={v.memberTab} dotOnLast={false} dotIndexes={v.memberDots} onSelect={v.setMemberTab}></SegmentedTabs></div>
          {/if}
          <div style="display:grid;grid-template-columns:minmax(0,1fr);padding-top:{v.memberSearchPad}"><Field placeholder={v.memberSearchPlaceholder} showShortcut={false}></Field></div>
          {#if v.showCommMembersBanner}
            <div class="dc-p16" style="display:flex;align-items:center;gap:var(--space-12);min-width:0;margin-top:var(--space-4);padding:var(--space-12) var(--space-12) var(--space-12) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:color-mix(in oklch,var(--accent,#FF5672) 8%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 24%,transparent);cursor:pointer;user-select:none" onclick={v.openCommMembers} role="button" tabindex="0">
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">Looking for {t(v.communityName)} community members?</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.35 var(--font-sans);color:var(--ink-3,#9A9AA8)">This list only shows who's in this channel.</span>
              </div>
              <span style="flex:none;width:16px;height:16px;background:var(--accent,#FF5672);mask:{v.chevMask}"></span>
            </div>
          {/if}
          <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;padding-top:var(--space-22)">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.memberListTitle)}</span>
            {#if v.hasMemberNote}
              <span style="padding-inline:var(--space-4);font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.memberNote)}</span>
            {/if}
            <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
            {#each v.memberList ?? [] as m, i6}
              <div style="position:relative;display:grid;grid-template-columns:minmax(0,1fr)">
                <MemberRow title={m.title} subtitle={m.handle} tag={m.tag} isYou={m.isYou} color={m.color} online={m.online} activity={m.activity} onClick={m.onOpen} onMenu={m.toggleMenu} showMenu={m.hasMenu}></MemberRow>
                {#if m.menuOpen}
                  <div style="position:fixed;inset:0;z-index:19" onclick={v.closeUgMenu}></div>
                  <div style="position:absolute;inset-inline-end:var(--space-4);top:calc(100% - 6px);z-index:20;display:grid;grid-template-columns:max-content"><Menu minWidth="220px" heading={m.menuHeading} items={m.menuItems}></Menu></div>
                {/if}
                {#if m.soleAsk}
                  <div style="position:fixed;inset:0;z-index:19" onclick={v.closeUgMenu}></div>
                  <div style="position:absolute;inset-inline-end:var(--space-4);top:calc(100% - 6px);z-index:20;width:260px;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.28))">
                    <div style="display:flex;flex-direction:column;gap:var(--space-6)">
                      <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">You're the only owner</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Make someone else an owner before you change your own role.</span>
                    </div>
                    <div style="display:flex;justify-content:flex-end">
                      <span class="dc-p17" style="display:flex;align-items:center;height:34px;padding:0 var(--space-14);border-radius:var(--radius-md);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.closeUgMenu} role="button" tabindex="0">Got it</span>
                    </div>
                  </div>
                {/if}
                {#if m.ownerAsk}
                  <div style="position:fixed;inset:0;z-index:19" onclick={v.closeUgMenu}></div>
                  <div style="position:absolute;inset-inline-end:var(--space-4);top:calc(100% - 6px);z-index:20;width:260px;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.28))">
                    <div style="display:flex;flex-direction:column;gap:var(--space-6)">
                      <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">Make {t(m.title)} an owner?</span>
                      <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Owners have full control, including deleting the {t(v.nounLower)} and changing other owners.</span>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:var(--space-6)">
                      <span class="dc-p18" style="display:flex;align-items:center;height:34px;padding:0 var(--space-12);border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.closeUgMenu} role="button" tabindex="0">Cancel</span>
                      <span class="dc-p19" style="display:flex;align-items:center;height:34px;padding:0 var(--space-14);border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={m.confirmOwner} role="button" tabindex="0">Make owner</span>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if v.isBotsView}
        <div style="width:100%;max-width:520px;align-self:center;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-26);min-width:0;padding-top:var(--space-6)">
          <div style="display:grid;grid-template-columns:minmax(0,1fr)"><Field placeholder={v.botsSearchPlaceholder} value={v.botQuery} onInput={v.onBotQuery} onClear={v.clearBotQuery} showShortcut={false}></Field></div>

          {#if v.hasInstalledBots}
            <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.installedLabel)}</span>
              <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
                {#each v.installedBots ?? [] as b, i7}
                  <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow variant="bot" title={b.title} subtitle={b.subtitle} color={b.color} icon="chevron" showMenu={false} onClick={b.onOpen}></MemberRow></div>
                {/each}
              </div>
            </div>
          {/if}

          {#if v.allowWebhooks}
          <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.webhooksLabel)}</span>
            <span style="padding-inline:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Webhooks let your own tools post into this group over HTTP.</span>
            {#if v.showListRegister}
            <div class="dc-p20" style="display:flex;align-items:center;gap:var(--space-12);min-width:0;margin-block-start:var(--space-4);padding:var(--space-8);border-radius:var(--radius-md);cursor:pointer" onclick={v.registerWebhook} role="button" tabindex="0">
              <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--accent-soft,rgba(255,86,114,.12));box-shadow:inset 0 0 0 1px var(--accent-dim,rgba(255,86,114,.35))">
                <span style="width:18px;height:18px;background:var(--accent,#FF5672);mask:{v.hookMask}"></span>
              </span>
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--accent,#FF5672)">Register a webhook</span>
            </div>
            {/if}
            {#if v.noWebhooksYet}
              <span style="padding:var(--space-10) var(--space-4) 0;font:var(--weight-regular) var(--text-base)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">No webhooks yet. <a style="font-weight:var(--weight-semibold)" href="#" onclick={v.registerWebhookLink}>Register a webhook</a></span>
            {/if}
            <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
              {#each v.webhooks ?? [] as h, i8}
                <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow variant="webhook" title={h.title} subtitle={h.subtitle} color={h.color} image={h.image} icon="chevron" showMenu={false} onClick={h.onOpen}></MemberRow></div>
              {/each}
            </div>
          </div>
          {/if}

          {#if v.hasRecommended}
            <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.recommendedLabel)}</span>
              <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0">
                {#each v.recommended ?? [] as b, i9}
                  <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow variant="bot" title={b.title} subtitle={b.subtitle} color={b.color} icon="chevron" showMenu={false} onClick={b.onOpen}></MemberRow></div>
                {/each}
              </div>
            </div>
          {/if}

          {#if v.noBotsInstalled}
            <span style="padding:var(--space-14) var(--space-4);font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">No bots are installed in this {t(v.nounLower)}.</span>
          {/if}
          {#if v.noBotMatches}
            <span style="padding:var(--space-14) var(--space-4);font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Nothing matches “{t(v.botQuery)}”.</span>
          {/if}
        </div>
      {/if}

      {#if v.isPermissionsView}
        <div style="display:flex;flex-direction:column;gap:var(--space-32);min-width:0">
          {#each v.roleDigest ?? [] as r, i10}
            <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:{r.tint}">{t(r.label)}</span>
              <div style="display:flex;flex-wrap:wrap;gap:var(--space-6);min-width:0">
                {#each r.caps ?? [] as c, i11}
                  <span style="padding:5px var(--space-10);border-radius:var(--radius-sm);background:{c.wash};box-shadow:inset 0 0 0 1px {c.line};font:var(--weight-medium) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(c.label)}</span>
                {/each}
                {#if r.none}
                  <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">Reading only</span>
                {/if}
                {#if r.inherits}
                  <span style="display:flex;align-items:center;gap:5px;padding:5px var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1));font:var(--weight-medium) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">
                    <span style="flex:none;width:11px;height:11px;background:var(--ink-4,#7C7C8C);mask:{v.plusMask}"></span>
                    <span>{t(r.inheritsLabel)}</span>
                  </span>
                {/if}
              </div>
            </div>
          {/each}

          {#if v.hasDisabledPerms}
            <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">OFF FOR EVERYONE</span>
              <div style="display:flex;flex-wrap:wrap;gap:var(--space-6);min-width:0">
                {#each v.disabledPerms ?? [] as d, i12}
                  <span style="padding:5px var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));font:var(--weight-medium) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C);text-decoration:line-through">{t(d.label)}</span>
                {/each}
              </div>
            </div>
          {/if}

          <div style="display:flex;flex-direction:column;gap:var(--space-6);min-width:0;padding:var(--space-12) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            <span style="font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink-2,#C9C9D4)">Threads</span>
            <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.threadPermLine)}</span>
          </div>
        </div>
      {/if}

      {#if v.isGatesView}
        <div style="display:flex;flex-direction:column;gap:var(--space-18);min-width:0">
          {#if v.hasGates}
            <div style="display:flex;align-items:center;gap:var(--space-10);min-width:0;padding:var(--space-12) var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);border:1px solid var(--line-1,rgba(255,255,255,.07))">
              <span style="flex:none;width:15px;height:15px;background:var(--ink-4,#7C7C8C);mask:{v.clockMask}"></span>
              <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.recheckLine)}</span>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
              <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--ink-4,#7C7C8C)">{t(v.gateJoinerLabel)}</span>
              <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
                {#each v.gateCards ?? [] as g, i13}
                  <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:13px var(--space-14);box-sizing:border-box;border-radius:var(--radius-md);background:var(--overlay-1,rgba(255,255,255,.035));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);background:{g.wash}">
                      <span style="width:15px;height:15px;background:{g.tint};mask:{g.mask}"></span>
                    </span>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                      <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#E4E4EC);text-wrap:pretty">{t(g.label)}</span>
                      {#if g.hasDetail}
                        <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(g.detail)}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if v.noGates}
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-6);padding:var(--space-26) var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
              <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">No gates set</span>
              <span style="max-width:260px;text-align:center;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Anyone invited can join without meeting a requirement.</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if v.isRulesView}
        <div style="align-self:stretch;display:flex;flex-direction:column;gap:var(--space-14);min-width:0;box-sizing:border-box;padding-inline:var(--space-10)">
          {#if v.hasRules}
            {#each v.rules ?? [] as rule, i14}
              <div style="display:flex;gap:var(--space-10);min-width:0">
                <span style="flex:none;width:18px;font:var(--weight-semibold) var(--text-xs)/1.5 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(rule.n)}</span>
                <span style="flex:1;min-width:0;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">{t(rule.text)}</span>
              </div>
            {/each}
            <span style="font:var(--weight-regular) var(--text-sm)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Break the rules and your messages may be deleted, or you may be blocked from the group.</span>
          {/if}
          {#if v.noRules}
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-6);padding:var(--space-26) var(--space-18);box-sizing:border-box;border-radius:var(--radius-md);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
              <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">No rules set</span>
              <span style="max-width:260px;text-align:center;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Members can join without agreeing to anything.</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if v.isUserGroupsView}
        <div style="width:100%;max-width:520px;align-self:center;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <div style="display:grid;grid-template-columns:minmax(0,1fr);padding-top:var(--space-6)"><Field placeholder="Search user groups" value={v.ugQuery} onInput={v.onUgQuery} onClear={v.clearUgQuery} showShortcut={false}></Field></div>
          <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0;padding-top:var(--space-18)">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-md)/1.35 var(--font-sans);color:var(--ink,#ECECF1)">User groups ({t(v.userGroupTotal)})</span>
            <span style="padding-inline:var(--space-4);font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Mention a set of members at once, like @developers, and give them permissions together.</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0;padding-top:var(--space-6)">
            {#each v.userGroupRows ?? [] as u, i15}
              <div style="position:relative;display:grid;grid-template-columns:minmax(0,1fr)">
                <MemberRow title={u.title} subtitle={u.subtitle} color={u.color} onClick={u.open} onMenu={u.toggleMenu}></MemberRow>
                {#if u.menuOpen}
                  <div style="position:fixed;inset:0;z-index:19" onclick={v.closeUgMenu}></div>
                  <div style="position:absolute;inset-inline-end:var(--space-4);top:calc(100% - 6px);z-index:20;display:grid;grid-template-columns:max-content"><Menu minWidth="180px" items={u.menuItems}></Menu></div>
                {/if}
              </div>
            {/each}
            {#if v.noUgMatches}
              <span style="padding:var(--space-18) var(--space-4);text-align:center;font:var(--weight-regular) var(--text-md)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.ugEmptyText)}</span>
            {/if}
          </div>
        </div>
      {/if}

      {#if v.isUserGroupView}
        <div style="width:100%;max-width:520px;align-self:center;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
          <div style="display:grid;grid-template-columns:minmax(0,1fr);padding-top:var(--space-6)"><Field placeholder="Search group members" value={v.ugMemberQuery} onInput={v.onUgMemberQuery} onClear={v.clearUgMemberQuery} showShortcut={false}></Field></div>
          <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0;padding-top:var(--space-18)">
            <span style="padding-inline-start:var(--space-4);font:var(--weight-semibold) var(--text-md)/1.35 var(--font-sans);color:var(--ink,#ECECF1)">Members ({t(v.ugMemberTotal)})</span>
            <span style="padding-inline:var(--space-4);font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Mention them all with <span style="font-family:var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(v.ugMention)}</span>.</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4);min-width:0;padding-top:var(--space-6)">
            {#each v.ugMembers ?? [] as m, i16}
              <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MemberRow title={m.name} subtitle={m.handle} color={m.color} showMenu={false} onClick={m.open}></MemberRow></div>
            {/each}
            {#if v.noUgMemberMatches}
              <span style="padding:var(--space-18) var(--space-4);text-align:center;font:var(--weight-regular) var(--text-md)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">No members match “{t(v.ugMemberQuery)}”</span>
            {/if}
          </div>
        </div>
      {/if}

      {#if v.isPinnedView}
        <div style="width:100%;max-width:520px;align-self:center;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-18);min-width:0;padding-top:var(--space-6)">
          {#each v.pinnedGroups ?? [] as day, i17}
            <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0">
              <span style="align-self:center;padding:7px var(--space-14);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(day.date)}</span>
              {#each day.items ?? [] as p, i18}
                <div style="display:grid;grid-template-columns:minmax(0,1fr)"><MessageGroup side="received" senderName={p.author} color={p.color} showAvatar={true} showName={true} messages={p.messages}></MessageGroup></div>
              {/each}
            </div>
          {/each}
          {#if v.noPinned}
            <span style="padding:var(--space-24) var(--space-4);text-align:center;font:var(--weight-regular) var(--text-base)/1.5 var(--font-sans);color:var(--ink-4,#7C7C8C)">Nothing is pinned yet.</span>
          {/if}
        </div>
      {/if}

      {#if v.isStatsView}
        <div style="width:100%;max-width:520px;align-self:center;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);padding-top:var(--space-6)"><GroupStats mix={v.statSlices} engagement={v.statExtras}></GroupStats></div>
      {/if}

    </div>
  {/if}

  {#if v.muteMenuOpen}
    <div style="position:absolute;inset:0;z-index:44" onclick={v.closeMuteMenu} aria-hidden="true"></div>
    <div style="position:absolute;z-index:45;top:{v.muteMenuTop};left:{v.muteMenuLeft};width:216px;display:flex;flex-direction:column;gap:2px;padding:var(--space-8);box-sizing:border-box;border-radius:var(--radius-md);background:var(--surface-2,#17171d);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 18px 40px rgba(0,0,0,.5)">
      <span style="padding:var(--space-6) var(--space-8) var(--space-8);font:var(--weight-regular) var(--text-xs)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C)">Mute notifications for</span>
      {#each v.muteOptions ?? [] as o, i19}
        <div class="dc-p21" style="display:flex;align-items:center;min-width:0;padding:var(--space-8);border-radius:var(--radius-sm);font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={o.onSelect} role="button" tabindex="0">{t(o.label)}</div>
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
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p5:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p7:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p8:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p9:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p10:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p11:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p12:hover{filter:brightness(1.08) !important}
  .dc-p13:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p14:hover{background:var(--btn-hover,rgba(255,255,255,.12)) !important}
  .dc-p15:hover{background:var(--btn-hover,rgba(255,255,255,.12)) !important}
  .dc-p16:hover{background:color-mix(in oklch,var(--accent,#FF5672) 13%,transparent) !important}
  .dc-p17:hover{background:var(--btn-hover,rgba(255,255,255,.12)) !important}
  .dc-p18:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p19:hover{filter:brightness(1.08) !important}
  .dc-p20:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p21:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>

<!-- Generated from lib/ConversationHeader.dc.html (source hash ccaba540) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ConversationHeader.logic.js';
  import Avatar from '../../lib/components/Avatar.svelte';
  import Badge from '../../lib/components/Badge.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import Menu from '../../lib/components/Menu.svelte';

  interface Props {
    title?: string;
    kind?: string;
    color?: string;
    online?: boolean;
    verified?: boolean;
    presence?: string;
    visibility?: string;
    memberCount?: number;
    openDetails?: () => void;
    menuItems?: {label:string,mask:string,color?:string}[];
    showCall?: boolean;
    callLabel?: string;
    onCall?: () => void;
    actionHandlers?: Record<string, () => void>;
    actions?: string[];
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-12) var(--space-14);background:var(--surface-1,#0e0e12);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))" data-oc-header>
  <div class="dc-p0" style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-6) var(--space-12) var(--space-6) var(--space-6);margin:calc(var(--space-6) * -1) 0 calc(var(--space-6) * -1) calc(var(--space-6) * -1);border-radius:var(--radius-lg);cursor:pointer" onclick={v.openDetails} role="button" tabindex="0" aria-label={v.titleHint} title={v.titleHint}>
  <div style="flex:none;display:flex"><Avatar size={42} shape={v.avatarShape} color={v.color} online={v.showPresenceDot}></Avatar></div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
    <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
      {#if v.showHash}
        <span style="flex:none;width:15px;text-align:center;font:var(--weight-bold) var(--text-base)/1.2 var(--font-sans);color:var(--ink-3,#8A8A99)">#</span>
      {/if}
      <span style="font:var(--weight-bold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.title)}</span>
      {#if v.verified}
        <span style="flex:none;display:grid;grid-template-columns:max-content"><Badge variant="verified"></Badge></span>
      {/if}
      {#if v.hasStatus}
        <span style="flex:none;display:flex;align-items:center;gap:var(--space-4);margin-inline-start:var(--space-2,2px)">
          {#if v.statusFav}
            <span style="flex:none;width:14px;height:14px;background:var(--accent,#FF5672);mask:{v.statusHeartMask}" title="In your favourites"></span>
          {/if}
          {#if v.statusMuted}
            <span style="flex:none;width:14px;height:14px;background:var(--ink-3,#8A8A99);mask:{v.statusBellOffMask}" title={v.statusMutedTitle}></span>
          {/if}
          {#if v.statusEveryone}
            <span style="flex:none;width:14px;height:14px;background:var(--ink-3,#8A8A99);mask:{v.statusAtOffMask}" title="@everyone mentions muted"></span>
          {/if}
        </span>
      {/if}
      {#if v.showChevron}
        <span style="flex:none;width:14px;height:14px;background:var(--ink-3,#8A8A99);mask:{v.chevMask}"></span>
      {/if}
    </div>
    <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
      {#if v.showHash}
        <span style="flex:none;width:15px;display:flex;justify-content:center">
          <span style="width:13px;height:13px;background:{v.lockColor};mask:{v.lockMask}"></span>
        </span>
      {/if}
      {#if v.showInlineLock}
        <span style="flex:none;width:13px;height:13px;background:{v.lockColor};mask:{v.lockMask}"></span>
      {/if}
      <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:{v.presenceColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.presence)}</span>
    </div>
  </div>
  </div>
  <div style="flex:none;display:flex;align-items:center;gap:var(--space-6)">
    {#if v.showCall}
      <div style="flex:none;display:flex" title="Voice call"><IconButton variant="ghost" icon="phone" label="Voice call" onClick={v.onVoiceCall}></IconButton></div>
      <div style="flex:none;display:flex" data-oc-call title={v.callLabel}><IconButton variant="ghost" icon="video" label={v.callLabel} onClick={v.onCall}></IconButton></div>
    {/if}
    {#each v.actions ?? [] as action, i0}
      <div style="flex:none;display:flex"><IconButton variant="ghost" icon={action.icon} onClick={action.onPress}></IconButton></div>
    {/each}
    {#if v.showMenu}
    <div style="position:relative;display:flex" use:ref={v.menuRef}>
      <div style="flex:none;display:inline-flex" onclick={v.toggleMenu}>
        <IconButton variant="ghost" pressed={v.menuOpen} icon="more"></IconButton>
      </div>
      {#if v.menuOpen}
        <div style="position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:var(--z-modal,60)">
          <Menu items={v.menuItems}></Menu>
        </div>
      {/if}
    </div>
    {/if}
    {#if v.showPanelToggle}
      <span style="flex:none;width:var(--space-10,10px)" aria-hidden="true"></span>
      <div class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:var(--control-md,34px);height:var(--control-md,34px);border-radius:var(--radius-md);background:{v.panelBg};cursor:pointer" onclick={v.onTogglePanel} aria-label={v.panelHint} role="button" tabindex="0" title={v.panelHint} aria-pressed={v.panelOpen}>
        <span style="width:18px;height:18px;background:{v.panelInk};mask:{v.panelMask}"></span>
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p1:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
</style>

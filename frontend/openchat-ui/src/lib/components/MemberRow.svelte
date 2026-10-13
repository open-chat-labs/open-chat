<!-- Generated from lib/MemberRow.dc.html (source hash d9f8023f) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './MemberRow.logic.js';

  interface Props {
    title?: string;
    subtitle?: string;
    variant?: string;
    tag?: string;
    color?: string;
    online?: boolean;
    icon?: string;
    selected?: boolean;
    disabled?: boolean;
    muted?: boolean;
    badge?: string;
    onIcon?: () => void;
    actionLabel?: string;
    onAction?: () => void;
    showMenu?: boolean;
    onMenu?: () => void;
    onClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div class="dc-p0" style="--oc-row-hover:{v.rowHoverBg};width:100%;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-8) var(--space-8);border-radius:var(--radius-md);background:{v.rowBg};opacity:{v.rowOpacity};cursor:{v.rowCursor};" onclick={v.onPress} role="button" tabindex="0">
  {#if v.isInvite}
    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--accent-soft,rgba(255,86,114,.12));box-shadow:inset 0 0 0 1px var(--accent-dim,rgba(255,86,114,.35))">
      <span style="width:18px;height:18px;background:var(--accent,#FF5672);mask:{v.inviteMask}"></span>
    </span>
  {/if}
  {#if v.hasAvatar}
    <span style="position:relative;flex:none;width:38px;height:38px;border-radius:{v.avatarRadius};background:{v.avatarGradient};opacity:{v.avatarOpacity}">
      {#if v.hasPhoto}
        <span style="position:absolute;inset:0;border-radius:inherit;background:{v.photo}"></span>
      {/if}
      {#if v.online}
        <span style="position:absolute;inset-inline-end:-1px;inset-block-end:-1px;width:11px;height:11px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8);box-shadow:0 0 0 2px {v.ringColor}"></span>
      {/if}
      {#if v.isWebhook}
        <span style="position:absolute;inset-inline-end:-5px;inset-block-end:-5px;display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:var(--radius-pill);background:var(--card,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))" title="Webhook">
          <span style="width:11px;height:11px;background:var(--accent,#FF5672);mask:{v.hookMask}"></span>
        </span>
      {/if}
    </span>
  {/if}
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
    <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
      <span style="font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:{v.titleColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.title)}</span>
      {#if v.hasTag}
        <span style="flex:none;padding:2px var(--space-6);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-2xs)/1.3 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">{t(v.tag)}</span>
      {/if}
      {#if v.isYou}
        <span style="flex:none;padding:2px var(--space-6);border-radius:var(--radius-pill);background:var(--accent-soft,rgba(255,86,114,.12));font:var(--weight-semibold) var(--text-2xs)/1.3 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--accent-bright,#FF8298)">YOU</span>
      {/if}
    </div>
    {#if v.hasSubtitle}
      <span style="font:var(--weight-regular) {v.subtitleSize}/1.4 {v.subtitleFont};color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;{v.subtitleClamp}">{t(v.subtitle)}</span>
    {/if}
  </div>
  {#if v.showAction}
    <span class="dc-p1" style="flex:none;display:flex;align-items:center;gap:var(--space-6);padding:var(--space-6) var(--space-8);border-radius:var(--radius-sm);cursor:pointer;" onclick={v.onAction} role="button" tabindex="0">
      <span style="width:15px;height:15px;background:var(--accent,#FF5672);mask:{v.inviteMask}"></span>
      <span style="font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672);white-space:nowrap">{t(v.actionLabel)}</span>
    </span>
  {/if}
  {#if v.isTyping}
    <span style="flex:none;display:flex;align-items:center;padding:0 var(--space-2)" title="Typing">{#if v.typingDots}<span style="display:flex;gap:3px">{#each [0, 1, 2] as d}<span style="width:4px;height:4px;border-radius:50%;background:var(--accent-bright,#FF8298);animation:ocTypingDot 1.2s {d * 0.15}s infinite ease-in-out"></span>{/each}</span>{/if}</span>
  {/if}
  {#if v.hasActivityText}
    <span style="flex:none;font:{v.activityWeight} var(--text-sm)/1 var(--font-sans);color:{v.activityInk}">{t(v.activity)}</span>
  {/if}
  {#if v.hasBadge}
    <span style="flex:none;padding:2px var(--space-8);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-2xs)/1.4 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(v.badge)}</span>
  {/if}
  {#if v.showToggle}
    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--radius-pill);background:{v.toggleBg};box-shadow:inset 0 0 0 1px {v.toggleLine}">
      <span style="width:14px;height:14px;background:{v.toggleInk};mask:{v.toggleMask}"></span>
    </span>
  {/if}
  {#if v.showIcon}
    <span class="dc-p2" style="flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);background:{v.iconBg};cursor:pointer;" onclick={v.onIcon} role="button" tabindex="0">
      <span style="width:16px;height:16px;background:{v.iconInk};mask:{v.iconMaskValue}"></span>
    </span>
  {/if}
  {#if v.showMenu}
    <span class="dc-p3" style="flex:none;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--radius-sm);" onclick={v.onMenu} role="button" tabindex="0">
      <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.menuMask}"></span>
    </span>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--oc-row-hover) !important}
  .dc-p1:hover{background:var(--accent-soft,rgba(255,86,114,.12)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>

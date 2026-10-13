<!-- Generated from lib/ChatRow.dc.html (source hash d9730629) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ChatRow.logic.js';
  import Avatar from './Avatar.svelte';
  import ContextMenu from './ContextMenu.svelte';

  interface Props {
    liveCall?: '' | 'voice' | 'video';
    title?: string;
    preview?: string;
    time?: string;
    unreadCount?: number;
    typing?: boolean;
    pinned?: boolean;
    selected?: boolean;
    verified?: boolean;
    online?: boolean;
    kind?: string;
    color?: string;
    onPress?: () => void;
    onClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;outline:none;border-radius:var(--radius-lg);box-shadow:{v.focusRing}" use:ref={v.rootRef} onclick={v.onSelect} role="button" oncontextmenu={v.onContext} onmouseenter={v.onEnter} onmouseleave={v.onLeave} onpointerdown={v.onPDown} onpointerup={v.onPUp} onpointercancel={v.onPUp} onpointermove={v.onPMove} onfocus={v.onFocusIn} onblur={v.onFocusOut} onkeydown={v.onKey} tabindex={v.tabIndex}>
  <div class="dc-p0" style="position:relative;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-12);border-radius:var(--radius-lg);background:{v.rowBg};cursor:pointer" onclick={v.onPress}>
    {#if v.selected}
      <div style="position:absolute;inset:0;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))"></div>
    {/if}
    <div style="position:relative;flex:none">
      <Avatar size={42} shape={v.avatarShape} color={v.color} online={v.online}></Avatar>
    </div>
    <div style="position:relative;flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
      <div style="display:flex;align-items:center;gap:var(--space-6)">
        <span style="font:var(--weight-bold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#fff);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.title)}</span>
        {#if v.verified}
          <span style="flex:none;width:16px;height:16px;background:var(--status-verified,#3D9BFF);mask:var(--icon-verified) center/contain no-repeat"></span>
        {/if}
        <div style="flex:1"></div>
        {#if v.pinned}
          <span style="flex:none;width:12px;height:12px;background:var(--ink-4,#6E6E7C);mask:var(--icon-pin) center/contain no-repeat"></span>
        {/if}
        {#if v.fav}
          <span style="flex:none;width:11px;height:11px;background:var(--accent,#FF5672);mask:var(--icon-heart-filled) center/contain no-repeat" title="Favourite"></span>
        {/if}
        {#if v.muted}
          <span style="flex:none;width:12px;height:12px;background:var(--ink-4,#6E6E7C);mask:var(--icon-bell-off) center/contain no-repeat" title="Notifications muted"></span>
        {/if}
        <span style="flex:none;font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#6E6E7C)">{t(v.time)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-6);min-height:17px">
        {#if v.typing}
          <div style="display:flex;align-items:center;gap:var(--space-4)">
            <span style="width:5px;height:5px;border-radius:var(--radius-pill);background:var(--accent,#FF5672)"></span>
            <span style="width:5px;height:5px;border-radius:var(--radius-pill);background:var(--accent-mid,rgba(255,86,114,.6))"></span>
            <span style="width:5px;height:5px;border-radius:var(--radius-pill);background:var(--accent-dim,rgba(255,86,114,.35))"></span>
          </div>
        {/if}
        {#if v.showCall}
          <span style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;font:600 12.5px/1.35 'Plus Jakarta Sans',sans-serif;color:var(--status-online,#2EE6A8);overflow:hidden;white-space:nowrap"><span style="flex:none;width:13px;height:13px;background:currentColor;mask:{v.callMask}"></span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis">{t(v.callLabel)}</span></span>
        {/if}
        {#if v.showPreview}
          <span style="flex:1;min-width:0;font:{v.previewFont} 12.5px/1.35 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#8A8A99);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.preview)}</span>
        {/if}
        {#if v.unread}
          <span style="flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 var(--space-4);box-sizing:border-box;border-radius:var(--radius-pill);background:var(--accent,#FF5672);color:var(--on-accent,#2E0512);font:var(--weight-bold) var(--text-xs)/1 var(--font-sans)">{t(v.count)}</span>
        {/if}
        {#if v.hasMenu}<span style="flex:none;display:flex;justify-content:flex-end;height:18px;align-items:center;overflow:visible;width:{v.kebabW};margin-inline-start:{v.kebabGap};opacity:{v.kebabOp};pointer-events:{v.kebabPe};transition:width 180ms cubic-bezier(.2,.8,.2,1),margin 180ms cubic-bezier(.2,.8,.2,1),opacity 160ms ease" aria-hidden={v.kebabHidden}><span class="dc-p1" style="flex:none;width:24px;height:24px;margin-inline-end:-8px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;background:{v.kebabBg};cursor:pointer" use:ref={v.kebabRef} onclick={v.toggleMenu} aria-label="More" onpointerdown={v.stop} role="button" tabindex="-1" title="More" aria-haspopup="menu" aria-expanded={v.menuOpen}><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.kebabMask}"></span></span></span>{/if}
      </div>
    </div>
  </div>
  <ContextMenu open={v.menuOpen} point={v.menuPoint} anchor={v.menuAnchor} align={v.menuAlign} items={v.menuList} onClose={v.closeMenu}></ContextMenu>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.045)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
</style>

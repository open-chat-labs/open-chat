<!-- One chat in the chat list: avatar, title, last message (or typing dots and who's typing / live call), time, unread
     mentions (@) and unread count.
     Row menu (menuItems): right-click opens at the cursor, the kebab (hover / focus only) anchors under itself,
     a touch long-press anchors to the row at the finger, Shift+F10 / Menu key anchors to the row. All share one ContextMenu. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onDestroy } from 'svelte';
  import type { MenuItem } from '../types';
  import Avatar from './Avatar.svelte';
  import ContextMenu from './ContextMenu.svelte';

  type Rect = { left: number; right: number; top: number; bottom: number };

  interface Props {
    title: string;
    preview: string;
    /** An icon before the preview, e.g. `forward` when the last message was forwarded. */
    previewIcon?: string;
    time: string;
    kind?: 'user' | 'group' | 'channel';
    color?: 'violet' | 'blue' | 'teal' | 'amber' | 'plum';
    /** The avatar's image (an uploaded avatar) over the `color` gradient. */
    avatarUrl?: string;
    liveCall?: '' | 'voice' | 'video';
    unreadCount?: number;
    /** Unread mentions of the user: an @ before the unread count. */
    mentions?: number;
    /** Someone is typing, in place of the preview: the dots, then the text if it's one ("Lucy is typing"). */
    typing?: boolean | string;
    /** A private channel or group: a lock before the title. */
    locked?: boolean;
    pinned?: boolean;
    /** A favourite: a heart before the time (native). */
    fav?: boolean;
    muted?: boolean;
    selected?: boolean;
    /** Users only. */
    verified?: boolean;
    /** Users only. */
    online?: boolean;
    menuItems?: MenuItem[];
    onClick?: () => void;
  }

  let {
    title,
    preview,
    previewIcon,
    time,
    kind = 'user',
    color = 'violet',
    avatarUrl,
    liveCall = '',
    unreadCount = 0,
    mentions = 0,
    typing = false,
    locked = false,
    pinned = false,
    fav = false,
    muted = false,
    selected = false,
    verified = false,
    online = false,
    menuItems = [],
    onClick,
  }: Props = $props();
  const t = useT();

  let root: HTMLDivElement;
  let kebab = $state<HTMLSpanElement>();
  let hover = $state(false);
  let focused = $state(false);
  let focusVisible = $state(false);
  let touch = $state(false);
  let menu = $state<{ point: { x: number; y: number } | null; anchor: Rect | null; align: 'start' | 'end' } | null>(null);

  // long-press bookkeeping
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressStart: { x: number; y: number } | null = null;
  let pressFired = false;
  onDestroy(() => clearTimeout(pressTimer));

  const hasMenu = $derived(menuItems.length > 0);
  const showKebab = $derived(hasMenu && !touch && (hover || focused || !!menu));

  const rect = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  };

  function openAt(point: { x: number; y: number } | null, anchor: Rect | null, align: 'start' | 'end' = 'end') {
    menu = { point, anchor, align };
  }

  function select(e: MouseEvent) {
    // a long-press must not also open the chat
    if (pressFired) {
      pressFired = false;
      e.stopPropagation();
      return;
    }
    onClick?.();
  }

  function onKey(e: KeyboardEvent) {
    if (!hasMenu || e.target !== root) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      openAt(null, rect(root));
    }
  }

  // long-press (touch): 500ms hold without moving opens an anchored popover at the finger
  function pointerDown(e: PointerEvent) {
    touch = e.pointerType === 'touch';
    if (!hasMenu || !touch) return;
    const x = e.clientX, y = e.clientY;
    pressStart = { x, y };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressFired = true;
      const r = rect(root);
      openAt(null, { left: x, right: x, top: r.top, bottom: r.bottom }, 'start');
    }, 500);
  }

  function pointerMove(e: PointerEvent) {
    if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) {
      clearTimeout(pressTimer);
      pressStart = null;
    }
  }

  function pointerUp() {
    clearTimeout(pressTimer);
    pressStart = null;
  }

  function contextMenu(e: MouseEvent) {
    if (!hasMenu) return;
    e.preventDefault();
    e.stopPropagation();
    if (touch) {
      if (!menu) {
        clearTimeout(pressTimer);
        pressFired = true;
        const r = rect(root);
        openAt(null, { left: e.clientX, right: e.clientX, top: r.top, bottom: r.bottom }, 'start');
      }
      return;
    }
    openAt({ x: e.clientX, y: e.clientY }, null);
  }

  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (menu) menu = null;
    else openAt(null, kebab ? rect(kebab) : rect(root));
  }
</script>

<div
  class="chat-row"
  class:focus-visible={focusVisible}
  bind:this={root}
  onclick={select}
  role="button"
  oncontextmenu={contextMenu}
  onpointerenter={(e) => e.pointerType !== 'touch' && hasMenu && (hover = true)}
  onpointerleave={() => (hover = false)}
  onpointerdown={pointerDown}
  onpointerup={pointerUp}
  onpointercancel={pointerUp}
  onpointermove={pointerMove}
  onfocusin={(e) => {
    if (!hasMenu) return;
    focused = true;
    focusVisible = e.target === root && root.matches(':focus-visible');
  }}
  onfocusout={(e) => {
    if (!root.contains(e.relatedTarget as Node | null)) focused = focusVisible = false;
  }}
  onkeydown={onKey}
  tabindex={hasMenu ? 0 : undefined}
>
  <div class="row" class:menu-open={!!menu}>
    {#if selected}
      <div class="selected"></div>
    {/if}
    <div class="avatar">
      <Avatar size={42} shape={kind === 'group' ? 'squircle' : 'circle'} {color} url={avatarUrl} online={online && kind === 'user'} />
    </div>
    <div class="body">
      <div class="line">
        {#if locked}<span class="lock" role="img" aria-label={t('ui.chatRow.private')}></span>{/if}
        <span class="title">{kind === 'channel' ? '#' : ''}{title}</span>
        {#if verified && kind === 'user'}
          <span class="verified"></span>
        {/if}
        <div class="grow"></div>
        {#if pinned}
          <span class="flag pin"></span>
        {/if}
        {#if fav}
          <span class="flag fav" role="img" aria-label={t('ui.chatRow.favourite')} title={t('ui.chatRow.favourite')}></span>
        {/if}
        {#if muted}
          <span class="flag mute" title={t('ui.chatRow.muted')}></span>
        {/if}
        <span class="time">{time}</span>
      </div>
      <div class="line second">
        {#if typing}
          <div class="typing">
            <span class="dots" aria-hidden={typeof typing === 'string' ? 'true' : undefined}>
              <span class="dot"></span>
              <span class="dot mid"></span>
              <span class="dot dim"></span>
            </span>
            {#if typeof typing === 'string'}<span class="typing-text">{typing}</span>{/if}
          </div>
        {:else if liveCall}
          <span class="call"><span class="call-icon" style:mask="var(--icon-{liveCall === 'video' ? 'video' : 'phone'}) center/contain no-repeat"></span><span class="call-label">{t(liveCall === 'video' ? 'ui.chatRow.videoCallLive' : 'ui.chatRow.voiceCallLive')}</span></span>
        {:else}
          <span class="preview" class:unread={unreadCount > 0}
            >{#if previewIcon}<span
                class="preview-icon"
                style:mask="var(--icon-{previewIcon}) center/contain no-repeat"
                role={previewIcon === 'forward' ? 'img' : undefined}
                aria-label={previewIcon === 'forward' ? t('ui.chatRow.forwarded') : undefined}
                aria-hidden={previewIcon === 'forward' ? undefined : 'true'}></span
              >{/if}<span class="preview-text">{preview}</span></span>
        {/if}
        {#if mentions > 0}
          <span class="count mention" role="img" aria-label={t('ui.chatRow.mentions', { count: mentions })} title={t('ui.chatRow.mentions', { count: mentions })}>@</span>
        {/if}
        {#if unreadCount > 0}
          <span class="count">{unreadCount}</span>
        {/if}
        {#if hasMenu}<span class="kebab-slot" class:shown={showKebab} aria-hidden={showKebab ? undefined : 'true'}
            ><span
              class="kebab"
              bind:this={kebab}
              onclick={toggleMenu}
              aria-label={t('ui.common.more')}
              onpointerdown={(e) => e.stopPropagation()}
              role="button"
              tabindex="-1"
              title={t('ui.common.more')}
              aria-haspopup="menu"
              aria-expanded={!!menu}><span class="kebab-icon"></span></span
            ></span
          >{/if}
      </div>
    </div>
  </div>
  <!-- the menu sits inside the row, so a pick must not also select the row (open the chat) -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="menu-host" onclick={(e) => e.stopPropagation()} onpointerdown={(e) => e.stopPropagation()} onpointerup={(e) => e.stopPropagation()}>
    <ContextMenu
      open={!!menu}
      point={menu?.point}
      anchor={menu?.anchor}
      align={menu?.align}
      items={menuItems}
      onClose={() => {
        menu = null;
        hover = false;
      }}
    />
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .menu-host {
    display: contents;
  }

  .chat-row {
    position: relative;
    width: 100%;
    outline: none;
    border-radius: var(--radius-lg);

    &.focus-visible {
      box-shadow: 0 0 0 2px var(--accent);
    }
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-12);
    border-radius: var(--radius-lg);
    background: transparent;
    cursor: pointer;

    &:hover,
    &.menu-open {
      background: var(--overlay-1);
    }
  }

  .selected {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .avatar {
    position: relative;
    flex: none;
  }

  .body {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--space-6);

    &.second {
      min-height: 17px;
    }
  }

  .title {
    font: var(--weight-bold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
    @include truncate;
  }

  .verified {
    @include icon(verified, 16px, var(--status-verified));
  }

  .grow {
    flex: 1;
  }

  .flag {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--ink-4);
  }

  .pin {
    background: var(--accent);
    mask: var(--icon-pin) center/contain no-repeat;
  }

  .fav {
    width: 11px;
    height: 11px;
    background: var(--accent);
    mask: var(--icon-heart-filled) center/contain no-repeat;
  }

  .lock {
    @include icon(lock, 13px, var(--ink-3));
  }

  .mute {
    mask: var(--icon-bell-off) center/contain no-repeat;
  }

  .time {
    flex: none;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .typing {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .dots {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  // who's typing, in the accent as the composer's typing strip has it
  .typing-text {
    min-width: 0;
    font: var(--weight-medium) 12.5px/1.35 'Plus Jakarta Sans', sans-serif;
    color: var(--accent-bright);
    @include truncate;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--accent);

    &.mid {
      background: var(--accent-mid);
    }

    &.dim {
      background: var(--accent-dim);
    }
  }

  .call,
  .preview {
    flex: 1;
    min-width: 0;
    font: 400 12.5px/1.35 'Plus Jakarta Sans', sans-serif;
    overflow: hidden;
    white-space: nowrap;
  }

  .call {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--status-online);
  }

  .call-icon {
    flex: none;
    width: 13px;
    height: 13px;
    background: currentColor;
  }

  .call-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preview {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--ink-3);

    &.unread {
      font-weight: 600;
    }
  }

  .preview-icon {
    flex: none;
    width: 13px;
    height: 13px;
    background: currentColor;
  }

  .preview-text {
    @include truncate;
    min-width: 0;
  }

  .count {
    flex: none;
    @include flex-center(inline-flex);
    min-width: 18px;
    height: 18px;
    padding: 0 var(--space-4);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--on-accent);
    font: var(--weight-bold) var(--text-xs) / 1 var(--font-sans);
  }

  .kebab-slot {
    flex: none;
    display: flex;
    justify-content: flex-end;
    height: 18px;
    align-items: center;
    overflow: visible;
    width: 0px;
    margin-inline-start: calc(var(--space-6) * -1);
    opacity: 0;
    pointer-events: none;
    transition:
      width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
      margin 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 160ms ease;

    &.shown {
      width: 14px;
      margin-inline-start: var(--space-4);
      opacity: 1;
      pointer-events: auto;
    }
  }

  .kebab {
    flex: none;
    width: 24px;
    height: 24px;
    margin-inline-end: -8px;
    border-radius: var(--radius-sm);
    @include flex-center;
    background: transparent;
    cursor: pointer;

    .menu-open &,
    &:hover {
      background: var(--overlay-2);
    }
  }

  .kebab-icon {
    @include icon(kebab, 14px, var(--ink-3), $flex: null);
  }
</style>

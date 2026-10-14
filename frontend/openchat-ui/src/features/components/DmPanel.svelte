<!-- Side panel for a direct chat: cover (⋯ opens menuItems), big avatar and name (open the profile), Mute and Favourite pills,
     member-since / CHIT / about cards, the per-chat settings and Block. Mute and favourite stick locally until the parent changes them. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import type { MenuItem } from '../../lib/types';
  import DetailSection from '../../lib/components/DetailSection.svelte';
  import DmChatSettings from './DmChatSettings.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';

  type MuteKey = '8h' | '1w' | 'always';

  const MUTE_SPANS: { key: MuteKey; label: string; tile: string }[] = [
    { key: '8h', label: 'For 8 hours', tile: 'Muted · 8h' },
    { key: '1w', label: 'For 1 week', tile: 'Muted · 1w' },
    { key: 'always', label: 'Until I turn it back on', tile: 'Muted' },
  ];
  const GRADIENTS = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    rose: 'linear-gradient(140deg,#ff7a9c,#d6336c)',
    plum: 'linear-gradient(140deg,#b06bff,#5b2a86)',
    slate: 'linear-gradient(140deg,#8a93a6,#3b4252)',
  };

  type Settings = ComponentProps<typeof DmChatSettings>;

  interface Props {
    title: string;
    handle?: string;
    about?: string;
    color?: keyof typeof GRADIENTS;
    online?: boolean;
    memberSince: string;
    chit: string;
    fav?: boolean;
    muted?: MuteKey | null;
    disappearOn?: boolean;
    disappearAfter?: string;
    readReceipts?: boolean;
    cover?: string;
    /** Behind the cover's ⋯; the button only shows when there are items. */
    menuItems?: MenuItem[];
    coverHandlers?: { close?: () => void };
    onMuteChange?: (key: MuteKey | null) => void;
    onToggleFavourite?: () => void;
    onDisappearChange?: Settings['onDisappearChange'];
    onReadReceiptsChange?: Settings['onReadReceiptsChange'];
    onOpenProfile?: (tab: 'profile') => void;
    onBlock?: () => void;
  }

  let {
    title,
    handle = '',
    about = '',
    color = 'violet',
    online = false,
    memberSince,
    chit,
    fav = false,
    muted = null,
    disappearOn = false,
    disappearAfter = '12 hours',
    readReceipts = false,
    cover = '',
    menuItems = [],
    coverHandlers = {},
    onMuteChange,
    onToggleFavourite,
    onDisappearChange,
    onReadReceiptsChange,
    onOpenProfile,
    onBlock,
  }: Props = $props();

  let isMuted = $derived(muted);
  let isFav = $derived(fav);
  let menuOpen = $state(false);
  let muteMenu = $state<{ top: number; left: number } | null>(null);

  const span = $derived(MUTE_SPANS.find((o) => o.key === isMuted));
  const items = $derived(
    menuItems.map((it) =>
      it.onSelect
        ? {
            ...it,
            onSelect: () => {
              menuOpen = false;
              it.onSelect?.();
            },
          }
        : it,
    ),
  );
  const muteOptions = $derived(
    isMuted
      ? [{ label: 'Unmute notifications', key: null }, ...MUTE_SPANS.filter((o) => o.key !== isMuted).map((o) => ({ label: o.label, key: o.key }))]
      : MUTE_SPANS.map((o) => ({ label: o.label, key: o.key })),
  );

  function setMute(key: MuteKey | null) {
    isMuted = key;
    muteMenu = null;
    onMuteChange?.(key);
  }

  // mute: same pill + span menu as the group side panel, placed under the pill inside the panel
  function openMuteMenu(e: MouseEvent & { currentTarget: HTMLElement }) {
    const el = e.currentTarget, root = el.closest('[data-panel-root]');
    if (!root) return;
    const r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
    muteMenu = { top: r.bottom - b.top + 6, left: Math.max(16, Math.min(r.left - b.left, b.width - 232)) };
  }
</script>

<div class="panel" data-panel-root="true">
  <div class="scroll" onscroll={() => (muteMenu = null)}>
    <div class="cover">
      <PanelCover {cover} actions={['close']} trailActions={items.length ? ['more'] : []} handlers={{ ...coverHandlers, more: () => (menuOpen = !menuOpen) }} />
    </div>
    <div class="body">
      <div class="identity">
        <div class="avatar" style:background={GRADIENTS[color] ?? GRADIENTS.violet} onclick={() => onOpenProfile?.('profile')} aria-label="View profile" role="button" tabindex="0" title="View profile">
          {#if online}
            <span class="online"></span>
          {/if}
        </div>
        <span class="name" onclick={() => onOpenProfile?.('profile')} aria-label="View profile" role="button" tabindex="0" title="View profile">{title}</span>
        {#if handle}
          <span class="handle">{handle}</span>
        {/if}
        <div class="pills">
          <span class="pill mute" class:on={!!isMuted} onclick={openMuteMenu} aria-label={isMuted ? 'Change or end the mute' : 'Mute notifications'} role="button" tabindex="0" title={isMuted ? 'Change or end the mute' : 'Mute notifications'}>
            <span class="pill-icon" style:mask="var(--icon-{isMuted ? 'bell-off' : 'bell'}) center/contain no-repeat"></span>{span ? span.tile : 'Mute'}
            <span class="pill-divider"></span><span class="caret"></span>
          </span>
          <span
            class="pill fav"
            class:on={isFav}
            onclick={() => {
              isFav = !isFav;
              onToggleFavourite?.();
            }}
            role="button"
            tabindex="0"
            aria-pressed={isFav}
          >
            <span class="pill-icon heart"></span>{isFav ? 'Favourited' : 'Favourite'}
          </span>
        </div>
      </div>
      <div class="cards">
        <div class="pair">
          <div class="cell"><DetailSection label="Member since" value={memberSince} /></div>
          <div class="cell"><DetailSection label="CHIT earned" value={chit} highlight={true} /></div>
        </div>
        {#if about}
          <div class="cell"><DetailSection label="About" value={about} variant="prose" clamp={3} /></div>
        {/if}
      </div>
    </div>
  </div>

  <div class="settings">
    <span class="settings-title">This chat</span>
    <div class="cell"><DmChatSettings peerName={title} {disappearOn} {disappearAfter} {readReceipts} {onDisappearChange} {onReadReceiptsChange} /></div>
  </div>

  <div class="footer">
    <span class="block" onclick={() => onBlock?.()} role="button" tabindex="0"><span class="ban"></span>Block user</span>
  </div>

  {#if muteMenu}
    <div class="backdrop mute-backdrop" onclick={() => (muteMenu = null)} aria-hidden="true"></div>
    <div class="mute-menu" style:top="{muteMenu.top}px" style:left="{muteMenu.left}px">
      <span class="mute-title">{isMuted ? 'Muted' : 'Mute notifications for'}</span>
      {#each muteOptions as o}
        <div class="mute-option" onclick={() => setMute(o.key)} role="button" tabindex="0">{o.label}</div>
      {/each}
    </div>
  {/if}

  {#if menuOpen && items.length > 0}
    <div class="backdrop" onclick={() => (menuOpen = false)} aria-hidden="true"></div>
    <div class="menu">
      <Menu {items} />
    </div>
  {/if}
</div>

<style>
  .panel {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
  }

  /* content scrolls instead of squashing: no child of the scroll column may shrink */
  .scroll > :global(*) {
    flex-shrink: 0;
  }

  .cover {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .body {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-22, 22px);
    padding: 0 var(--space-16) var(--space-22, 22px);
    margin-top: -64px;
  }

  .identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .avatar {
    position: relative;
    flex: none;
    width: 128px;
    height: 128px;
    margin-bottom: var(--space-8);
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 4px var(--surface-1, #0e0e12);
    cursor: pointer;
  }

  .online {
    position: absolute;
    bottom: 8px;
    inset-inline-end: 8px;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    background: var(--status-online, #2ee6a8);
    border: 3px solid var(--surface-1, #0e0e12);
  }

  .name {
    max-width: 100%;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
    text-align: center;
    text-wrap: pretty;
    cursor: pointer;
  }

  .handle {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .pills {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--space-8);
    margin-top: var(--space-12);
  }

  .pill {
    --pill-ink: var(--ink-2, #c9c9d4);
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--pill-ink);
    cursor: pointer;
    user-select: none;
  }

  .pill.on {
    --pill-ink: var(--accent-bright, #ff8298);
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .pill:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .mute {
    padding: 0 9px 0 12px;
  }

  .fav {
    padding: 0 13px 0 12px;
  }

  .pill-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--pill-ink);
  }

  .pill-icon.heart {
    mask: var(--icon-heart) center/contain no-repeat;
  }

  .pill-divider {
    width: 1px;
    height: 16px;
    margin: 0 2px 0 3px;
    background: var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .caret {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--pill-ink);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-6);
  }

  .settings {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-8) var(--space-16) var(--space-16);
  }

  .settings-title {
    padding-inline-start: var(--space-4);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-4, #8a8a99);
  }

  .footer {
    flex: none;
    height: 72px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    padding: 0 var(--space-16);
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .block {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: var(--control-lg, 40px);
    border-radius: var(--radius-md);
    background: var(--btn-danger-bg, rgba(240, 68, 56, 0.08));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--status-danger, #f5493d);
    cursor: pointer;
    user-select: none;
  }

  .block:hover {
    background: var(--btn-danger-hover, rgba(240, 68, 56, 0.14));
  }

  .ban {
    width: 15px;
    height: 15px;
    background: var(--status-danger, #f5493d);
    mask: var(--icon-ban) center/contain no-repeat;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 40;
  }

  .mute-backdrop {
    z-index: 44;
  }

  .mute-menu {
    position: absolute;
    z-index: 45;
    width: 216px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-8);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--surface-2, #17171d);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12)),
      0 18px 40px rgba(0, 0, 0, 0.5);
  }

  .mute-title {
    padding: var(--space-6) var(--space-8) var(--space-8);
    font: var(--weight-regular) var(--text-xs) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .mute-option {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: var(--space-8);
    border-radius: var(--radius-sm);
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .mute-option:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .menu {
    position: absolute;
    top: 46px;
    inset-inline-end: var(--space-16);
    z-index: 41;
    display: grid;
    grid-template-columns: max-content;
    justify-items: end;
  }
</style>

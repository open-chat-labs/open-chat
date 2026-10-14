<!-- Side panel for a direct chat: cover (⋯ opens menuItems), big avatar and name (open the profile), Mute and Favourite pills,
     member-since / CHIT / about cards, the per-chat settings and Block. Mute and favourite apply at once and roll back with an
     error if the host rejects; Block asks first and waits for the host. Favourite and Block are hidden without callbacks. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import type { ComponentProps } from 'svelte';
  import type { MenuItem } from '../../lib/types';
  import DetailSection from '../../lib/components/DetailSection.svelte';
  import DmChatSettings from './DmChatSettings.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';

  type MuteKey = '8h' | '1w' | 'always';

  const MUTE_SPANS: { key: MuteKey; label: string; tile: string }[] = [
    { key: '8h', label: 'ui.mute.for8h', tile: 'ui.mute.muted8h' },
    { key: '1w', label: 'ui.mute.for1w', tile: 'ui.mute.muted1w' },
    { key: 'always', label: 'ui.mute.untilOn', tile: 'ui.mute.muted' },
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
    /** CSS background (image URL or gradient) for the avatar; falls back to the colour gradient. */
    avatar?: string;
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
    onMuteChange?: (key: MuteKey | null) => Promise<unknown> | void;
    /** Receives the new state. */
    onToggleFavourite?: (fav: boolean) => Promise<unknown> | void;
    onDisappearChange?: Settings['onDisappearChange'];
    onReadReceiptsChange?: Settings['onReadReceiptsChange'];
    onOpenProfile?: (tab: 'profile') => void;
    /** You have blocked this person (shows Unblock). */
    blocked?: boolean;
    /** Block after the user confirms. Hidden without it. */
    onBlock?: () => Promise<unknown> | void;
    onUnblock?: () => Promise<unknown> | void;
  }

  let {
    title,
    handle = '',
    about = '',
    color = 'violet',
    avatar,
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
    blocked = false,
    onBlock,
    onUnblock,
  }: Props = $props();
  const t = useT();

  let isMuted = $derived(muted);
  let isFav = $derived(fav);
  let menuOpen = $state(false);
  let muteMenu = $state<{ top: number; left: number } | null>(null);
  let failed = $state<string | null>(null);
  let blockStep = $state<'idle' | 'confirm' | 'busy'>('idle');

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
      ? [{ label: 'ui.mute.unmute', key: null }, ...MUTE_SPANS.filter((o) => o.key !== isMuted).map((o) => ({ label: o.label, key: o.key }))]
      : MUTE_SPANS.map((o) => ({ label: o.label, key: o.key })),
  );

  // optimistic: shows the change now, restores it with an error if the host rejects — but only when the rejected call
  // is still the latest for that field (a newer change may already have replaced it)
  const latest: Record<string, number> = {};
  async function optimistic(field: string, apply: () => void, undo: () => void, call: () => Promise<unknown> | void) {
    const seq = (latest[field] = (latest[field] ?? 0) + 1);
    failed = null;
    apply();
    try {
      await call();
    } catch {
      if (latest[field] !== seq) return;
      undo();
      failed = 'ui.dmPanel.actionFailed';
    }
  }

  function setMute(key: MuteKey | null) {
    const was = isMuted;
    muteMenu = null;
    optimistic(
      'mute',
      () => (isMuted = key),
      () => (isMuted = was),
      () => onMuteChange?.(key),
    );
  }

  function toggleFav() {
    if (!onToggleFavourite) return;
    const next = !isFav;
    optimistic(
      'fav',
      () => (isFav = next),
      () => (isFav = !next),
      () => onToggleFavourite(next),
    );
  }

  function cancelBlock() {
    if (blockStep === 'busy') return;
    blockStep = 'idle';
    failed = null;
  }

  async function confirmBlock() {
    // the host may flip `blocked` before it resolves, so decide from the state the user acted on
    const wasBlocked = blocked;
    const call = wasBlocked ? onUnblock : onBlock;
    if (!call || blockStep === 'busy') return;
    blockStep = 'busy';
    failed = null;
    try {
      await call();
    } catch {
      blockStep = 'confirm';
      failed = wasBlocked ? 'ui.dmPanel.unblockFailed' : 'ui.dmPanel.blockFailed';
      return;
    }
    blockStep = 'idle';
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
        <div class="avatar" style:background={avatar || (GRADIENTS[color] ?? GRADIENTS.violet)} onclick={() => onOpenProfile?.('profile')} aria-label={t('ui.dmPanel.viewProfile')} role="button" tabindex="0" title={t('ui.dmPanel.viewProfile')}>
          {#if online}
            <span class="online"></span>
          {/if}
        </div>
        <span class="name" onclick={() => onOpenProfile?.('profile')} aria-label={t('ui.dmPanel.viewProfile')} role="button" tabindex="0" title={t('ui.dmPanel.viewProfile')}>{title}</span>
        {#if handle}
          <span class="handle">{handle}</span>
        {/if}
        <div class="pills">
          <span class="pill mute" class:on={!!isMuted} onclick={openMuteMenu} aria-label={t(isMuted ? 'ui.mute.change' : 'ui.mute.muteNotifications')} role="button" tabindex="0" title={t(isMuted ? 'ui.mute.change' : 'ui.mute.muteNotifications')}>
            <span class="pill-icon" style:mask="var(--icon-{isMuted ? 'bell-off' : 'bell'}) center/contain no-repeat"></span>{t(span ? span.tile : 'ui.mute.mute')}
            <span class="pill-divider"></span><span class="caret"></span>
          </span>
          {#if onToggleFavourite}
            <span class="pill fav" class:on={isFav} onclick={toggleFav} role="button" tabindex="0" aria-pressed={isFav}>
              <span class="pill-icon heart"></span>{t(isFav ? 'ui.dmPanel.favourited' : 'ui.dmPanel.favourite')}
            </span>
          {/if}
        </div>
      </div>
      <div class="cards">
        <div class="pair">
          <div class="cell"><DetailSection label="ui.dmPanel.memberSince" value={memberSince} /></div>
          <div class="cell"><DetailSection label="ui.dmPanel.chitEarned" value={chit} highlight={true} /></div>
        </div>
        {#if about}
          <div class="cell"><DetailSection label="ui.dmPanel.about" value={about} variant="prose" clamp={3} /></div>
        {/if}
      </div>
      {#if failed && blockStep === 'idle'}<span class="error" role="alert">{t(failed)}</span>{/if}
    </div>
  </div>

  <div class="settings">
    <span class="settings-title">{t('ui.dmPanel.thisChat')}</span>
    <div class="cell"><DmChatSettings peerName={title} {disappearOn} {disappearAfter} {readReceipts} {onDisappearChange} {onReadReceiptsChange} /></div>
  </div>

  {#if blockStep !== 'idle'}
    <div class="footer confirm">
      <span class="confirm-text">{failed ? t(failed) : t(blocked ? 'ui.dmPanel.unblockConfirm' : 'ui.dmPanel.blockConfirm', { name: title })}</span>
      <div class="confirm-actions">
        <span class="cancel" onclick={cancelBlock} role="button" tabindex="0">{t('ui.common.cancel')}</span>
        <span class="block" class:busy={blockStep === 'busy'} onclick={confirmBlock} role="button" tabindex="0" aria-disabled={blockStep === 'busy'}
          ><span class="ban"></span>{t(blockStep === 'busy' ? 'ui.dmPanel.working' : blocked ? 'ui.dmPanel.unblockUser' : 'ui.dmPanel.blockUser')}</span
        >
      </div>
    </div>
  {:else if blocked ? onUnblock : onBlock}
    <div class="footer">
      <span class="block" onclick={() => (blockStep = 'confirm')} role="button" tabindex="0"><span class="ban"></span>{t(blocked ? 'ui.dmPanel.unblockUser' : 'ui.dmPanel.blockUser')}</span>
    </div>
  {/if}

  {#if muteMenu}
    <div class="backdrop mute-backdrop" onclick={() => (muteMenu = null)} aria-hidden="true"></div>
    <div class="mute-menu" style:top="{muteMenu.top}px" style:left="{muteMenu.left}px">
      <span class="mute-title">{t(isMuted ? 'ui.mute.muted' : 'ui.mute.muteFor')}</span>
      {#each muteOptions as o}
        <div class="mute-option" onclick={() => setMute(o.key)} role="button" tabindex="0">{t(o.label)}</div>
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

  .error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .footer.confirm {
    height: auto;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-10);
    padding: var(--space-14) var(--space-16);
  }

  .confirm-text {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .confirm-actions {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .cancel {
    flex: none;
    padding: 0 var(--space-14);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
  }

  .block.busy {
    opacity: 0.6;
    cursor: default;
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

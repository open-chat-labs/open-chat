<!-- Header above a conversation: avatar, name (opens details), presence or "Public · N members", your status icons
     (favourite / muted / @everyone muted), call buttons, extra action icons, the ⋯ menu and an optional side-panel toggle.
     The menu defaults to the standard actions per kind; "Leave …" items call onLeave, items without onSelect report via onMenu. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { MenuItem } from '../../lib/types';
  import Avatar from '../../lib/components/Avatar.svelte';
  import Badge from '../../lib/components/Badge.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import Menu from '../../lib/components/Menu.svelte';

  const mask = (name: string) => `var(--icon-${name}) center/contain no-repeat`;
  const FAVOURITE: MenuItem = { label: 'Add to favourites', mask: mask('heart'), variant: 'regular' };
  const COPY_URL: MenuItem = { label: 'Copy URL', mask: mask('link'), variant: 'regular' };
  const MUTE: MenuItem = { label: 'Mute notifications', mask: mask('bell-off'), variant: 'regular' };
  const MUTE_EVERYONE: MenuItem = { label: 'Mute @everyone', mask: mask('at'), variant: 'regular' };
  const GROUP_MENU: MenuItem[] = [FAVOURITE, COPY_URL, MUTE, MUTE_EVERYONE, { label: 'Leave group', mask: mask('exit'), variant: 'danger' }];
  const DM_MENU: MenuItem[] = [
    FAVOURITE,
    COPY_URL,
    MUTE,
    { label: 'Block user', mask: mask('ban'), variant: 'danger' },
    { label: 'Delete chat', mask: mask('trash'), variant: 'danger' },
  ];

  type Action = string | { icon: string; minVw?: number; maxVw?: number; onPress?: () => void };

  interface Props {
    title: string;
    kind?: 'user' | 'group' | 'channel';
    color?: 'violet' | 'amber' | 'teal' | 'blue';
    online?: boolean;
    verified?: boolean;
    /** Overrides the second line ("Online", or "Public · 248 members" for groups and channels). */
    presence?: string;
    visibility?: 'Public' | 'Private';
    memberCount?: number;
    openDetails?: () => void;
    /** Tooltip and accessible name for the name area. */
    titleHint?: string;
    /** Chevron after the name: the name opens the group itself. */
    titleChevron?: boolean;
    statusFav?: boolean;
    /** true, or the mute duration ('8h' | '1w') for the tooltip. */
    statusMuted?: boolean | '8h' | '1w';
    statusEveryone?: boolean;
    /** Channels: flips the favourite item's wording. */
    isFavourite?: boolean;
    menuItems?: MenuItem[];
    showMenu?: boolean;
    showCall?: boolean;
    callLabel?: string;
    onCall?: () => void;
    onVoiceCall?: () => void;
    /** Extra icon buttons before the menu; strings are icon names wired through actionHandlers. */
    actions?: Action[];
    actionHandlers?: Record<string, () => void>;
    onLeave?: () => void;
    onMenu?: (label: string) => void;
    onTogglePanel?: () => void;
    panelOpen?: boolean;
  }

  let {
    title,
    kind = 'user',
    color = 'violet',
    online = false,
    verified = false,
    presence = '',
    visibility,
    memberCount = 0,
    openDetails,
    titleHint,
    titleChevron = false,
    statusFav = false,
    statusMuted = false,
    statusEveryone = false,
    isFavourite = false,
    menuItems,
    showMenu = true,
    showCall = true,
    callLabel = 'Video call',
    onCall,
    onVoiceCall,
    actions = ['search'],
    actionHandlers = {},
    onLeave,
    onMenu,
    onTogglePanel,
    panelOpen = false,
  }: Props = $props();

  let menuOpen = $state(false);
  let menuBox = $state<HTMLDivElement>();
  let vw = $state(typeof window === 'undefined' ? 1920 : window.innerWidth);

  const channel = $derived(kind === 'channel');
  const many = $derived(kind === 'channel' || kind === 'group');
  const user = $derived(kind === 'user');
  const privateChat = $derived(visibility === 'Private');

  const items = $derived.by(() => {
    const base =
      menuItems ??
      (channel
        ? [{ label: 'Invite', mask: mask('invite') }, { ...FAVOURITE, label: isFavourite ? 'Remove from favourites' : 'Add to favourites' }, COPY_URL, { label: 'Leave channel', mask: mask('exit'), variant: 'danger' as const }]
        : kind === 'group'
          ? GROUP_MENU
          : DM_MENU);
    return base.map((it) => ({
      ...it,
      onSelect: () => {
        menuOpen = false;
        if (it.onSelect) it.onSelect();
        // dialogs are rendered by the host so their fixed layout isn't trapped in this column
        else if (/^leave/i.test(it.label)) onLeave?.();
        else onMenu?.(it.label);
      },
    }));
  });

  const shownActions = $derived(
    actions
      .map((a) => (typeof a === 'string' ? { icon: a } : a))
      .filter((a) => (a.minVw == null || vw >= a.minVw) && (a.maxVw == null || vw < a.maxVw))
      .map((a) => ({ ...a, onPress: a.onPress ?? actionHandlers[a.icon] })),
  );

  onMount(() => {
    const away = (e: MouseEvent) => {
      if (menuOpen && menuBox && !menuBox.contains(e.target as Node)) menuOpen = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) menuOpen = false;
    };
    document.addEventListener('click', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', away, true);
      document.removeEventListener('keydown', esc);
    };
  });
</script>

<svelte:window bind:innerWidth={vw} />

<div class="header" data-oc-header>
  <div class="identity" onclick={openDetails} role="button" tabindex="0" aria-label={titleHint || undefined} title={titleHint || undefined}>
    <div class="avatar"><Avatar size={42} shape={kind === 'group' ? 'squircle' : 'circle'} {color} online={online && user} /></div>
    <div class="names">
      <div class="line">
        <span class="title">{channel ? '#' : ''}{title}</span>
        {#if verified && user}
          <span class="badge"><Badge variant="verified" /></span>
        {/if}
        {#if statusFav || statusMuted || statusEveryone}
          <span class="statuses">
            {#if statusFav}
              <span class="status fav" title="In your favourites"></span>
            {/if}
            {#if statusMuted}
              <span class="status muted" title={statusMuted === '8h' ? 'Muted for 8 hours' : statusMuted === '1w' ? 'Muted for 1 week' : 'Notifications muted'}></span>
            {/if}
            {#if statusEveryone}
              <span class="status everyone" title="@everyone mentions muted"></span>
            {/if}
          </span>
        {/if}
        {#if titleChevron}
          <span class="chevron"></span>
        {/if}
      </div>
      <div class="line">
        {#if many && visibility}
          <span class="lock" class:private={privateChat}></span>
        {/if}
        <span class="presence" class:online={online && user}>{presence || (many ? `${visibility ?? 'Public'} · ${memberCount} members` : online ? 'Online' : '')}</span>
      </div>
    </div>
  </div>
  <div class="actions">
    {#if showCall && !channel}
      <div class="slot" title="Voice call"><IconButton variant="ghost" icon="phone" label="Voice call" onClick={onVoiceCall} /></div>
      <div class="slot" data-oc-call title={callLabel}><IconButton variant="ghost" icon="video" label={callLabel} onClick={onCall} /></div>
    {/if}
    {#each shownActions as action}
      <div class="slot"><IconButton variant="ghost" icon={action.icon} onClick={action.onPress} /></div>
    {/each}
    {#if showMenu}
      <div class="menu-anchor" bind:this={menuBox}>
        <div class="menu-button" onclick={() => (menuOpen = !menuOpen)} role="presentation">
          <IconButton variant="ghost" pressed={menuOpen} icon="more" />
        </div>
        {#if menuOpen}
          <div class="popover">
            <Menu {items} />
          </div>
        {/if}
      </div>
    {/if}
    {#if onTogglePanel}
      <span class="gap" aria-hidden="true"></span>
      <div
        class="panel-toggle"
        class:open={panelOpen}
        onclick={onTogglePanel}
        aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
        role="button"
        tabindex="0"
        title={panelOpen ? 'Hide side panel' : 'Show side panel'}
        aria-pressed={panelOpen}
      >
        <span class="panel-icon"></span>
      </div>
    {/if}
  </div>
</div>

<style>
  .header {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-12) var(--space-14);
    background: var(--surface-1, #0e0e12);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .identity {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-6) var(--space-12) var(--space-6) var(--space-6);
    margin: calc(var(--space-6) * -1) 0 calc(var(--space-6) * -1) calc(var(--space-6) * -1);
    border-radius: var(--radius-lg);
    cursor: pointer;
  }

  .identity:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .avatar,
  .slot {
    flex: none;
    display: flex;
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .title {
    font: var(--weight-bold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    flex: none;
    display: grid;
    grid-template-columns: max-content;
  }

  .statuses {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-inline-start: var(--space-2, 2px);
  }

  .status {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-3, #8a8a99);
  }

  .status.fav {
    background: var(--accent, #ff5672);
    mask: var(--icon-heart-filled) center/contain no-repeat;
  }

  .status.muted {
    mask: var(--icon-bell-off) center/contain no-repeat;
  }

  .status.everyone {
    mask: var(--icon-at-off) center/contain no-repeat;
  }

  .chevron {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-3, #8a8a99);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .lock {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-lock-open) center/contain no-repeat;
  }

  .lock.private {
    background: var(--status-danger, #f5493d);
    mask: var(--icon-lock) center/contain no-repeat;
  }

  .presence {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-3, #8a8a99);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .presence.online {
    color: var(--status-online, #2ee6a8);
  }

  .actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .menu-anchor {
    position: relative;
    display: flex;
  }

  .menu-button {
    flex: none;
    display: inline-flex;
  }

  .popover {
    position: absolute;
    top: calc(100% + 6px);
    inset-inline-end: 0;
    z-index: var(--z-modal, 60);
  }

  .gap {
    flex: none;
    width: var(--space-10, 10px);
  }

  .panel-toggle {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-md, 34px);
    height: var(--control-md, 34px);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
  }

  .panel-toggle.open,
  .panel-toggle:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .panel-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-2, #b9b9c6);
    mask: var(--icon-panel) center/contain no-repeat;
  }

  .open .panel-icon {
    background: var(--ink, #ececf1);
  }
</style>

<!-- Top of the chat list. dms: a plain "Chats" title. community: the community's avatar, name and lock + meta line (opens details).
     The ⋯ menu defaults to the standard actions for each kind; the community admin items only show with canEdit /
     canCreateChannel / canInvite (all off by default). "Create new group" calls onCreateGroup; other items without their own
     onSelect report their `id` (else their label) through onMenu. Actions are matched by id, never by label text. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import { onMount } from 'svelte';
  import type { MenuItem } from '../../lib/types';
  import Avatar from '../../lib/components/Avatar.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import Menu from '../../lib/components/Menu.svelte';

  const icon = (name: string) => `var(--icon-${name}) center/contain no-repeat`;

  // labels are resource keys; onMenu reports the id of the item picked
  type ActionItem = MenuItem & { id?: string };
  const DMS_MENU: ActionItem[] = [
    { id: 'createGroup', label: 'ui.chatListHeader.createGroup', mask: icon('group') },
    { id: 'markAllRead', label: 'ui.chatListHeader.markAllRead', mask: icon('check-double') },
  ];

  // need: which capability shows the item (none = everyone)
  const COMMUNITY_MENU: (ActionItem & { need?: 'invite' | 'edit' | 'channels' })[] = [
    { id: 'members', label: 'ui.chatListHeader.members', mask: icon('users') },
    { id: 'invite', label: 'ui.chatListHeader.invite', mask: icon('invite'), need: 'invite' },
    { id: 'editCommunity', label: 'ui.chatListHeader.editCommunity', mask: icon('edit'), need: 'edit' },
    { id: 'newChannel', label: 'ui.chatListHeader.newChannel', mask: icon('plus'), need: 'channels' },
    { id: 'addEmbeddedChannel', label: 'ui.chatListHeader.addEmbeddedChannel', mask: icon('embed'), need: 'channels' },
    { id: 'markAllRead', label: 'ui.chatListHeader.markAllRead', mask: icon('check-double') },
    { id: 'leave', label: 'ui.chatListHeader.leaveCommunity', mask: icon('exit'), variant: 'danger' },
  ];

  interface Props {
    kind?: 'dms' | 'community';
    /** Community name (or a resource key); the dms header reads "Chats" unless given. */
    title?: string;
    visibility?: 'Public' | 'Private';
    memberCount?: number;
    /** Overrides the "Public · 248 members" line. Resource key (or literal text). */
    meta?: string;
    color?: 'violet' | 'amber' | 'teal' | 'blue';
    /** Replaces the default menu; give items an `id` to be told which was picked. */
    menuItems?: ActionItem[];
    /** Community: show Edit community. */
    canEdit?: boolean;
    /** Community: show New channel / Add embedded channel. */
    canCreateChannel?: boolean;
    /** Community: show Invite. */
    canInvite?: boolean;
    openDetails?: () => void;
    onCreateGroup?: () => void;
    /** The picked item's id (or label when it has none). */
    onMenu?: (id: string) => void;
  }

  let {
    kind = 'dms',
    title,
    visibility = 'Public',
    memberCount = 0,
    meta,
    color = 'teal',
    menuItems,
    canEdit = false,
    canCreateChannel = false,
    canInvite = false,
    openDetails,
    onCreateGroup,
    onMenu,
  }: Props = $props();
  const t = useT();

  let open = $state(false);
  let menuBox: HTMLDivElement;

  const community = $derived(kind === 'community');
  const allowed = (need?: 'invite' | 'edit' | 'channels') => !need || (need === 'invite' ? canInvite : need === 'edit' ? canEdit : canCreateChannel);
  const items = $derived(
    (menuItems ?? (community ? COMMUNITY_MENU.filter((it) => allowed(it.need)) : DMS_MENU)).map((it) => ({
      ...it,
      onSelect: () => {
        open = false;
        if (it.onSelect) it.onSelect();
        // the host renders the dialog; mounting it here would trap its fixed layout inside the list column
        else if (it.id === 'createGroup') onCreateGroup?.();
        else onMenu?.(it.id ?? it.label);
      },
    })),
  );

  onMount(() => {
    const away = (e: MouseEvent) => {
      if (open && !menuBox.contains(e.target as Node)) open = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !open) return;
      e.preventDefault(); // keeps an enclosing dialog open
      open = false;
    };
    document.addEventListener('click', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', away, true);
      document.removeEventListener('keydown', esc);
    };
  });
</script>

<div class="header">
  {#if community}
    <div class="community" onclick={openDetails} role="button" tabindex="0">
      <div class="avatar"><Avatar size={38} shape="squircle" {color} online={false} /></div>
      <div class="names">
        <span class="name">{title}</span>
        <div class="meta-line">
          <span class="lock" class:private={visibility === 'Private'}></span>
          <span class="meta">{meta ? t(meta) : t('ui.chatListHeader.meta', { visibility, count: memberCount })}</span>
        </div>
      </div>
    </div>
  {:else}
    <span class="title">{t(title ?? 'ui.chatListHeader.chats')}</span>
  {/if}
  <div class="menu-anchor" bind:this={menuBox}>
    <div class="menu-button" onclick={() => (open = !open)} role="presentation">
      <IconButton variant="ghost" pressed={open} icon="more" />
    </div>
    {#if open}
      <div class="popover">
        <Menu {items} minWidth={community ? '246px' : '200px'} />
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
    padding: var(--space-10) 0 var(--space-10) var(--space-10);
    background: var(--surface-1, #0e0e12);
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
  }

  .community {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-6);
    margin: calc(var(--space-6) * -1);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .community:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .avatar {
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

  .name {
    font: var(--weight-bold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
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

  .meta {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-3, #8a8a99);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .menu-anchor {
    flex: none;
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
</style>

<!-- Side panel for a group, community or channel. Main view: cover, avatar, name and byline, role summary, live tiles
     (call / mute / @everyone), about, then member, bot and user-group previews and the access & rules rows.
     Sub-views (members with Lapsed / Blocked tabs and role menus, bots & webhooks, permissions, access gates, rules,
     user groups, pinned messages, stats) open in place; editing happens in host dialogs via onDialog.
     quick: the compact panel built around who's online now, your mute / @everyone / favourite pills and an invite card;
     it never drills in (sub-views go to onManage) except to read pinned messages.
     embedded: the same sub-views inside the host's manage dialog. The open sub-view persists under storageKey. -->
<script lang="ts" module>
  export type MemberRole = 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'OWNER';
</script>

<script lang="ts">
  import { Optimistic } from '../../lib/behaviours/optimistic.svelte';
  import { getI18n, useT, durationText } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';
  import { onDestroy, onMount, tick, untrack, type ComponentProps } from 'svelte';
  import type { GroupRole, GroupSettings, MenuItem } from '../../lib/types';
  import type { GateAsset } from './AccessGates.svelte';
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

  type MemberColor = ComponentProps<typeof MemberRow>['color'];
  type View = 'main' | 'usergroups' | 'usergroup' | 'members' | 'bots' | 'permissions' | 'gates' | 'rules' | 'stats' | 'pinned';
  type MuteKey = '8h' | '1w' | 'always';
  type Dialog = 'settings' | 'usergroup' | 'user' | 'bot' | 'webhook' | 'invite' | 'convert' | 'delete' | 'import' | 'newchannel' | 'embed' | 'leave';
  type Permissions = GroupSettings['permissions'];

  interface Person {
    title: string;
    handle: string;
    /** Passed back with member actions (onRoleChange, onRemoveMember …). */
    userId?: string;
    /** OWNER, ADMIN, MODERATOR, YOU (your own row), LAPSED, BLOCKED or empty. */
    tag?: string;
    color?: MemberColor;
    /** Presence from the host; nobody is shown online without it. */
    online?: boolean;
    /** "typing", "now", "2m", or last seen ("3h") for people who are offline. */
    activity?: string;
  }


  interface Bot {
    /** Stable id; bots and webhooks are matched, removed and reported by it. */
    id: string;
    variant?: 'bot' | 'webhook';
    title: string;
    subtitle?: string;
    color?: MemberColor;
    tag?: string;
    /** Webhooks: the endpoint. */
    url?: string;
    /** Avatar image URL. */
    image?: string;
  }

  interface UserGroup {
    key: string;
    title: string;
    /** Its real @handle; otherwise one is shown from the title. */
    mention?: string;
    color?: MemberColor;
    members: { userId?: string; name: string; handle: string; color?: MemberColor }[];
  }

  /** Builder-shaped, so the read view and the editor open from the same object. */
  interface GateState {
    rules: { id?: string; type: string; asset?: string; a?: string; b?: string }[];
    joiner?: string;
    intervalOn?: boolean;
    every?: string;
  }

  interface Pin {
    /** The pinned message; passed to onOpenPinned / onUnpin. */
    messageId: string;
    date: string;
    author: string;
    authorId?: string;
    color?: 'violet' | 'amber' | 'teal' | 'blue';
    text?: string;
    code?: string;
    time: string;
  }

  const GRADIENTS = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
  };
  const grad = (c?: string) => GRADIENTS[c as keyof typeof GRADIENTS] ?? GRADIENTS.violet;
  // cover choices are muted grounds, one per accent family, so the avatar stays the focus (tokens --cover-<key>)
  const COVER_KEYS = ['plum', 'teal', 'violet', 'amber', 'slate'];
  const mask = (name: string) => `var(--icon-${name}) center/contain no-repeat`;

  const PERM_ROLES: { key: GroupRole; label: string; tint: string }[] = [
    { key: 'member', label: 'ui.groupPanel.roleHeadings.member', tint: '#5FA8FF' },
    { key: 'moderator', label: 'ui.groupPanel.roleHeadings.moderator', tint: '#2EE6A8' },
    { key: 'admin', label: 'ui.groupPanel.roleHeadings.admin', tint: '#FFB03D' },
    { key: 'owner', label: 'ui.groupPanel.roleHeadings.owner', tint: '#FF5672' },
    { key: 'nobody', label: 'ui.groupPanel.roleHeadings.nobody', tint: '#6E6E7C' },
  ];
  const PERM_GENERAL: { key: string; short: string; def: GroupRole }[] = [
    { key: 'roles', short: 'ui.groupPanel.perms.roles', def: 'owner' },
    { key: 'edit', short: 'ui.groupPanel.perms.edit', def: 'admin' },
    { key: 'invite', short: 'ui.groupPanel.perms.invite', def: 'member' },
    { key: 'remove', short: 'ui.groupPanel.perms.remove', def: 'moderator' },
    { key: 'delete', short: 'ui.groupPanel.perms.delete', def: 'moderator' },
    { key: 'pin', short: 'ui.groupPanel.perms.pin', def: 'moderator' },
    { key: 'react', short: 'ui.groupPanel.perms.react', def: 'member' },
    { key: 'everyone', short: 'ui.groupPanel.perms.everyone', def: 'admin' },
    { key: 'calls', short: 'ui.groupPanel.perms.calls', def: 'member' },
  ];
  const PERM_CONTENT = [
    { key: 'text', label: 'ui.groupPanel.content.text' },
    { key: 'image', label: 'ui.groupPanel.content.image' },
    { key: 'video', label: 'ui.groupPanel.content.video' },
    { key: 'audio', label: 'ui.groupPanel.content.audio' },
    { key: 'file', label: 'ui.groupPanel.content.file' },
    { key: 'poll', label: 'ui.groupPanel.content.poll' },
    { key: 'crypto', label: 'ui.groupPanel.content.crypto' },
    { key: 'giphy', label: 'ui.groupPanel.content.giphy' },
    { key: 'prize', label: 'ui.groupPanel.content.prize' },
    { key: 'meme', label: 'ui.groupPanel.content.meme' },
    { key: 'p2p', label: 'ui.groupPanel.content.p2p' },
  ];
  const INHERIT = 'inherit';
  // the shape the create-group modal emits; used when the panel gets no permissions
  function defaultPermissions(): Permissions {
    const o: Permissions = { general: {}, messages: { default: 'member' }, threads: null };
    for (const p of PERM_GENERAL) o.general[p.key] = p.def;
    for (const c of PERM_CONTENT) o.messages[c.key] = INHERIT;
    return o;
  }

  const GATE_TYPES: Record<string, { label: string; icon: string; tint: string }> = {
    lifetime: { label: 'ui.groupPanel.gates.lifetime', icon: 'diamond', tint: '#7FC0FF' },
    diamond: { label: 'ui.groupPanel.gates.diamond', icon: 'diamond', tint: '#7FC0FF' },
    unique: { label: 'ui.groupPanel.gates.unique', icon: 'person', tint: '#5CE9BC' },
    credential: { label: 'ui.groupPanel.gates.credential', icon: 'credential', tint: '#5CE9BC' },
    balance: { label: 'ui.groupPanel.gates.balance', icon: 'balance', tint: '#FFB03D' },
    chit: { label: 'ui.groupPanel.gates.chit', icon: 'chit', tint: '#FFB03D' },
    payment: { label: 'ui.groupPanel.gates.payment', icon: 'payment', tint: '#FF8298' },
    neuron: { label: 'ui.groupPanel.gates.neuron', icon: 'neuron', tint: '#FF8298' },
    locked: { label: 'ui.groupPanel.gates.locked', icon: 'lock', tint: '#9A9AA8' },
  };

  // the builder stores an asset plus up to two numeric fields per rule; this turns that back into the
  // one-line value the read view shows ("min 100 CHAT", "10 USDT", neuron reads asset first)
  // rule assets are canister ids (as AccessGates stores them): tokens read as their symbol, nervous systems by name
  function assetLabel(r: GateState['rules'][number]) {
    if (!r.asset) return '';
    const list = r.type === 'neuron' ? gateSystems : gateTokens;
    const a = list.find((x) => x.id === r.asset);
    return a ? (r.type === 'neuron' ? a.name : a.symbol) : r.asset;
  }
  function gateValue(r: GateState['rules'][number]) {
    const asset = assetLabel(r);
    if (r.type === 'balance') return asset && r.a ? t('ui.groupPanel.gateValue.minAsset', { amount: r.a, asset }) : r.a ? t('ui.groupPanel.gateValue.min', { amount: r.a }) : asset;
    if (r.type === 'payment') return asset && r.a ? t('ui.groupPanel.gateValue.payment', { amount: r.a, asset }) : r.a || asset;
    if (r.type === 'chit') return r.a ? t('ui.groupPanel.gateValue.chit', { amount: r.a }) : '';
    if (r.type === 'neuron') return [asset, r.a && t('ui.groupPanel.gateValue.dissolveDelay', { days: r.a }), r.b && t('ui.groupPanel.gateValue.staked', { amount: r.b })].filter(Boolean).join(' · ');
    return asset;
  }

  const MUTE_SPANS: { key: MuteKey; label: string; tile: string }[] = [
    { key: '8h', label: 'ui.mute.for8h', tile: 'ui.mute.muted8h' },
    { key: '1w', label: 'ui.mute.for1w', tile: 'ui.mute.muted1w' },
    { key: 'always', label: 'ui.mute.untilOn', tile: 'ui.mute.muted' },
  ];

  type MenuEntry = MenuItem & { action?: string; view?: View };
  const MENU_ITEMS: MenuEntry[] = [
    { label: 'ui.groupPanel.menu.favourite', action: 'favourite', mask: mask('heart') },
    { label: 'ui.groupPanel.menu.settings', action: 'settings', mask: mask('gear') },
    { label: 'ui.groupPanel.menu.stats', view: 'stats', mask: mask('poll') },
    { variant: 'separator', label: '', action: 'sep-bots' },
    { label: 'ui.groupPanel.menu.addBot', action: 'addbot', mask: mask('bot') },
    { label: 'ui.groupPanel.menu.webhook', action: 'webhook', mask: mask('hook') },
    { variant: 'separator', label: '', action: 'sep-after-bots' },
    { label: 'ui.groupPanel.menu.convert', action: 'convert', mask: mask('community') },
    { label: 'ui.groupPanel.menu.import', action: 'import', mask: mask('import') },
    { label: 'ui.groupPanel.menu.leave', variant: 'danger', action: 'leave', mask: mask('leave') },
    { label: 'ui.groupPanel.menu.delete', variant: 'danger', action: 'delete', mask: mask('trash') },
  ];
  const SCOPE_MENU_EXTRA: MenuEntry[] = [
    { variant: 'separator', label: '', action: 'sep-channels' },
    { label: 'ui.groupPanel.menu.newChannel', action: 'newchannel', mask: mask('plus') },
    { label: 'ui.groupPanel.menu.embed', action: 'embed', mask: mask('embed') },
    { label: 'ui.groupPanel.menu.newUserGroup', action: 'newusergroup', mask: mask('invite') },
  ];
  const SUBVIEWS: Record<Exclude<View, 'main'>, string> & { botsOnly: string } = {
    usergroups: 'ui.groupPanel.views.usergroups',
    usergroup: 'ui.groupPanel.views.usergroup',
    members: 'ui.groupPanel.views.members',
    bots: 'ui.groupPanel.views.bots',
    botsOnly: 'ui.groupPanel.views.botsOnly',
    permissions: 'ui.groupPanel.views.permissions',
    gates: 'ui.groupPanel.views.gates',
    rules: 'ui.groupPanel.views.rules',
    stats: 'ui.groupPanel.views.stats',
    pinned: 'ui.groupPanel.views.pinned',
  };
  const isView = (v: string): v is View => v === 'main' || (v in SUBVIEWS && v !== 'botsOnly');

  const MEMBER_TABS = ['ui.groupPanel.memberTabs.members', 'ui.groupPanel.memberTabs.lapsed', 'ui.groupPanel.memberTabs.blocked'];
  const MEMBER_SEARCH = ['ui.groupPanel.memberSearch.members', 'ui.groupPanel.memberSearch.lapsed', 'ui.groupPanel.memberSearch.blocked'];
  const MEMBER_LIST_TITLES = ['ui.groupPanel.memberLists.current', 'ui.groupPanel.memberLists.lapsed', 'ui.groupPanel.memberLists.blocked'];
  const MEMBER_NOTES = ['', 'ui.groupPanel.memberNotes.lapsed', 'ui.groupPanel.memberNotes.blocked'];
  // role ladder: member → moderator → admin → owner
  const LADDER = ['', 'MODERATOR', 'ADMIN', 'OWNER'];
  const ROLE_NAMES: Record<string, string> = { '': 'ui.groupPanel.roleNames.member', MODERATOR: 'ui.groupPanel.roleNames.moderator', ADMIN: 'ui.groupPanel.roleNames.admin', OWNER: 'ui.groupPanel.roleNames.owner' };

  interface Props {
    scope?: 'group' | 'community' | 'channel';
    title: string;
    /** Owner's handle in the byline. */
    ownerHandle: string;
    /** Undefined or empty reads "No description yet". */
    about?: string;
    color?: keyof typeof GRADIENTS;
    /** Cover swatch key (plum, teal, violet, amber, slate); an uploaded coverUrl wins. */
    coverKey?: string;
    coverUrl?: string;
    /** CSS background when neither coverKey nor coverUrl is set. */
    cover?: string;
    avatar?: string;
    isPublic?: boolean;
    /** Settings the host knows; anything left out is left out of the settings dialog's starting values too. */
    visibleHistory?: boolean;
    disappearOn?: boolean;
    disappearAfter?: string;
    /** Channels: the community it belongs to. */
    communityName?: string;
    communityColor?: keyof typeof GRADIENTS;
    onOpenCommunity?: (view?: 'members') => void;
    /** Defaults to members.length. */
    memberTotal?: number;
    members?: Person[];
    lapsed?: Person[];
    blocked?: Person[];
    membersLoading?: boolean;
    /** Quick panel: how many are online (defaults to the members marked online). */
    onlineCount?: number;
    viewerRole?: string;
    canModerate?: boolean;
    canChangeRoles?: boolean;
    canInvite?: boolean;
    bots?: Bot[];
    /** Bots added this session (one row per title). */
    extraBots?: Bot[];
    /** Ids of bots removed this session. */
    removedBots?: string[];
    webhooks?: Bot[];
    extraWebhooks?: Bot[];
    /** Webhook endpoint by webhook id. */
    webhookUrls?: Record<string, string>;
    /** Offered in the bots view when not installed. */
    recommendedBots?: Bot[];
    canManageBots?: boolean;
    /** Settings, permissions / gates / rules editing, convert, import, new channel. */
    canEdit?: boolean;
    /** The Delete entry. */
    canDelete?: boolean;
    /** Create, edit and delete user groups (communities). */
    canManageUserGroups?: boolean;
    /** Unpin pinned messages. */
    canPin?: boolean;
    /** Owner and admin counts for the summary line (otherwise counted from `members`). */
    ownerCount?: number;
    adminCount?: number;
    /** Manage dialog: show only bots or only webhooks. */
    botsPart?: '' | 'bots' | 'webhooks';
    userGroups?: UserGroup[];
    permissions?: Permissions;
    gateState?: GateState | null;
    /** Tokens (ledger canister ids) and nervous systems (governance canister ids), to name the assets in gate rules. */
    gateTokens?: GateAsset[];
    gateSystems?: GateAsset[];
    /** Overrides the number of gates in the nav row. */
    gateCount?: number;
    rules?: { enabled: boolean; text: string };
    pinned?: Pin[];
    /** Narrow windows open the pinned list on its own: close only. */
    pinnedOnly?: boolean;
    /** Shown in the stats view. */
    stats?: ComponentProps<typeof GroupStats> | null;
    isFavourite?: boolean;
    /** Host-controlled mute; omitted = kept here. */
    mutedUntil?: MuteKey | null;
    muteEveryone?: boolean;
    quick?: boolean;
    embedded?: boolean;
    /** Quick panel cover icon: manage (managers) or info. */
    manageIcon?: 'manage' | 'info';
    /** Replaces the ⋯ menu. */
    menuOverride?: MenuItem[];
    coverHandlers?: ComponentProps<typeof PanelCover>['handlers'];
    tileHandlers?: Record<string, (e?: Event) => void>;
    /** A view to open ("members", "settings", …); anything after "#" is ignored. Re-send to re-open. */
    viewRequest?: string | null;
    /** localStorage key for the open view; "" opts out. */
    storageKey?: string;
    onDialog?: (kind: Dialog, payload?: unknown, tab?: string) => void;
    onManage?: (view: View) => void;
    onViewChange?: (view: View) => void;
    onToggleFavourite?: () => void;
    /** Reject to roll the mute back (when the host doesn't control mutedUntil / muteEveryone). */
    onMuteChange?: (key: MuteKey | null) => Promise<unknown> | void;
    onMuteEveryoneChange?: (on: boolean) => Promise<unknown> | void;
    onClose?: () => void;
    /** Member actions; each item is only offered when its callback is given. The list updates at once and rolls
     *  back with an error if the promise rejects. `member` is your own row when stepping down. */
    onRoleChange?: (member: Person, role: MemberRole) => Promise<unknown> | void;
    /** The owner's handle in the byline opens their profile. */
    onOpenOwner?: () => void;
    /** Jump to a pinned message in the chat. */
    onOpenPinned?: (messageId: string) => void;
    /** Unpin a message (needs canPin). Rolls back with an error on rejection. */
    onUnpin?: (messageId: string) => Promise<unknown> | void;
    /** Members search as the user types (server-side); the shown list is still filtered locally. */
    onSearchMembers?: (query: string) => void;
    onRemoveMember?: (member: Person) => Promise<unknown> | void;
    onUnblock?: (member: Person) => Promise<unknown> | void;
    onRemoveBlocked?: (member: Person) => Promise<unknown> | void;
  }

  let {
    scope = 'group',
    title,
    ownerHandle,
    about,
    color = 'teal',
    coverKey,
    coverUrl,
    cover,
    avatar = '',
    isPublic = false,
    visibleHistory,
    disappearOn,
    disappearAfter,
    communityName,
    communityColor = 'amber',
    onOpenCommunity,
    memberTotal,
    members = [],
    lapsed = [],
    blocked = [],
    membersLoading = false,
    onlineCount,
    viewerRole = 'Member',
    canModerate = false,
    canChangeRoles = false,
    canInvite = false,
    bots = [],
    extraBots = [],
    removedBots = [],
    webhooks = [],
    extraWebhooks = [],
    webhookUrls,
    recommendedBots = [],
    canManageBots = false,
    canEdit = false,
    canDelete = false,
    canManageUserGroups = false,
    canPin = false,
    ownerCount,
    adminCount,
    botsPart = '',
    userGroups = [],
    permissions,
    gateState = null,
    gateTokens = [],
    gateSystems = [],
    gateCount,
    rules = { enabled: false, text: '' },
    pinned = [],
    pinnedOnly = false,
    stats = null,
    isFavourite,
    mutedUntil,
    muteEveryone,
    quick = false,
    embedded = false,
    manageIcon = 'manage',
    menuOverride,
    coverHandlers = {},
    tileHandlers = {},
    viewRequest = null,
    storageKey = 'oc.groupPanel.view',
    onDialog,
    onManage,
    onViewChange,
    onToggleFavourite,
    onMuteChange,
    onMuteEveryoneChange,
    onRoleChange,
    onOpenOwner,
    onOpenPinned,
    onUnpin,
    onSearchMembers,
    onRemoveMember,
    onUnblock,
    onRemoveBlocked,
    onClose,
  }: Props = $props();
  const t = useT();
  const i18n = getI18n();
  const num = (n: number | undefined) => n?.toLocaleString(i18n.locale ?? 'en');

  // per-instance key so a second mount (library specimen, community panel) cannot overwrite the running app's view
  function readStored(key: string): View {
    if (!key) return 'main';
    try {
      const v = localStorage.getItem(key);
      return v && isView(v) ? v : 'main';
    } catch {
      return 'main';
    }
  }

  let storedView = $state<View>(untrack(() => readStored(storageKey)));
  let menuOpen = $state(false);
  // one popover at a time: a row menu ("m:<handle>"), owner confirmation ("owner:…"), sole-owner notice ("sole:…") or user-group menu (key)
  let popover = $state<string | null>(null);
  let muteMenu = $state<{ top: number; left: number } | null>(null);
  let memberTab = $state(0);
  let ugKey = $state<string | null>(null);
  let ugQuery = $state('');
  let ugMemberQuery = $state('');
  let botQuery = $state('');
  let memberQuery = $state('');

  // optimistic, one value per thing (lib/behaviours/optimistic.svelte.ts): a member's role, whether a member / blocked
  // person / pin is gone, the mutes. Shown at once; the latest call for a thing decides; a rejected latest call falls
  // back to the value the host last accepted; new host data is followed again once nothing is in flight.
  const optimistic = $state<Record<string, Optimistic<unknown>>>({});
  let lastAction = $state<string | null>(null);
  const actionError = $derived(lastAction && optimistic[lastAction]?.failed ? t('ui.groupPanel.actionFailed') : '');
  function act<T>(key: string, host: () => T, value: T, call: () => Promise<unknown> | void) {
    popover = null;
    lastAction = key;
    const state = (optimistic[key] ??= new Optimistic(host) as unknown as Optimistic<unknown>) as unknown as Optimistic<T>;
    state.set(value, () => call());
  }
  // read through .current when there is one: an optimistic null (unmute) or false is a real value, not "absent"
  const gone = (key: string) => (optimistic[key] ? (optimistic[key].current as boolean) : false);
  const hostSelfRole = () => viewerRole.toUpperCase().replace('MEMBER', '');
  const selfRoleNow = $derived(optimistic['role:\u0000you']?.current as string | undefined);
  // member / pin overlays give way to new host data (the mutes follow their own props below)
  $effect.pre(() => {
    void members;
    void lapsed;
    void blocked;
    void pinned;
    void viewerRole;
    untrack(() => {
      for (const [key, state] of Object.entries(optimistic)) if (key !== 'mute' && key !== 'muteAll') state.sync();
    });
  });
  let aboutOpen = $state(false);
  let aboutLong = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(copyTimer));

  let root: HTMLDivElement;
  let aboutEl = $state<HTMLParagraphElement>();

  const view = $derived<View>(quick && storedView !== 'pinned' ? 'main' : storedView);
  const perms = $derived(permissions ?? defaultPermissions());
  const hostMute = () => mutedUntil ?? null;
  const hostMuteAll = () => muteEveryone ?? false;
  const muted = $derived(optimistic.mute ? (optimistic.mute.current as MuteKey | null) : hostMute());
  const muteAll = $derived(optimistic.muteAll ? (optimistic.muteAll.current as boolean) : hostMuteAll());
  $effect.pre(() => {
    void mutedUntil;
    untrack(() => optimistic.mute?.sync());
  });
  $effect.pre(() => {
    void muteEveryone;
    untrack(() => optimistic.muteAll?.sync());
  });
  const total = $derived(memberTotal ?? members.length);
  const aboutText = $derived(about ?? '');

  function go(next: View) {
    // the quick panel never drills in; deeper views live in the host's manage dialog.
    // pinned is reading, not managing, so it opens inside the quick panel
    if (quick && next !== 'main' && next !== 'pinned') {
      menuOpen = false;
      onManage?.(next);
      return;
    }
    storedView = next;
    menuOpen = false;
    onViewChange?.(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // storage blocked (private mode): the view just isn't remembered
      }
    }
  }

  // only what the host actually told us: a missing setting stays missing rather than becoming a guess the dialog would save
  const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
  const settingsPayload = () => ({
    info: defined({ name: title, about: aboutText, color, coverKey, coverUrl, avatar }),
    settings: defined({ isPublic, history: visibleHistory, disappearOn, after: disappearAfter }),
    gates: gateState,
    rules,
    permissions: perms,
  });

  function request(req: string | null) {
    if (!req) return;
    const target = req.split('#')[0];
    if (isView(target)) go(target);
    else if (target === 'settings') onDialog?.('settings', settingsPayload(), 'group');
  }

  // a request can arrive with the mount (e.g. switching from channel to community details) or later
  let lastRequest: string | null = null;
  $effect(() => {
    const req = viewRequest;
    untrack(() => {
      if (req && req !== lastRequest) request(req);
      lastRequest = req;
    });
  });

  // a new description starts collapsed
  let lastAbout = untrack(() => about);
  $effect(() => {
    const a = about;
    untrack(() => {
      if (a !== lastAbout) aboutOpen = false;
      lastAbout = a;
    });
  });

  // offer More only when the text is actually clamped
  $effect(() => {
    void aboutText;
    void view;
    const el = aboutEl;
    if (!el || untrack(() => aboutOpen)) return;
    tick().then(() => (aboutLong = el.scrollHeight - el.clientHeight > 2));
  });

  onMount(() => {
    // in-panel backdrops only cover this panel; presses elsewhere on the page close menus here
    const away = (e: PointerEvent) => {
      if (root.contains(e.target as Node)) return;
      if (menuOpen || muteMenu || popover) {
        menuOpen = false;
        muteMenu = null;
        popover = null;
      }
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  });

  const placeUnder = (el: Element | null) => {
    const panel = el?.closest('[data-panel-root]');
    if (!el || !panel) return { top: 212, left: 16 };
    const r = el.getBoundingClientRect(), b = panel.getBoundingClientRect();
    return { top: r.bottom - b.top + 6, left: Math.max(16, Math.min(r.left - b.left, b.width - 232)) };
  };

  function setMute(key: MuteKey | null) {
    muteMenu = null;
    // a repeat of the change still in flight: nothing new to send (picking the active span when idle restarts it)
    if (optimistic.mute?.pending && key === muted) return;
    act<MuteKey | null>('mute', hostMute, key, () => onMuteChange?.(key));
  }

  function toggleMuteAll() {
    const next = !muteAll;
    act('muteAll', hostMuteAll, next, () => onMuteEveryoneChange?.(next));
  }

  function unpin(messageId: string) {
    if (!onUnpin) return;
    act(`unpinned:${messageId}`, () => false, true, () => onUnpin(messageId));
  }

  const openUser = (m: Person) => () => onDialog?.('user', { userId: m.userId, title: m.title, handle: m.handle, color: m.color, isSelf: m.tag === 'YOU' });
  const openBot = (b: Bot, installed: boolean) => () => onDialog?.('bot', { id: b.id, name: b.title, description: b.subtitle, color: b.color, installed });
  const openHook = (h: Bot) => () => onDialog?.('webhook', { dialogMode: 'edit', id: h.id, name: h.title, color: h.color, url: webhookUrls?.[h.id] ?? h.url, avatarUrl: h.image });

  // ── bots & webhooks (matched by id, so two with the same name never collide) ──
  const installedBots = $derived(bots.concat(extraBots.filter((e) => !bots.some((b) => b.id === e.id))).filter((b) => !removedBots.includes(b.id)));
  const hooks = $derived(webhooks.concat(extraWebhooks.filter((e) => !webhooks.some((h) => h.id === e.id))));
  // people who can't manage bots only see what's installed: no webhooks, no recommendations
  const allowHooks = $derived(scope !== 'community' && canManageBots && botsPart !== 'bots');
  const showBotLists = $derived(botsPart !== 'webhooks');
  const allBots = $derived(allowHooks ? installedBots.concat(hooks) : installedBots);
  const botNeedle = $derived(botQuery.trim().toLowerCase());
  const botMatches = (x: Bot) => !botNeedle || `${x.title} ${x.subtitle || ''}`.toLowerCase().includes(botNeedle);
  const shownBots = $derived(installedBots.filter(botMatches));
  const shownHooks = $derived(allowHooks ? hooks.filter(botMatches) : []);
  const shownRecommended = $derived(recommendedBots.filter((r) => !installedBots.some((b) => b.id === r.id)).filter(botMatches));

  // ── members ──
  const youFirst = (list: Person[]) => {
    const i = list.findIndex((m) => m.tag === 'YOU');
    return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
  };
  const withRole = (list: Person[]) =>
    list
      .filter((m) => !gone(`removed:${m.handle}`))
      .map((m) => {
        const role = optimistic[`role:${m.handle}`]?.current as string | undefined;
        return role !== undefined ? { ...m, tag: role } : m;
      });
  const visibleBlocked = $derived(blocked.filter((m) => !gone(`unblocked:${m.handle}`) && !gone(`removedBlocked:${m.handle}`)));
  const memberNeedle = $derived(memberQuery.trim().toLowerCase());
  const matchesQuery = (list: Person[]) => (memberNeedle ? list.filter((m) => `${m.title} ${m.handle}`.toLowerCase().includes(memberNeedle)) : list);
  const memberSets = $derived([youFirst(matchesQuery(withRole(members))), youFirst(matchesQuery(withRole(lapsed))), youFirst(matchesQuery(visibleBlocked))]);
  const tabIdx = $derived(canModerate ? memberTab : 0);
  const viewerIsOwner = $derived(viewerRole.toUpperCase() === 'OWNER');

  const memberRows = $derived.by(() => {
    const all = memberSets[tabIdx];
    const blockedTab = tabIdx === 2;
    const otherOwners = memberSets[0].filter((x) => x.tag === 'OWNER').length;
    return all.map((m) => {
      const self = m.tag === 'YOU';
      const rank = LADDER.indexOf(m.tag === 'LAPSED' ? '' : m.tag || '');
      // members can't act on anyone; moderators can remove regular members; owners are only managed by owners,
      // and your own row only offers stepping down once someone else is an owner
      const canAct = blockedTab ? canModerate : self ? viewerIsOwner : rank === 3 ? viewerIsOwner : canModerate && rank >= 0 && (canChangeRoles || rank === 0);
      const current = self ? (selfRoleNow ?? hostSelfRole()) : (LADDER[rank] ?? '');
      const soleOwner = self && current === 'OWNER' && otherOwners === 0;
      const setRole = (r: string) => {
        if (!onRoleChange) return;
        // the host's own value for this row, read fresh each time (it may have changed since)
        const host = self ? hostSelfRole : () => [...members, ...lapsed].find((x) => x.handle === m.handle)?.tag ?? '';
        act(self ? 'role:\u0000you' : `role:${m.handle}`, host, r, () => onRoleChange(m, (r || 'MEMBER') as MemberRole));
      };
      const roleItems: MenuItem[] =
        blockedTab || !canChangeRoles || !onRoleChange
          ? []
          : [
              ...LADDER.slice()
                .reverse()
                .filter((r) => r !== 'OWNER' || viewerIsOwner)
                .map((r) => ({
                  label: t(ROLE_NAMES[r]),
                  checkMask: r === current ? mask('check') : '',
                  onSelect: () => {
                    if (r === current) popover = null;
                    else if (r === 'OWNER') popover = `owner:${m.handle}`;
                    else setRole(r);
                  },
                })),
              { variant: 'separator' as const, label: '' },
            ];
      const items: MenuItem[] = self
        ? roleItems.filter((it) => it.variant !== 'separator')
        : !blockedTab
          ? [
              ...roleItems,
              ...(onRemoveMember
                ? [
                    {
                      label: t('ui.groupPanel.removeMember'),
                      mask: mask('user-minus'),
                      variant: 'danger' as const,
                      onSelect: () =>
                        act(`removed:${m.handle}`, () => false, true, () => onRemoveMember(m)),
                    },
                  ]
                : []),
            ]
          : [
              ...(onUnblock
                ? [
                    {
                      label: t('ui.groupPanel.unblock'),
                      mask: mask('circle-check'),
                      onSelect: () =>
                        act(`unblocked:${m.handle}`, () => false, true, () => onUnblock(m)),
                    },
                  ]
                : []),
              ...(onRemoveBlocked
                ? [
                    {
                      label: t('ui.common.remove'),
                      mask: mask('user-minus'),
                      variant: 'danger' as const,
                      onSelect: () =>
                        act(`removedBlocked:${m.handle}`, () => false, true, () => onRemoveBlocked(m)),
                    },
                  ]
                : []),
            ];
      // a menu with nothing in it (no callbacks) isn't offered
      const hasMenu = canAct && items.some((it) => it.variant !== 'separator');
      const selfTag = self ? ({ OWNER: 'OWNER', ADMIN: 'ADMIN', MODERATOR: 'MODERATOR' } as Record<string, string>)[selfRoleNow ?? viewerRole.toUpperCase()] || '' : undefined;
      return {
        ...m,
        tag: self ? selfTag : m.tag,
        isYou: self,
        online: tabIdx === 0 && (self || !!m.online),
        activity: tabIdx === 0 && !self ? (m.activity ?? '') : '',
        hasMenu,
        menuKey: soleOwner ? `sole:${m.handle}` : `m:${m.handle}`,
        heading: blockedTab || !canChangeRoles ? '' : t(self ? 'ui.groupPanel.yourRole' : 'ui.groupPanel.role'),
        items,
        confirmOwner: () => setRole('OWNER'),
      };
    });
  });

  // ── quick panel ──
  const quickOnline = $derived.by(() => {
    if (!quick) return { rows: [] as (Person & { online: boolean; activity: string })[], count: 0 };
    const others = members.filter((m) => m.tag !== 'YOU');
    const totalN = Number(memberTotal ?? others.length) || others.length;
    // presence comes from the host: the people marked online, or (when nobody is) the ones with a last-seen time
    const onlineRows = others.filter((m) => m.online);
    const count = onlineCount ?? onlineRows.length;
    const shown = onlineRows.slice(0, 24);
    const list = shown.length ? shown : others.filter((m) => m.activity).slice(0, 3);
    return {
      rows: list.map((m) => ({ ...m, online: !!m.online, activity: m.activity ?? '' })),
      count,
      shown: shown.length,
      total: totalN,
    };
  });
  const slimBots = $derived(allBots.filter((b) => b.variant !== 'webhook').slice(0, 3));

  // ── main view bits ──
  const coverCss = $derived(
    coverUrl ? `url(${JSON.stringify(coverUrl)}) center/cover no-repeat` : coverKey ? `var(--cover-${COVER_KEYS.includes(coverKey) ? coverKey : 'plum'})` : cover || 'var(--cover-plum)',
  );
  // role split reads at a glance; the raw total lives in "View all"
  const roleSummary = $derived.by(() => {
    const owners = ownerCount ?? members.filter((m) => m.tag === 'OWNER').length;
    const admins = adminCount ?? members.filter((m) => m.tag === 'ADMIN').length;
    return t('ui.groupPanel.roleSummary', { owners, admins, members: Math.max(total - owners - admins, 0) });
  });
  const muteSpan = $derived(MUTE_SPANS.find((o) => o.key === muted));
  const tiles = $derived([
    ...(scope === 'community' ? [] : (['video'] as const)),
    { icon: 'mute' as const, label: t(scope === 'community' && !muted ? 'ui.groupPanel.muteAllChannels' : muted ? (muteSpan?.tile ?? 'ui.mute.muted') : 'ui.mute.mute'), on: !!muted },
    { icon: 'everyone' as const, label: t(muteAll ? 'ui.groupPanel.everyoneMuted' : 'ui.groupPanel.muteEveryone'), on: muteAll },
  ]);
  const tileHandlersAll = $derived({
    ...tileHandlers,
    // muting is reversible, so no confirmation — but it asks for how long,
    // which makes an accidental tap cost hours rather than forever
    mute: (e?: Event) => {
      if (!muted) muteMenu = placeUnder((e?.currentTarget as Element | null) ?? null);
      else setMute(null);
    },
    everyone: toggleMuteAll,
  });
  const muteOptions = $derived<{ label: string; key: MuteKey | null; separator?: boolean }[]>(
    muted && quick ? [{ label: 'ui.mute.unmute', key: null }] : MUTE_SPANS.map((o) => ({ label: o.label, key: o.key })),
  );

  // ── permissions, gates, rules ──
  const effective = (key: string) => (perms.messages[key] === INHERIT ? perms.messages.default : perms.messages[key]);
  const roleDigest = $derived(
    PERM_ROLES.filter((r) => r.key !== 'nobody').map((r, ri) => {
      // each role lists what IT adds; the trailing chip carries the inheritance
      const own = [...PERM_GENERAL.filter((p) => perms.general[p.key] === r.key).map((p) => p.short), ...PERM_CONTENT.filter((c) => effective(c.key) === r.key).map((c) => c.label)];
      return { label: r.label, tint: r.tint, caps: own, none: own.length === 0 && ri === 0, inherits: ri > 0 ? t('ui.groupPanel.inherits', { role: PERM_ROLES[ri - 1].key }) : '' };
    }),
  );
  // anything set to Nobody belongs to no role, so it gets its own line
  const disabledPerms = $derived([
    ...PERM_GENERAL.filter((p) => perms.general[p.key] === 'nobody').map((p) => p.short),
    ...PERM_CONTENT.filter((c) => effective(c.key) === 'nobody').map((c) => c.label),
  ]);
  const threadExceptions = $derived(perms.threads ? PERM_CONTENT.filter((c) => perms.threads![c.key] !== INHERIT).length : 0);
  const threadLine = $derived(
    perms.threads
      ? threadExceptions
        ? t('ui.groupPanel.threadExceptions', { count: threadExceptions })
        : t('ui.groupPanel.threadsOwnSet')
      : t('ui.groupPanel.threadsFollow'),
  );
  // the most-asked question first ("can members invite?"), then how far the set has been tuned
  const permHint = $derived.by(() => {
    const changed =
      PERM_GENERAL.filter((x) => perms.general[x.key] !== x.def).length +
      PERM_CONTENT.filter((c) => perms.messages[c.key] !== INHERIT).length +
      (perms.messages.default !== 'member' ? 1 : 0) +
      (perms.threads ? 1 : 0);
    const invite = perms.general.invite;
    const who = t('ui.groupPanel.canInvite', { role: PERM_ROLES.some((r) => r.key === invite) ? invite : 'admin' });
    return t('ui.groupPanel.permHint', { who, changed });
  });
  const gateCards = $derived(
    (gateState?.rules ?? []).map((r) => {
      const g = GATE_TYPES[r.type] || GATE_TYPES.locked;
      return { label: g.label, detail: gateValue(r), icon: g.icon, tint: g.tint };
    }),
  );
  // rules arrive as free text; the sub-view splits it into numbered lines
  const ruleLines = $derived(
    rules.enabled
      ? rules.text
          .split('\n')
          .map((l) => l.replace(/^[•\-\s]+/, '').trim())
          .filter(Boolean)
      : [],
  );
  const gatesN = $derived(gateCount ?? gateCards.length);
  // re-checking is only claimed when the host gives an interval
  const every = $derived(gateState?.every ? durationText(t, gateState.every) : '');
  const rechecks = $derived(gateState?.intervalOn !== false && !!every);
  const navRows = $derived([
    { label: t('ui.groupPanel.views.permissions'), hint: permHint, view: 'permissions' as const },
    {
      label: t('ui.groupPanel.views.gates'),
      hint:
        scope === 'channel' && !gatesN
          ? t('ui.groupPanel.gatesHintChannel')
          : gatesN
            ? t('ui.groupPanel.gatesHint', { count: gatesN, recheck: rechecks ? t('ui.groupPanel.recheckedEvery', { every }) : t('ui.groupPanel.checkedOnce') })
            : t('ui.groupPanel.noGatesHint'),
      view: 'gates' as const,
    },
    { label: t('ui.groupPanel.views.rules', { scope }), hint: ruleLines.length ? t('ui.groupPanel.rulesHint', { count: ruleLines.length }) : t('ui.groupPanel.noRulesHint'), view: 'rules' as const },
  ]);

  // ── user groups ──
  const ugCur = $derived(userGroups.find((g) => g.key === ugKey) ?? null);
  const ugShown = $derived(userGroups.filter((g) => !ugQuery.trim() || g.title.toLowerCase().includes(ugQuery.trim().toLowerCase())));
  const ugSubtitle = (g: UserGroup) => t('ui.groupPanel.memberCount', { count: g.members.length });
  const ugMembersShown = $derived(
    ugCur ? ugCur.members.filter((m) => !ugMemberQuery.trim() || `${m.name} ${m.handle}`.toLowerCase().includes(ugMemberQuery.trim().toLowerCase())) : [],
  );
  function openUserGroup(g: UserGroup) {
    ugKey = g.key;
    ugMemberQuery = '';
    popover = null;
    go('usergroup');
  }
  const ugDialog = (dialogMode: 'create' | 'edit' | 'delete', key: string | null) => onDialog?.('usergroup', { dialogMode, key });
  const ugMention = (g: UserGroup) => g.mention ?? '@' + g.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  // ── pinned ──
  const pinnedDays = $derived.by(() => {
    const days: { date: string; items: (Pin & { messages: { text: string; code: string; time: string }[] })[] }[] = [];
    for (const p of pinned.filter((x) => !gone(`unpinned:${x.messageId}`))) {
      let d = days.find((x) => x.date === p.date);
      if (!d) days.push((d = { date: p.date, items: [] }));
      d.items.push({ ...p, messages: [{ text: p.text || '', code: p.code || '', time: p.time }] });
    }
    return days;
  });

  // ── sub-view header ──
  const subviewTitle = $derived(
    view === 'main'
      ? ''
      : view === 'bots' && botsPart === 'webhooks'
        ? t('ui.groupPanel.views.webhooks')
        : view === 'usergroup' && ugCur
          ? ugCur.title
          : view === 'members' && scope !== 'group'
            ? t('ui.groupPanel.views.scopeMembers', { scope })
            : t(view === 'bots' && !allowHooks ? SUBVIEWS.botsOnly : SUBVIEWS[view], { scope }),
  );
  const subviewSub = $derived(view === 'usergroup' && ugCur ? t('ui.groupPanel.userGroupIn', { name: title }) : view === 'members' && scope === 'channel' ? t('ui.groupPanel.channelIn', { channel: title, community: communityName ?? t('ui.groupPanel.theCommunity') }) : '');
  const userGroupsView = $derived(view === 'usergroups' || (view === 'usergroup' && !ugCur));

  // ── ⋯ menu ──
  const menuItems = $derived.by(() => {
    if (menuOverride) return menuOverride.map((it) => (it.onSelect ? { ...it, onSelect: () => ((menuOpen = false), it.onSelect?.()) } : it));
    const close = (fn?: () => void) => () => {
      menuOpen = false;
      fn?.();
    };
    // manager-only entries need the matching capability
    const allowed = (a?: string) =>
      a === 'settings' || a === 'convert' || a === 'import' || a === 'newchannel' || a === 'embed'
        ? canEdit
        : a === 'addbot' || a === 'webhook'
          ? canManageBots
          : a === 'delete'
            ? canDelete
            : a === 'newusergroup'
              ? canManageUserGroups
              : true;
    const entries = MENU_ITEMS.filter((it) => scope === 'group' || !['convert', 'import', 'sep-after-bots'].includes(it.action ?? ''))
      .filter((it) => scope !== 'community' || !['favourite', 'webhook'].includes(it.action ?? ''))
      .flatMap((it) => (scope === 'community' && it.view === 'stats' ? [it, ...SCOPE_MENU_EXTRA] : [it]))
      .filter((it) => it.variant === 'separator' || allowed(it.action));
    // drop separators left leading, trailing or doubled by the filtering
    const tidy: MenuEntry[] = [];
    for (const it of entries) {
      const sep = it.variant === 'separator';
      if (sep && (!tidy.length || tidy[tidy.length - 1].variant === 'separator')) continue;
      tidy.push(it);
    }
    if (tidy.length && tidy[tidy.length - 1].variant === 'separator') tidy.pop();
    return tidy.map((it): MenuItem => {
        const label = it.action === 'favourite' ? t(isFavourite ? 'ui.groupPanel.menu.removeFavourite' : 'ui.groupPanel.menu.addFavourite') : t(it.label, { scope });
        const a = it.action;
        const onSelect = it.view
          ? () => go(it.view!)
          : a === 'settings'
            ? close(() => onDialog?.('settings', settingsPayload(), 'group'))
            : a === 'favourite'
              ? close(onToggleFavourite)
              : a === 'addbot'
                ? close(() => go('bots'))
                : a === 'webhook'
                  ? close(() => onDialog?.('webhook', { dialogMode: 'register' }))
                  : a === 'newusergroup'
                    ? close(() => onDialog?.('usergroup', { dialogMode: 'create', key: null }))
                    : a === 'convert' || a === 'delete' || a === 'import' || a === 'newchannel' || a === 'embed' || a === 'leave'
                      ? close(() => onDialog?.(a))
                      : close();
        return { label, variant: it.variant, mask: it.mask, onSelect };
      });
  });


  const coverHandlersAll = $derived({
    ...coverHandlers,
    more: () => (menuOpen = !menuOpen),
    manage: () => onManage?.('main'),
    info: () => onManage?.('main'),
    invite: () => onDialog?.('invite', null, 'people'),
    share: () => onDialog?.('invite', null, 'share'),
  });

  function link(fn: () => void) {
    return (e: MouseEvent) => {
      e.preventDefault();
      fn();
    };
  }
</script>

{#snippet sectionHead(label: string, count: number, onView: () => void)}
  <div class="section-head">
    <span class="section-label">{label}</span>
    <a class="view-all" href="#top" onclick={link(onView)}>{t('ui.groupPanel.viewAll', { count })}</a>
  </div>
{/snippet}

{#snippet confirm(heading: string, body: string, action: string, onAction: (() => void) | null)}
  <div class="scrim" onclick={() => (popover = null)} role="presentation"></div>
  <div class="ask">
    <div class="ask-text">
      <span class="ask-title">{heading}</span>
      <span class="ask-body">{body}</span>
    </div>
    <div class="ask-actions">
      {#if onAction}
        <span class="ask-cancel" onclick={() => (popover = null)} role="button" tabindex="0">{t('ui.common.cancel')}</span>
        <span class="ask-confirm" onclick={onAction} role="button" tabindex="0">{action}</span>
      {:else}
        <span class="ask-ok" onclick={() => (popover = null)} role="button" tabindex="0">{action}</span>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet owner()}{#if onOpenOwner}<a href="#top" onclick={link(onOpenOwner)}>{ownerHandle}</a>{:else}<span class="owner">{ownerHandle}</span>{/if}{/snippet}

{#snippet rowMenu(heading: string, items: MenuItem[], minWidth: string)}
  <div class="scrim" onclick={() => (popover = null)} role="presentation"></div>
  <div class="row-menu"><Menu {minWidth} {heading} {items} /></div>
{/snippet}

<div class="panel" class:embedded bind:this={root} data-panel-root="true">
  {#if view === 'main'}
    <div class="main" class:quick onscroll={() => (muteMenu = null)}>
      <div class="cover"><PanelCover cover={coverCss} actions={['close']} trailActions={quick ? [manageIcon, 'more'] : canInvite ? ['invite', 'share', 'more'] : ['more']} handlers={coverHandlersAll} /></div>

      <div class="identity" class:quick>
        <div class="avatar" class:round={scope === 'channel'} style:background={avatar ? `url(${JSON.stringify(avatar)}) center/cover no-repeat` : grad(color)}></div>
        <div class="names">
          <div class="title-line">
            <span class="title">{scope === 'channel' ? '#' : ''}{title}</span>
            {#if !quick && isFavourite}
              <span class="fav-heart" title={t('ui.groupPanel.inFavourites')}></span>
            {/if}
          </div>
          {#if scope === 'channel'}
            {#snippet communityLink()}{#if quick}<span
                  class="community-chip"
                  onclick={() => onOpenCommunity?.()}
                  aria-label={t('ui.groupPanel.viewCommunity')}
                  role="button"
                  tabindex="0"
                  title={t('ui.groupPanel.viewCommunity')}>{communityName ?? t('ui.groupPanel.theCommunity')}<span class="chip-chevron" data-oc-flip=""></span></span
                >{:else}<a href="#top" onclick={link(() => onOpenCommunity?.())}>{communityName ?? t('ui.groupPanel.theCommunity')}</a>{/if}{/snippet}
            <span class="byline"
              >{#if quick}<span class="access-icon" class:public={isPublic}></span>{/if}<Translate
                key={quick ? 'ui.groupPanel.channelInAccess' : 'ui.groupPanel.channelInPlain'}
                params={{ access: isPublic ? 'public' : 'private' }}
                community={communityLink}
              /></span
            >
          {:else if quick}
            {#snippet ownerLink()}{@render owner()}{/snippet}
            <span class="byline"><span class="access-icon" class:public={isPublic}></span><Translate key="ui.groupPanel.createdByAccess" params={{ access: isPublic ? 'public' : 'private', scope }} owner={ownerLink} /></span>
          {:else}
            {#snippet ownerLinkPlain()}{@render owner()}{/snippet}
            <span class="byline plain"><Translate key="ui.groupPanel.createdBy" params={{ scope }} owner={ownerLinkPlain} /></span>
          {/if}
          {#if !quick}
            <div class="role-summary" onclick={() => go('members')} role="button" tabindex="0">
              <span class="users-icon"></span>
              <span class="role-text">{roleSummary}</span>
            </div>
          {/if}
        </div>
        {#if quick}
          <div class="pills">
            <span class="pill mute" class:on={!!muted} onclick={(e) => (muteMenu = placeUnder(e.currentTarget))} aria-label={t(muted ? 'ui.mute.unmute' : 'ui.mute.muteNotifications')} role="button" tabindex="0" title={t(muted ? 'ui.mute.unmute' : 'ui.mute.muteNotifications')}>
              <span class="pill-icon" style:mask={mask(muted ? 'bell-off' : 'bell')}></span>{t(muted ? 'ui.mute.muted' : 'ui.mute.mute')}
              <span class="pill-divider"></span><span class="caret"></span>
            </span>
            <!-- @everyone is its own toggle: it silences mass mentions, not notifications -->
            <span
              class="pill everyone"
              class:on={muteAll}
              onclick={toggleMuteAll}
              aria-label={t(muteAll ? 'ui.groupPanel.everyoneMentionsMuted' : 'ui.groupPanel.muteEveryoneMentions')}
              role="button"
              tabindex="0"
              title={t(muteAll ? 'ui.groupPanel.everyoneMentionsMuted' : 'ui.groupPanel.muteEveryoneMentions')}
              aria-pressed={muteAll}><span class="pill-icon" style:mask={mask(muteAll ? 'at-off' : 'at')}></span>@everyone</span
            >
            {#if onToggleFavourite}
              <span class="pill fav" class:on={!!isFavourite} onclick={onToggleFavourite} role="button" tabindex="0"><span class="pill-icon" style:mask={mask('heart')}></span>{t(isFavourite ? 'ui.groupPanel.favourited' : 'ui.groupPanel.favourite')}</span>
            {/if}
          </div>
        {:else}
          <div class="tiles"><TileButtons columns={scope === 'community' ? 2 : 3} {tiles} handlers={tileHandlersAll} /></div>
        {/if}
        {#if !quick && (scope === 'community' || scope === 'channel')}
          <div class="card">
            <span class="card-icon"><span class="card-glyph" style:mask={mask(isPublic ? 'globe' : 'lock')}></span></span>
            <div class="card-text">
              <span class="card-title">{t('ui.groupPanel.accessTitle', { access: isPublic ? 'public' : 'private', scope })}</span>
              <span class="card-body"
                >{scope === 'channel'
                  ? isPublic
                    ? t('ui.groupPanel.channelPublic', { community: communityName ?? t('ui.groupPanel.theCommunity') })
                    : t('ui.groupPanel.channelPrivate')
                  : isPublic
                    ? t('ui.groupPanel.communityPublic')
                    : t('ui.groupPanel.communityPrivate')}</span
              >
            </div>
          </div>
        {/if}
        {#if !quick && scope === 'channel'}
          <div class="card link-card" onclick={() => onOpenCommunity?.()} role="button" tabindex="0">
            <span class="community-mark" style:background={grad(communityColor)}></span>
            <div class="card-text">
              <span class="card-title clip">{communityName ?? t('ui.groupPanel.theCommunity')}</span>
              <span class="card-body">{t('ui.groupPanel.viewCommunityDetails')}</span>
            </div>
            <span class="chevron"></span>
          </div>
        {/if}
        {#if actionError && view === 'main'}
          <span class="member-error" role="alert">{actionError}</span>
        {/if}
        <div class="about">
          <p class="about-text" class:empty={!aboutText} bind:this={aboutEl} style:-webkit-line-clamp={aboutOpen ? 'unset' : quick ? '2' : '4'}>{aboutText || t('ui.groupPanel.noDescription')}</p>
          {#if aboutLong}
            <span class="about-toggle" onclick={() => (aboutOpen = !aboutOpen)} role="button" tabindex="0">{t(aboutOpen ? (quick ? 'ui.common.less' : 'ui.groupPanel.showLess') : quick ? 'ui.common.more' : 'ui.groupPanel.showMore')}</span>
          {/if}
        </div>
      </div>

      <div class="sections">
        {#if quick}
          <div class="online-card">
            <div class="online-head">
              <span class="online-dot"></span>
              <span class="online-title">{t(quickOnline.count > 0 ? 'ui.groupPanel.onlineNow' : 'ui.groupPanel.memberTabs.members')} <span class="online-count">{quickOnline.count > 0 ? `· ${quickOnline.count}` : ''}</span></span>
              <span class="online-of">{quickOnline.count > 0 ? t('ui.groupPanel.onlineOf', { total: num(quickOnline.total) }) : ''}</span>
            </div>
            <!-- the online list fills down to the panel edge -->
            <div class="online-list">
              {#if membersLoading}
                <Skeleton variant="member" count={6} />
              {:else}
                {#each quickOnline.rows as m}
                  <div class="cell">
                    <MemberRow
                      title={m.title}
                      subtitle={m.handle}
                      tag={m.tag}
                      color={m.color}
                      online={m.online}
                      ringColor="var(--surface-2,#191921)"
                      hoverBg="var(--overlay-2,rgba(255,255,255,.09))"
                      activity={m.activity}
                      showMenu={false}
                      onClick={openUser(m)}
                    />
                  </div>
                {/each}
              {/if}
              {#if quickOnline.count === 0}
                <span class="none-online">{t('ui.groupPanel.noneOnline')}</span>
              {/if}
              {#if quickOnline.count > (quickOnline.shown ?? 0)}
                <span class="more-online">{t('ui.groupPanel.moreOnline', { count: num(quickOnline.count - (quickOnline.shown ?? 0)) })}</span>
              {/if}
            </div>
            <div class="online-foot">
              {#if canInvite}
                <span class="foot-action invite" onclick={() => onDialog?.('invite', null, 'people')} role="button" tabindex="0"><span class="invite-icon"></span>{t('ui.groupPanel.invite')}</span>
              {/if}
              <span class="foot-action all" onclick={() => go('members')} role="button" tabindex="0">{t('ui.groupPanel.viewAllTotal', { total: num(quickOnline.total) })}</span>
            </div>
          </div>
          {#if slimBots.length > 0}
            <div class="bots-slim" onclick={() => go('bots')} role="button" tabindex="0">
              <div class="bot-stack">{#each slimBots as b}<span class="bot-face" style:background={grad(b.color)}></span>{/each}</div>
              <span class="bots-text">{t('ui.groupPanel.views.botsOnly')} <span class="bots-names">· {slimBots.map((b) => b.title).join(', ')}</span></span>
              <span class="chevron small" data-oc-flip=""></span>
            </div>
          {/if}
        {/if}

        {#if !embedded && !quick}
          <div class="section">
            {@render sectionHead(t('ui.groupPanel.membersHeading', { scope }), total, () => go('members'))}
            <div class="rows">
              {#each members.slice(0, allBots.length ? 3 : 5) as m}
                <div class="cell"><MemberRow title={m.title} subtitle={m.handle} tag={m.tag} color={m.color} onClick={openUser(m)} /></div>
              {/each}
            </div>
          </div>

          {#if allBots.length > 0}
            <div class="section">
              {@render sectionHead(t(allowHooks ? 'ui.groupPanel.botsWebhooksHeading' : 'ui.groupPanel.botsHeading'), allBots.length, () => go('bots'))}
              <div class="rows">
                {#each allBots.slice(0, 2) as b}
                  <div class="cell">
                    <MemberRow variant={b.variant} title={b.title} subtitle={b.subtitle} tag={b.tag} color={b.color} image={b.image} icon="chevron" showMenu={false} onClick={b.variant === 'webhook' ? openHook(b) : openBot(b, true)} />
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if scope === 'community'}
            <div class="section">
              {@render sectionHead(t('ui.groupPanel.userGroupsHeading'), userGroups.length, () => go('usergroups'))}
              <div class="rows">
                {#each userGroups.slice(0, 2) as g}
                  <div class="cell"><MemberRow title={g.title} subtitle={ugSubtitle(g)} color={g.color || 'slate'} icon="chevron" showMenu={false} onClick={() => openUserGroup(g)} /></div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="nav">
            <div class="nav-head"><span class="section-label">{t('ui.groupPanel.accessRulesHeading')}</span></div>
            {#each navRows as nav}
              <div class="cell"><PanelNavRow label={nav.label} hint={nav.hint} value="" highlight={false} onClick={() => go(nav.view)} /></div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="sub-head">
      <!-- narrow windows open the pinned list on its own: close only, nothing to go back to -->
      {#if (!embedded || view === 'usergroup') && !(pinnedOnly && view === 'pinned')}
        <span class="back" onclick={() => go(view === 'usergroup' ? 'usergroups' : 'main')} role="button" tabindex="0" aria-label={t('ui.common.back')}><span class="back-icon"></span></span>
      {/if}
      <div class="sub-titles">
        <span class="sub-title">{subviewTitle}</span>
        {#if subviewSub}
          <span class="sub-sub">{subviewSub}</span>
        {/if}
      </div>
      {#if view === 'members' && !embedded}
        {#if canInvite}
          <div class="slot"><IconButton label="ui.iconButton.addMembers" variant="ghost" icon="userPlus" onClick={() => onDialog?.('invite', null, 'people')} /></div>
          <div class="slot"><IconButton label="ui.groupPanel.shareInviteLink" variant="ghost" icon="share" onClick={() => onDialog?.('invite', null, 'share')} /></div>
        {/if}
      {/if}
      {#if userGroupsView && canManageUserGroups}
        <div class="head-button" onclick={() => ugDialog('create', null)} role="button" tabindex="0"><span class="plus-icon"></span>{t('ui.groupPanel.menu.newUserGroup')}</div>
      {/if}
      {#if view === 'usergroup' && ugCur && canManageUserGroups}
        <div class="slot"><IconButton label="ui.groupPanel.editUserGroup" variant="ghost" icon="edit" onClick={() => ugCur && ugDialog('edit', ugCur.key)} /></div>
      {/if}
      {#if canEdit && (view === 'permissions' || view === 'gates' || view === 'rules')}
        <!-- the sidebar is for reading; editing happens in a focused modal the host renders, deep-linked to this tab -->
        <div class="slot"><IconButton variant="ghost" icon="edit" onClick={() => onDialog?.('settings', settingsPayload(), view)} /></div>
      {/if}
      {#if embedded && botsPart === 'webhooks' && allowHooks && view === 'bots'}
        <!-- in the manage dialog's Webhooks section the create action lives in the header, like New channel -->
        <div class="head-button" onclick={() => onDialog?.('webhook', { dialogMode: 'register' })} role="button" tabindex="0"><span class="plus-icon"></span>{t('ui.groupPanel.registerWebhookShort')}</div>
      {/if}
      {#if embedded || (pinnedOnly && view === 'pinned')}
        <div class="slot">
          <IconButton
            label="ui.common.close"
            variant="ghost"
            icon="close"
            onClick={() => {
              if (!embedded) go('main');
              onClose?.();
            }}
          />
        </div>
      {/if}
    </div>

    <div class="sub-body">
      {#if view === 'members'}
        <div class="column">
          {#if canModerate}
            <div class="cell tabs"><SegmentedTabs labels={MEMBER_TABS.map((k) => t(k))} selectedIndex={tabIdx} dotOnLast={false} dotIndexes={lapsed.length ? [1] : []} onSelect={(i) => (memberTab = i)} /></div>
          {/if}
          <div class="cell" class:pad-top={!canModerate}>
            <Field
              placeholder={t(MEMBER_SEARCH[tabIdx])}
              value={memberQuery}
              onInput={(e) => {
                memberQuery = e.currentTarget.value;
                onSearchMembers?.(memberQuery.trim());
              }}
              onClear={() => {
                memberQuery = '';
                onSearchMembers?.('');
              }}
              showShortcut={false}
            />
          </div>
          {#if scope === 'channel' && tabIdx === 0}
            <div class="banner" onclick={() => onOpenCommunity?.('members')} role="button" tabindex="0">
              <div class="card-text">
                <span class="banner-title">{t('ui.groupPanel.lookingFor', { community: communityName ?? t('ui.groupPanel.theCommunity') })}</span>
                <span class="banner-body">{t('ui.groupPanel.channelOnlyList')}</span>
              </div>
              <span class="chevron accent"></span>
            </div>
          {/if}
          <div class="list-block">
            <span class="list-title">{t(MEMBER_LIST_TITLES[tabIdx], { count: [total, lapsed.length, visibleBlocked.length][tabIdx] })}</span>
            {#if actionError}
              <span class="member-error" role="alert">{actionError}</span>
            {/if}
            {#if MEMBER_NOTES[tabIdx]}
              <span class="list-note">{t(MEMBER_NOTES[tabIdx])}</span>
            {/if}
            <div class="rows">
              {#each memberRows as m}
                <div class="cell anchor">
                  <MemberRow
                    title={m.title}
                    subtitle={m.handle}
                    tag={m.tag}
                    isYou={m.isYou}
                    color={m.color}
                    online={m.online}
                    activity={m.activity}
                    onClick={openUser(m)}
                    onMenu={m.hasMenu ? () => (popover = popover === m.menuKey ? null : m.menuKey) : undefined}
                    showMenu={m.hasMenu}
                  />
                  {#if popover === `m:${m.handle}` && m.hasMenu}
                    {@render rowMenu(m.heading, m.items, '220px')}
                  {/if}
                  {#if popover === `sole:${m.handle}`}
                    {@render confirm(t('ui.groupPanel.onlyOwnerTitle'), t('ui.groupPanel.onlyOwnerBody'), t('ui.groupPanel.gotIt'), null)}
                  {/if}
                  {#if popover === `owner:${m.handle}`}
                    {@render confirm(t('ui.groupPanel.makeOwnerTitle', { name: m.title }), t('ui.groupPanel.makeOwnerBody', { scope }), t('ui.groupPanel.makeOwner'), m.confirmOwner)}
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      {#if view === 'bots'}
        <div class="column roomy">
          <div class="cell">
            <Field
              placeholder={t(!showBotLists ? 'ui.groupPanel.searchWebhooks' : allowHooks ? 'ui.groupPanel.searchBotsWebhooks' : 'ui.groupPanel.searchBots')}
              value={botQuery}
              onInput={(e) => (botQuery = e.currentTarget.value)}
              onClear={() => (botQuery = '')}
              showShortcut={false}
            />
          </div>

          {#if shownBots.length > 0 && showBotLists}
            <div class="bot-block">
              <span class="list-title">{t('ui.groupPanel.installedBots', { count: installedBots.length })}</span>
              <div class="rows">
                {#each shownBots as b}
                  <div class="cell"><MemberRow variant="bot" title={b.title} subtitle={b.subtitle} color={b.color} icon="chevron" showMenu={false} onClick={openBot(b, true)} /></div>
                {/each}
              </div>
            </div>
          {/if}

          {#if allowHooks}
            <div class="bot-block">
              <span class="list-title">{t('ui.groupPanel.webhooksHeading', { count: hooks.length })}</span>
              <span class="list-note small">{t('ui.groupPanel.webhooksNote')}</span>
              {#if !(embedded && botsPart === 'webhooks')}
                <div class="register" onclick={() => onDialog?.('webhook', { dialogMode: 'register' })} role="button" tabindex="0">
                  <span class="register-tile"><span class="hook-icon"></span></span>
                  <span class="register-label">{t('ui.groupPanel.registerWebhook')}</span>
                </div>
              {/if}
              {#if embedded && botsPart === 'webhooks' && hooks.length === 0 && !botNeedle}
                <span class="no-hooks">{t('ui.groupPanel.noWebhooks')} <a href="#top" onclick={link(() => onDialog?.('webhook', { dialogMode: 'register' }))}>{t('ui.groupPanel.registerWebhook')}</a></span>
              {/if}
              <div class="rows">
                {#each shownHooks as h}
                  <div class="cell"><MemberRow variant="webhook" title={h.title} subtitle={h.subtitle} color={h.color} image={h.image} icon="chevron" showMenu={false} onClick={openHook(h)} /></div>
                {/each}
              </div>
            </div>
          {/if}

          {#if shownRecommended.length > 0 && canManageBots && showBotLists}
            <div class="bot-block">
              <span class="list-title">{t('ui.groupPanel.recommendedBots', { count: shownRecommended.length })}</span>
              <div class="rows">
                {#each shownRecommended as b}
                  <div class="cell"><MemberRow variant="bot" title={b.title} subtitle={b.subtitle} color={b.color} icon="chevron" showMenu={false} onClick={openBot(b, false)} /></div>
                {/each}
              </div>
            </div>
          {/if}

          {#if !canManageBots && !botNeedle && shownBots.length === 0}
            <span class="empty-line">{t('ui.groupPanel.noBots', { scope })}</span>
          {/if}
          {#if botNeedle && (!showBotLists || shownBots.length === 0) && (!allowHooks || shownHooks.length === 0) && (!canManageBots || !showBotLists || shownRecommended.length === 0)}
            <span class="empty-line">{t('ui.groupPanel.nothingMatches', { query: botQuery })}</span>
          {/if}
        </div>
      {/if}

      {#if view === 'permissions'}
        <div class="perms">
          {#each roleDigest as r}
            <div class="perm-role">
              <span class="list-title" style:color={r.tint}>{t(r.label)}</span>
              <div class="caps">
                {#each r.caps as cap}
                  <span class="cap" style:background="color-mix(in srgb, {r.tint} 12%, transparent)" style:box-shadow="inset 0 0 0 1px color-mix(in srgb, {r.tint} 30%, transparent)">{t(cap)}</span>
                {/each}
                {#if r.none}
                  <span class="reading-only">{t('ui.groupPanel.readingOnly')}</span>
                {/if}
                {#if r.inherits}
                  <span class="inherits"><span class="inherits-icon"></span><span>{r.inherits}</span></span>
                {/if}
              </div>
            </div>
          {/each}

          {#if disabledPerms.length}
            <div class="perm-role">
              <span class="list-title">{t('ui.groupPanel.offForEveryone')}</span>
              <div class="caps">
                {#each disabledPerms as d}
                  <span class="cap off">{t(d)}</span>
                {/each}
              </div>
            </div>
          {/if}

          <div class="threads-card">
            <span class="threads-title">{t('ui.groupPanel.threads')}</span>
            <span class="threads-line">{threadLine}</span>
          </div>
        </div>
      {/if}

      {#if view === 'gates'}
        <div class="gates">
          {#if gateCards.length > 0}
            <div class="recheck">
              <span class="clock-icon"></span>
              <span class="recheck-line"
                >{rechecks ? t('ui.groupPanel.recheckLine', { every }) : t('ui.groupPanel.checkedAtJoin')}</span
              >
            </div>
            <div class="gate-block">
              <span class="list-title">{t((gateState?.joiner ?? 'All') === 'All' ? 'ui.groupPanel.allOfThese' : 'ui.groupPanel.anyOfThese')}</span>
              <div class="gate-list">
                {#each gateCards as g}
                  <div class="gate">
                    <span class="gate-badge" style:background="color-mix(in srgb, {g.tint} 14%, transparent)"><span class="gate-icon" style:background={g.tint} style:mask={mask(g.icon)}></span></span>
                    <div class="card-text">
                      <span class="gate-label">{t(g.label)}</span>
                      {#if g.detail}
                        <span class="gate-detail">{g.detail}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="dashed">
              <span class="dashed-title">{t('ui.groupPanel.noGatesTitle')}</span>
              <span class="dashed-body">{t('ui.groupPanel.noGatesBody')}</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if view === 'rules'}
        <div class="rules">
          {#if ruleLines.length > 0}
            {#each ruleLines as text, i}
              <div class="rule"><span class="rule-n">{i + 1}.</span><span class="rule-text">{text}</span></div>
            {/each}
            <span class="rules-note">{t('ui.groupPanel.rulesNote')}</span>
          {:else}
            <div class="dashed">
              <span class="dashed-title">{t('ui.groupPanel.noRulesTitle')}</span>
              <span class="dashed-body">{t('ui.groupPanel.noRulesBody')}</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if userGroupsView}
        <div class="column">
          <div class="cell tabs"><Field placeholder={t('ui.groupPanel.searchUserGroups')} value={ugQuery} onInput={(e) => (ugQuery = e.currentTarget.value)} onClear={() => (ugQuery = '')} showShortcut={false} /></div>
          <div class="ug-intro">
            <span class="ug-title">{t('ui.groupPanel.userGroupsCount', { count: userGroups.length })}</span>
            <span class="list-note">{t('ui.groupPanel.userGroupsNote')}</span>
          </div>
          <div class="rows padded">
            {#each ugShown as g}
              <div class="cell anchor">
                <MemberRow
                  title={g.title}
                  subtitle={ugSubtitle(g)}
                  color={g.color || 'slate'}
                  onClick={() => openUserGroup(g)}
                  onMenu={canManageUserGroups ? () => (popover = popover === g.key ? null : g.key) : undefined}
                  showMenu={canManageUserGroups}
                />
                {#if popover === g.key && canManageUserGroups}
                  {@render rowMenu(
                    '',
                    [
                      { label: t('ui.common.edit'), mask: mask('edit'), onSelect: () => ((popover = null), ugDialog('edit', g.key)) },
                      { label: t('ui.common.delete'), mask: mask('trash'), variant: 'danger', onSelect: () => ((popover = null), ugDialog('delete', g.key)) },
                    ],
                    '180px',
                  )}
                {/if}
              </div>
            {/each}
            {#if ugShown.length === 0}
              <span class="ug-empty">{userGroups.length ? t('ui.groupPanel.noUserGroupsMatch', { query: ugQuery }) : t('ui.groupPanel.noUserGroups')}</span>
            {/if}
          </div>
        </div>
      {/if}

      {#if view === 'usergroup' && ugCur}
        <div class="column">
          <div class="cell tabs"><Field placeholder={t('ui.groupPanel.searchGroupMembers')} value={ugMemberQuery} onInput={(e) => (ugMemberQuery = e.currentTarget.value)} onClear={() => (ugMemberQuery = '')} showShortcut={false} /></div>
          <div class="ug-intro">
            <span class="ug-title">{t('ui.groupPanel.membersCount', { count: ugCur.members.length })}</span>
            <span class="list-note"><Translate key="ui.groupPanel.mentionAll">{#snippet tag()}<span class="mention">{ugMention(ugCur)}</span>{/snippet}</Translate></span>
          </div>
          <div class="rows padded">
            {#each ugMembersShown as m}
              <div class="cell"><MemberRow title={m.name} subtitle={m.handle} color={m.color} showMenu={false} onClick={() => onDialog?.('user', { userId: m.userId, title: m.name, handle: m.handle, color: m.color })} /></div>
            {/each}
            {#if ugMembersShown.length === 0 && ugMemberQuery}
              <span class="ug-empty">{t('ui.groupPanel.noMembersMatch', { query: ugMemberQuery })}</span>
            {/if}
          </div>
        </div>
      {/if}

      {#if view === 'pinned'}
        <div class="column pinned">
          {#each pinnedDays as day}
            <div class="pin-day">
              <span class="pin-date">{day.date}</span>
              {#each day.items as p (p.messageId)}
                <div class="cell"><MessageGroup side="received" senderName={p.author} color={p.color} showAvatar={true} showName={true} messages={p.messages} /></div>
                {#if onOpenPinned || (canPin && onUnpin)}
                  <div class="pin-actions">
                    {#if onOpenPinned}<span class="pin-action" onclick={() => onOpenPinned(p.messageId)} role="button" tabindex="0">{t('ui.groupPanel.goToMessage')}</span>{/if}
                    {#if canPin && onUnpin}<span class="pin-action" onclick={() => unpin(p.messageId)} role="button" tabindex="0">{t('ui.groupPanel.unpin')}</span>{/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/each}
          {#if actionError}
            <span class="member-error" role="alert">{actionError}</span>
          {/if}
          {#if pinnedDays.length === 0}
            <span class="empty-line center">{t('ui.groupPanel.nothingPinned')}</span>
          {/if}
        </div>
      {/if}

      {#if view === 'stats'}
        <div class="column stats">
          {#if stats}
            <GroupStats {...stats} />
          {:else}
            <span class="empty-line center">{t('ui.groupPanel.noStats')}</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if muteMenu}
    <div class="local-scrim mute-scrim" onclick={() => (muteMenu = null)} aria-hidden="true"></div>
    <div class="mute-menu" style:top="{muteMenu.top}px" style:left="{muteMenu.left}px">
      <span class="mute-title">{t('ui.mute.muteFor')}</span>
      {#each muteOptions as o}
        <div class="mute-option" onclick={() => setMute(o.key)} role="button" tabindex="0">{t(o.label)}</div>
      {/each}
    </div>
  {/if}

  {#if menuOpen}
    <div class="local-scrim" onclick={() => (menuOpen = false)} aria-hidden="true"></div>
    <div class="panel-menu"><Menu items={menuItems} /></div>
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
    border-radius: var(--radius-2xl);
  }

  .panel.embedded {
    border-radius: 0;
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .cell.anchor {
    position: relative;
  }

  .main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: var(--space-32);
    display: flex;
    flex-direction: column;
  }

  .main.quick {
    padding-bottom: 0px;
  }

  .cover {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .identity {
    padding: 0 var(--space-16) var(--space-16);
    margin-top: -34px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
  }

  .identity.quick {
    padding-bottom: var(--space-26);
    margin-top: -52px;
  }

  .avatar {
    position: relative;
    width: 72px;
    height: 72px;
    margin-bottom: 0px;
    border-radius: 24px;
    box-shadow: 0 0 0 4px var(--surface-1, #0e0e12);
  }

  .avatar.round {
    border-radius: 50%;
  }

  .quick .avatar {
    width: 104px;
    height: 104px;
    margin-bottom: var(--space-6);
  }

  .names {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    max-width: 100%;
  }

  .title-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    min-width: 0;
    max-width: 100%;
  }

  .title {
    min-width: 0;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
    text-align: center;
    text-wrap: pretty;
  }

  .fav-heart {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--accent, #ff5672);
    mask: var(--icon-heart-filled) center/contain no-repeat;
  }

  .byline {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    font: var(--weight-regular) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .byline.plain {
    display: inline;
  }

  .byline a {
    color: var(--accent, #ff5672);
    text-decoration: none;
  }

  .access-icon {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-lock) center/contain no-repeat;
  }

  .access-icon.public {
    mask: var(--icon-globe) center/contain no-repeat;
  }

  .community-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    height: 26px;
    padding: 0 var(--space-6) 0 var(--space-10);
    border-radius: var(--radius-pill);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.08));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .community-chip:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .chip-chevron {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .role-summary {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    margin-top: var(--space-2);
    padding: var(--space-4) var(--space-8);
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .role-summary:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .users-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-users) center/contain no-repeat;
  }

  .role-text {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .pills {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--space-8);
    margin-top: var(--space-8);
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

  .pill.mute {
    padding: 0 9px 0 12px;
  }

  .pill.everyone {
    gap: 6px;
    padding: 0 12px 0 11px;
  }

  .pill.fav {
    padding: 0 13px 0 12px;
  }

  .pill-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--pill-ink);
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

  .tiles {
    width: 100%;
    margin-top: var(--space-14);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 56px;
    padding: var(--space-10) var(--space-12) var(--space-10) var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .link-card {
    cursor: pointer;
    user-select: none;
  }

  .link-card:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .card-icon {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .card-glyph {
    width: 17px;
    height: 17px;
    background: var(--ink-2, #c9c9d4);
  }

  .community-mark {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }

  .card-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .clip {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-body {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .link-card .card-body {
    line-height: 1.2;
  }

  .chevron {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .chevron.small {
    width: 14px;
    height: 14px;
    background: var(--ink-4, #7c7c8c);
  }

  .chevron.accent {
    width: 16px;
    height: 16px;
    background: var(--accent, #ff5672);
  }

  .about {
    width: 100%;
    margin-top: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
  }

  .about-text {
    margin: 0;
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .about-text.empty {
    color: var(--ink-4, #7c7c8c);
  }

  .about-toggle {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
    padding: var(--space-4) var(--space-6);
    border-radius: var(--radius-sm);
  }

  .about-toggle:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .sections {
    flex: 1 0 auto;
    padding: 0 var(--space-16) var(--space-16);
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
  }

  .online-card {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl, 16px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
  }

  .online-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-height: 56px;
    padding: var(--space-18) var(--space-16);
    box-sizing: border-box;
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .online-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-online, #2ee6a8);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-online, #2ee6a8) 18%, transparent);
  }

  .online-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .online-count {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .online-of {
    flex: none;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .online-list {
    flex: 1 1 0px;
    min-height: 236px;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-14) var(--space-6);
  }

  .none-online {
    padding: var(--space-4) var(--space-10) var(--space-8);
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .more-online {
    padding: var(--space-10) var(--space-10) var(--space-4);
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .online-foot {
    flex: none;
    display: flex;
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .foot-action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 56px;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .foot-action:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .foot-action.invite {
    gap: 7px;
    border-inline-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
    color: var(--ink, #ececf1);
    border-end-start-radius: var(--radius-xl, 16px);
  }

  .foot-action.all {
    color: var(--ink-2, #c9c9d4);
    border-end-end-radius: var(--radius-xl, 16px);
  }

  .invite-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink, #ececf1);
    mask: var(--icon-invite) center/contain no-repeat;
  }

  .bots-slim {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 56px;
    padding: var(--space-12) var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-xl, 16px);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    cursor: pointer;
    user-select: none;
  }

  .bots-slim:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .bot-stack {
    flex: none;
    display: flex;
  }

  .bot-face {
    width: 30px;
    height: 30px;
    margin-inline-end: -7px;
    border-radius: 9px;
    box-shadow: 0 0 0 2px var(--surface-1, #0e0e12);
  }

  .bots-text {
    flex: 1;
    min-width: 0;
    margin-inline-start: 7px;
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bots-names {
    font-weight: var(--weight-regular);
    color: var(--ink-3, #9a9aa8);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    padding-top: var(--space-16);
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .section-label {
    flex: 1;
    min-width: 0;
    padding-inline-start: var(--space-8);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3, #9a9aa8);
  }

  .view-all {
    flex: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    text-decoration: none;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .rows.padded {
    padding-top: var(--space-6);
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .nav-head {
    padding-top: var(--space-16);
    padding-bottom: var(--space-4);
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .sub-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 71px;
    box-sizing: border-box;
    padding: 0 var(--space-16);
    border-bottom: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .back {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .back:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .back-icon {
    width: 17px;
    height: 17px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .sub-titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sub-title {
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub-sub {
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .slot {
    flex: none;
    display: flex;
  }

  .head-button {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 34px;
    padding: 0 var(--space-12) 0 var(--space-10);
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .head-button:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.12));
  }

  .plus-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink, #ececf1);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .sub-body {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--space-16) var(--space-16) var(--space-32);
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    gap: var(--space-16);
  }

  .column {
    width: 100%;
    max-width: 520px;
    align-self: center;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .column.roomy {
    gap: var(--space-26);
    padding-top: var(--space-6);
  }

  .column.pinned {
    gap: var(--space-18);
    padding-top: var(--space-6);
  }

  .column.stats {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding-top: var(--space-6);
  }

  .cell.tabs {
    padding-top: var(--space-6);
  }

  .cell.pad-top {
    padding-top: var(--space-6);
  }

  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    margin-top: var(--space-4);
    padding: var(--space-12) var(--space-12) var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--accent, #ff5672) 8%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 24%, transparent);
    cursor: pointer;
    user-select: none;
  }

  .banner:hover {
    background: color-mix(in oklch, var(--accent, #ff5672) 13%, transparent);
  }

  .banner-title {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .banner-body {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .list-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
    padding-top: var(--space-22);
  }

  .list-title {
    padding-inline-start: var(--space-4);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--ink-4, #7c7c8c);
  }

  .pin-actions {
    display: flex;
    gap: var(--space-14);
    padding-inline-start: 52px;
    margin-block-start: -4px;
  }

  .pin-action {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    cursor: pointer;
  }

  .pin-action:hover {
    color: var(--ink, #ececf1);
  }

  .member-error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .list-note {
    padding-inline: var(--space-4);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .list-note.small {
    font-size: var(--text-sm);
    color: var(--ink-4, #7c7c8c);
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 19;
  }

  .row-menu {
    position: absolute;
    inset-inline-end: var(--space-4);
    top: calc(100% - 6px);
    z-index: 20;
    display: grid;
    grid-template-columns: max-content;
  }

  .ask {
    position: absolute;
    inset-inline-end: var(--space-4);
    top: calc(100% - 6px);
    z-index: 20;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-panel, 0 8px 24px rgba(0, 0, 0, 0.28));
  }

  .ask-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .ask-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .ask-body {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .ask-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-6);
  }

  .ask-cancel,
  .ask-confirm,
  .ask-ok {
    display: flex;
    align-items: center;
    height: 34px;
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .ask-cancel {
    padding: 0 var(--space-12);
    color: var(--ink-2, #c9c9d4);
  }

  .ask-cancel:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .ask-confirm {
    padding: 0 var(--space-14);
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .ask-confirm:hover {
    filter: brightness(1.08);
  }

  .ask-ok {
    padding: 0 var(--space-14);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    color: var(--ink, #ececf1);
  }

  .ask-ok:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.12));
  }

  .bot-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  .register {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    margin-block-start: var(--space-4);
    padding: var(--space-8);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .register:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .register-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
    box-shadow: inset 0 0 0 1px var(--accent-dim, rgba(255, 86, 114, 0.35));
  }

  .hook-icon {
    width: 18px;
    height: 18px;
    background: var(--accent, #ff5672);
    mask: var(--icon-hook) center/contain no-repeat;
  }

  .register-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--accent, #ff5672);
  }

  .no-hooks {
    padding: var(--space-10) var(--space-4) 0;
    font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .no-hooks a {
    font-weight: var(--weight-semibold);
  }

  .empty-line {
    padding: var(--space-14) var(--space-4);
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .empty-line.center {
    padding: var(--space-24) var(--space-4);
    text-align: center;
    line-height: 1.5;
  }

  .perms {
    display: flex;
    flex-direction: column;
    gap: var(--space-32);
    min-width: 0;
  }

  .perm-role {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .caps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    min-width: 0;
  }

  .cap {
    padding: 5px var(--space-10);
    border-radius: var(--radius-sm);
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .cap.off {
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    color: var(--ink-4, #7c7c8c);
    text-decoration: line-through;
  }

  .reading-only {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .inherits {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px var(--space-10);
    border-radius: var(--radius-sm);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .inherits-icon {
    flex: none;
    width: 11px;
    height: 11px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .threads-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .threads-title {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .threads-line {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .gates {
    display: flex;
    flex-direction: column;
    gap: var(--space-18);
    min-width: 0;
  }

  .recheck {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    border: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .clock-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-clock) center/contain no-repeat;
  }

  .recheck-line {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .gate-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  .gate-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  .gate {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: 13px var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .gate-badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
  }

  .gate-icon {
    width: 15px;
    height: 15px;
  }

  .gate-label {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #e4e4ec);
    text-wrap: pretty;
  }

  .gate-detail {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .dashed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-26) var(--space-18);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    border: 1px dashed var(--line-2, rgba(255, 255, 255, 0.14));
  }

  .dashed-title {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .dashed-body {
    max-width: 260px;
    text-align: center;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .rules {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
    box-sizing: border-box;
    padding-inline: var(--space-10);
  }

  .rule {
    display: flex;
    gap: var(--space-10);
    min-width: 0;
  }

  .rule-n {
    flex: none;
    width: 18px;
    font: var(--weight-semibold) var(--text-xs) / 1.5 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .rule-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .rules-note {
    font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .ug-intro {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
    padding-top: var(--space-18);
  }

  .ug-title {
    padding-inline-start: var(--space-4);
    font: var(--weight-semibold) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .mention {
    font-family: var(--font-mono);
    color: var(--ink-2, #c9c9d4);
  }

  .ug-empty {
    padding: var(--space-18) var(--space-4);
    text-align: center;
    font: var(--weight-regular) var(--text-md) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .pin-day {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
  }

  .pin-date {
    align-self: center;
    padding: 7px var(--space-14);
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .local-scrim {
    position: absolute;
    inset: 0;
    z-index: 40;
  }

  .mute-scrim {
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

  .panel-menu {
    position: absolute;
    top: 46px;
    inset-inline-end: var(--space-16);
    z-index: 41;
    display: grid;
    grid-template-columns: max-content;
    justify-items: end;
  }
</style>

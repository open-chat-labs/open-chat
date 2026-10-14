<!-- Create a group, community, #channel or embedded channel. Tabs: details (cover, photo, name, description, kind-specific
     switches), Invite / Members, Channels (communities), Gates, Rules and Permissions. Basic shows the first tabs only;
     "More options" (or making the group public, or any advanced value) reveals the rest, and an unused advanced section
     can be folded away again. Create validates the name (and the URL for embedded channels) and blank rules, jumping to
     the tab that needs attention, then calls onCreate with everything set (photos as File objects) and waits on its promise:
     the dialog closes once it resolves, and stays open with the form intact and an error if it rejects. -->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { AccessGatesState, CreateGroupResult, GroupRole, MenuItem } from '../../lib/types';
  import AccessGates from './AccessGates.svelte';
  import Field from '../../lib/components/Field.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TextArea from '../../lib/components/TextArea.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import UpgradeBanner from './UpgradeBanner.svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { useT } from '../../lib/i18n';
  import Translate from '../../lib/components/Translate.svelte';

  // resource-key prefix; constants below hold keys, resolved with t() at render time
  const CG = 'ui.createGroupDialog.';

  type Kind = 'group' | 'community' | 'channel' | 'embedded';
  type TabKey = 'Group' | 'Invite' | 'Channels' | 'Gates' | 'Rules' | 'Permissions';
  type Scope = 'general' | 'messages' | 'threads';
  type PermValue = GroupRole | 'inherit';
  type Perms = { general: Record<string, GroupRole>; messages: Record<string, PermValue>; threads: Record<string, PermValue> };

  const GRADIENTS: Record<string, string> = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
  };
  // swatches are the theme's --cover-<key> tokens
  const COVERS = ['plum', 'teal', 'violet', 'amber', 'slate'];
  // accessible names for the cover and photo swatches
  const colourName = (key: string) => CG + 'colours.' + key;

  const NAME_MAX = 40;
  const ABOUT_MAX = 500;
  const RULES_MAX = 1000;
  const CHAN_MAX = 30;

  const TABS: TabKey[] = ['Group', 'Invite', 'Gates', 'Rules', 'Permissions'];
  // same builder for groups and community channels; internal keys stay the group ones
  const KINDS: Record<Kind, { keys: TabKey[]; labels: string[]; basic: number }> = {
    group: { keys: TABS, labels: ['group', 'invite', 'gates', 'rules', 'permissions'].map((k) => CG + 'tabs.' + k), basic: 2 },
    channel: { keys: TABS, labels: ['channel', 'members', 'gates', 'rules', 'permissions'].map((k) => CG + 'tabs.' + k), basic: 2 },
    community: { keys: ['Group', 'Invite', 'Channels', 'Gates', 'Rules', 'Permissions'], labels: ['community', 'invite', 'channels', 'gates', 'rules', 'permissions'].map((k) => CG + 'tabs.' + k), basic: 3 },
    embedded: { keys: ['Group', 'Invite', 'Gates', 'Permissions'], labels: ['embedded', 'members', 'gates', 'permissions'].map((k) => CG + 'tabs.' + k), basic: 2 },
  };

  // label / desc / rules are keys under templates.<key>; applying a template writes the translated rules
  const RULE_TEMPLATES = ['standard', 'trading', 'support', 'civil', 'project', 'announce'].map((key) => {
    const base = CG + 'templates.' + key + '.';
    return { key, label: base + 'label', desc: base + 'desc', rules: [base + 'rule1', base + 'rule2', base + 'rule3'] };
  });

  // role ladder, lowest first; "nobody" switches a permission off entirely
  const ROLES: { key: GroupRole; label: string }[] = [
    { key: 'member', label: CG + 'roles.member' },
    { key: 'moderator', label: CG + 'roles.moderator' },
    { key: 'admin', label: CG + 'roles.admin' },
    { key: 'owner', label: CG + 'roles.owner' },
    { key: 'nobody', label: CG + 'roles.nobody' },
  ];
  const VALUE_LABEL: Record<GroupRole, string> = { member: CG + 'values.member', moderator: CG + 'values.moderator', admin: CG + 'values.admin', owner: CG + 'values.owner', nobody: CG + 'values.nobody' };
  const PERMS: { key: string; label: string; group: string; def: GroupRole; only?: Kind }[] = [
    { key: 'roles', label: CG + 'perms.roles', group: 'Members', def: 'owner' },
    { key: 'edit', label: CG + 'perms.edit', group: 'Members', def: 'admin' },
    { key: 'invite', label: CG + 'perms.invite', group: 'Members', def: 'member' },
    { key: 'remove', label: CG + 'perms.remove', group: 'Members', def: 'moderator' },
    { key: 'delete', label: CG + 'perms.delete', group: 'Moderation', def: 'moderator' },
    { key: 'pin', label: CG + 'perms.pin', group: 'Moderation', def: 'moderator' },
    { key: 'react', label: CG + 'perms.react', group: 'Moderation', def: 'member' },
    { key: 'everyone', label: CG + 'perms.everyone', group: 'Moderation', def: 'admin' },
    { key: 'calls', label: CG + 'perms.calls', group: 'Moderation', def: 'member' },
    { key: 'pubChannels', label: CG + 'perms.pubChannels', group: 'Channels', def: 'admin', only: 'community' },
    { key: 'privChannels', label: CG + 'perms.privChannels', group: 'Channels', def: 'member', only: 'community' },
    { key: 'userGroups', label: CG + 'perms.userGroups', group: 'Channels', def: 'owner', only: 'community' },
  ];
  const PERM_GROUPS = ['Members', 'Moderation', 'Channels'];
  const PERM_GROUP_KEYS: Record<string, string> = { Members: CG + 'permGroups.members', Moderation: CG + 'permGroups.moderation', Channels: CG + 'permGroups.channels' };
  const LANGUAGES = ['English', 'Français', 'Deutsch', 'Italiano', 'Español', 'Português', 'Türkçe', 'Polski', 'Nederlands', 'Русский', 'Українська', '日本語', '한국어', '中文', 'हिन्दी', 'Tiếng Việt', 'Bahasa Indonesia'];
  // messages and threads share this list; each type inherits the master unless set
  const CONTENT = [
    { key: 'text', label: CG + 'content.text' },
    { key: 'image', label: CG + 'content.image' },
    { key: 'video', label: CG + 'content.video' },
    { key: 'audio', label: CG + 'content.audio' },
    { key: 'file', label: CG + 'content.file' },
    { key: 'poll', label: CG + 'content.poll' },
    { key: 'crypto', label: CG + 'content.crypto' },
    { key: 'giphy', label: CG + 'content.giphy' },
    { key: 'prize', label: CG + 'content.prize' },
    { key: 'meme', label: CG + 'content.meme' },
    { key: 'p2p', label: CG + 'content.p2p' },
  ];
  const INHERIT = 'inherit';

  function defaultPerms(): Perms {
    const o: Perms = { general: {}, messages: { default: 'member' }, threads: { default: 'member' } };
    PERMS.forEach((p) => (o.general[p.key] = p.def));
    CONTENT.forEach((c) => {
      o.messages[c.key] = INHERIT;
      o.threads[c.key] = INHERIT;
    });
    return o;
  }

  const slug = (v: string, max = Infinity) => v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '').slice(0, max);
  const mask = (icon: string) => `var(--icon-${icon}) center/contain no-repeat`;
  const ring = (on: boolean) => (on ? '0 0 0 2px var(--surface-1,#0e0e12), 0 0 0 4px var(--accent,#FF5672)' : 'inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14))');

  interface Person {
    name: string;
    handle: string;
    /** violet | amber | teal | blue */
    color: string;
  }

  interface Props {
    kind?: Kind;
    /** Channels: the community they're created in (or a resource key; defaults to "the community"). */
    communityName?: string;
    /** People to add (groups: invite; channels: community members). The first six are shown as frequently contacted. */
    people?: Person[];
    /** Channels: anyone on OpenChat, for the "Invite people" mode. */
    invitePeople?: Person[];
    /** Handles already picked when the dialog opens. */
    preselected?: string[];
    /** false: every tab shows from the start, with no "More options" step. */
    advanced?: boolean;
    /** Groups: false (the default) locks "Public group" behind an upgrade banner (channels are never locked). */
    isDiamond?: boolean;
    onUpgrade?: () => void;
    /** Create it. The dialog closes when this resolves; a rejection keeps it open with an error. */
    onCreate?: (group: CreateGroupResult) => Promise<unknown> | void;
    onCancel?: () => void;
  }

  let {
    kind: kindProp = 'group',
    communityName = 'ui.createGroupDialog.theCommunity',
    people = [],
    invitePeople = [],
    preselected = [],
    advanced = true,
    isDiamond: isDiamondProp = false,
    onUpgrade,
    onCreate,
    onCancel,
  }: Props = $props();
  const t = useT();
  const community = $derived(t(communityName));

  const kind = $derived<Kind>(KINDS[kindProp] ? kindProp : 'group');
  const K = $derived(KINDS[kind]);
  const isComm = $derived(kind === 'community');
  const isChan = $derived(kind === 'channel' || kind === 'embedded');
  const isEmb = $derived(kind === 'embedded');
  // channels live in an existing community, so group-level Diamond limits don't apply
  const isDiamond = $derived(isChan || isDiamondProp !== false);

  // --- draft
  let tab = $state(0);
  let closing = $state(false);
  let nameTouched = $state(false);
  let advancedOpenState = $state(false);
  let name = $state('');
  let about = $state('');
  let color = $state('teal');
  let cover = $state('plum');
  // the files go to the host; the object URLs are previews only and are always released here
  let avatarFile = $state<File | null>(null);
  let coverFile = $state<File | null>(null);
  let avatarUrl = $state<string | null>(null);
  let coverUrl = $state<string | null>(null);
  let creating = $state(false);
  let createError = $state(false);
  const preview = (old: string | null, file: File | null) => {
    if (old) URL.revokeObjectURL(old);
    return file ? URL.createObjectURL(file) : null;
  };
  const setAvatar = (file: File | null) => {
    avatarFile = file;
    avatarUrl = preview(avatarUrl, file);
  };
  const setCover = (file: File | null) => {
    coverFile = file;
    coverUrl = preview(coverUrl, file);
  };
  let picked = $state<string[]>(untrack(() => [...preselected]));
  let invited = $state<string[]>([]);
  let memberMode = $state(0);
  let channels = $state(['general']);
  let chanDraft = $state('');
  let chanEdit = $state<number | null>(null);
  let chanEditValue = $state('');
  let chanMenu = $state<number | null>(null);
  let chanTried = $state(false);
  let lang = $state('English');
  let langOpen = $state(false);
  let langQuery = $state('');
  let publicOn = $state(untrack(() => kindProp === 'embedded'));
  let disappearOn = $state(false);
  let historyOn = $state(false);
  let previewOn = $state(false);
  let url = $state('');
  let urlTouched = $state(false);
  let after = $state('12 hours');
  let query = $state('');
  let gates = $state<AccessGatesState | null>(null);
  let rulesOn = $state(false);
  let rulesText = $state('');
  let rulesPreset = $state<string | null>(null);
  let submitted = $state(false);
  let perms = $state<Perms>(defaultPerms());
  let permSub = $state(0);
  let threadsOverride = $state(false);
  let permMenu = $state<{ scope: Scope; key: string; allowInherit: boolean; anchorTop: number; anchorBottom: number; top: string; left: string; measured: boolean } | null>(null);

  let avatarInput = $state<HTMLInputElement>();
  let coverInput = $state<HTMLInputElement>();
  let permPanel = $state<HTMLDivElement>();
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    clearTimeout(closeTimer);
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    if (coverUrl) URL.revokeObjectURL(coverUrl);
  });

  // the role menu is fixed-positioned so the dialog's scrolling body can never clip it;
  // it opens against the pill and its real height is measured after mount
  $effect(() => {
    const m = permMenu, el = permPanel;
    if (!m || m.measured || !el) return;
    const H = el.offsetHeight, PAD = 12;
    const flip = window.innerHeight - m.anchorBottom - PAD < H && m.anchorTop - PAD >= H;
    const top = flip ? m.anchorTop - 6 - H : Math.min(m.anchorBottom + 6, window.innerHeight - PAD - H);
    permMenu = { ...m, measured: true, top: `${Math.max(PAD, top)}px` };
  });

  function openPermMenu(el: HTMLElement, scope: Scope, key: string, allowInherit: boolean) {
    const r = el.getBoundingClientRect(), W = 238, PAD = 12;
    permMenu = {
      scope,
      key,
      allowInherit,
      anchorTop: r.top,
      anchorBottom: r.bottom,
      top: `${r.bottom + 6}px`,
      left: `${Math.max(PAD, Math.min(r.right - W, window.innerWidth - PAD - W))}px`,
      measured: false,
    };
  }

  function setPerm(scope: Scope, key: string, role: PermValue) {
    perms = { ...perms, [scope]: { ...perms[scope], [key]: role } };
    permMenu = null;
  }

  function close(then?: () => void) {
    if (closing) return;
    closing = true;
    closeTimer = setTimeout(() => {
      closing = false;
      then?.();
    }, 170);
  }

  // --- derived state
  const gateCount = $derived(gates?.count ?? 0);
  const nameOk = $derived(name.trim().length > 0);
  const nameBad = $derived(!nameOk && nameTouched);
  const urlOk = $derived(/^https?:\/\/\S+\.\S+/.test(url.trim()));
  const urlBad = $derived(isEmb && !urlOk && urlTouched);
  // rules on with an empty field blocks creation, but only reads as an error once Create is pressed
  const rulesOk = $derived(!rulesOn || !!rulesText.trim());
  const rulesBad = $derived(!rulesOk && submitted);
  const permList = $derived(PERMS.filter((x) => !x.only || x.only === kind));
  const generalChanged = $derived(PERMS.filter((p) => perms.general[p.key] !== p.def).length);
  const msgExceptions = $derived(CONTENT.filter((c) => perms.messages[c.key] !== INHERIT).length);
  const thrExceptions = $derived(CONTENT.filter((c) => perms.threads[c.key] !== INHERIT).length);
  const msgChanged = $derived(generalChanged + msgExceptions + (perms.messages.default !== 'member' ? 1 : 0));
  const permsChanged = $derived(msgChanged + (threadsOverride ? 1 + (perms.threads.default !== 'member' ? 1 : 0) + thrExceptions : 0));

  // disclosure: Basic is the first tabs. It opens revealed if anything advanced already has a value,
  // and reveals itself when the group is made public — that is exactly when gates stop being exotic
  const advancedTouched = $derived(!!(gateCount || rulesOn || rulesText || msgChanged));
  const advancedOpen = $derived(advanced === false || advancedOpenState || advancedTouched);
  const visibleKeys = $derived(advancedOpen ? K.keys : K.keys.slice(0, K.basic));
  const current = $derived<TabKey>(K.keys[tab] ?? 'Group');
  const rulesTab = $derived(K.keys.indexOf('Rules'));

  // channels: mode 0 adds community members directly, mode 1 invites anyone (they must accept)
  const inviting = $derived(isChan && memberMode === 1);
  const active = $derived(inviting ? invited : picked);
  // someone already added can't also be invited, and vice versa
  const other = $derived(isChan ? (inviting ? picked : invited) : []);
  const sourcePool = $derived(inviting ? invitePeople : people);
  const modePool = $derived(sourcePool.filter((p) => !other.includes(p.handle)));
  const frequent = $derived(sourcePool.slice(0, 6).map((p) => p.handle));
  const needle = $derived(query.trim().toLowerCase());
  const listed = $derived(
    needle ? modePool.filter((p) => `${p.name} ${p.handle}`.toLowerCase().includes(needle)) : isChan && !inviting ? people : modePool.filter((p) => frequent.includes(p.handle)),
  );

  function toggleHandle(handle: string) {
    const flip = (list: string[]) => (list.includes(handle) ? list.filter((h) => h !== handle) : [...list, handle]);
    if (inviting) invited = flip(invited);
    else picked = flip(picked);
  }

  // channels tab
  const draftDup = $derived(!!chanDraft && channels.includes(chanDraft));
  const draftOk = $derived(!!chanDraft && !draftDup);
  const editDup = $derived(chanEdit != null && channels.some((c, i) => i !== chanEdit && c === chanEditValue));

  function addChannel() {
    if (draftOk) {
      channels = [...channels, chanDraft];
      chanDraft = '';
      chanTried = false;
    } else chanTried = true;
  }

  function saveChannelEdit() {
    if (!chanEditValue || editDup) return;
    channels = channels.map((c, i) => (i === chanEdit ? chanEditValue : c));
    chanEdit = null;
  }

  const channelMenu = (i: number, channel: string): MenuItem[] => [
    {
      label: t('ui.common.edit'),
      mask: mask('edit'),
      onSelect: () => {
        chanMenu = null;
        chanEdit = i;
        chanEditValue = channel;
      },
    },
    {
      label: t('ui.common.remove'),
      mask: mask('trash'),
      variant: 'danger',
      onSelect: () => {
        chanMenu = null;
        chanEdit = null;
        channels = channels.filter((_, k) => k !== i);
      },
    },
  ];

  const languages = $derived(LANGUAGES.filter((l) => !langQuery.trim() || l.toLowerCase().includes(langQuery.trim().toLowerCase())));

  // the details tab's switches differ per kind
  type Switch = { title: string; hint: string; on: boolean; set: (v: boolean) => void; disabled?: boolean; locked?: boolean; timed?: boolean };
  const disappearing = $derived<Switch>({ title: t(CG + 'disappearing'), hint: '', on: disappearOn, set: (v) => (disappearOn = v), timed: true });
  const publicChannelHint = $derived(t(CG + 'publicChannelHint', { community }));
  const switches = $derived<Switch[]>(
    isEmb
      ? [
          {
            title: t(CG + 'publicChannel'),
            hint: publicChannelHint,
            on: publicOn,
            set: (v) => {
              publicOn = v;
              if (!v) previewOn = false;
            },
          },
          {
            title: t(CG + 'previewTitle'),
            hint: t(publicOn ? CG + 'previewHint' : CG + 'previewUnavailable'),
            on: publicOn && previewOn,
            disabled: !publicOn,
            set: (v) => publicOn && (previewOn = v),
          },
        ]
      : isChan
        ? [
            { title: t(CG + 'publicChannel'), hint: publicChannelHint, on: publicOn, set: (v) => (publicOn = v) },
            {
              title: t(CG + 'historyTitle'),
              hint: t(publicOn ? CG + 'historyAlwaysOn' : CG + 'historyHint'),
              on: historyOn || publicOn,
              disabled: publicOn,
              set: (v) => !publicOn && (historyOn = v),
            },
            disappearing,
          ]
        : isComm
          ? [
              {
                title: t(CG + 'publicCommunity'),
                hint: t(CG + 'publicCommunityHint'),
                on: publicOn,
                set: (v) => {
                  advancedOpenState = v || advancedOpenState;
                  publicOn = v;
                },
              },
              { title: t(CG + 'historyTitle'), hint: t(CG + 'historyCommunityHint'), on: historyOn, set: (v) => (historyOn = v) },
            ]
          : [
              {
                title: t(CG + 'publicGroup'),
                hint: t(CG + 'publicGroupHint'),
                on: publicOn && isDiamond,
                locked: !isDiamond,
                disabled: !isDiamond,
                set: (v) => {
                  if (!isDiamond) return;
                  advancedOpenState = v || advancedOpenState;
                  publicOn = v;
                },
              },
              { title: t(CG + 'historyTitle'), hint: t(CG + 'historyHint'), on: historyOn, set: (v) => (historyOn = v) },
              disappearing,
            ],
  );

  // permissions list for the current sub-tab
  const permRows = $derived.by(() => {
    if (permSub === 0)
      return PERM_GROUPS.filter((g) => permList.some((x) => x.group === g)).map((g) => {
        const items = permList.filter((x) => x.group === g);
        return {
          label: t(PERM_GROUP_KEYS[g] ?? g).toUpperCase(),
          items: items.map((x, i) => {
            const cur = perms.general[x.key];
            return {
              label: t(x.key === 'edit' ? (isComm ? CG + 'perms.editCommunity' : CG + 'perms.edit') : x.label),
              master: false,
              last: i === items.length - 1,
              valueLabel: t(VALUE_LABEL[cur]),
              tone: cur === 'nobody' ? 'off' : 'set',
              open: (el: HTMLElement) => openPermMenu(el, 'general', x.key, false),
            };
          }),
        };
      });
    const scope: Scope = permSub === 2 ? 'threads' : 'messages';
    const set = perms[scope];
    const master = { label: t(CG + 'sendByDefault'), master: true, last: false, valueLabel: t(VALUE_LABEL[set.default as GroupRole]), tone: 'set', open: (el: HTMLElement) => openPermMenu(el, scope, 'default', false) };
    const content = CONTENT.map((c, i) => {
      const inherited = set[c.key] === INHERIT;
      const eff = (inherited ? set.default : set[c.key]) as GroupRole;
      return {
        label: t(c.label),
        master: false,
        last: i === CONTENT.length - 1,
        valueLabel: inherited ? t(CG + 'valueDefault', { value: t(VALUE_LABEL[eff]) }) : t(VALUE_LABEL[eff]),
        tone: inherited ? 'inherited' : 'set',
        open: (el: HTMLElement) => openPermMenu(el, scope, c.key, true),
      };
    });
    return [{ label: '', items: [master, ...content] }];
  });

  const permOptions = $derived(permMenu ? [...(permMenu.allowInherit ? [{ key: INHERIT as PermValue, label: CG + 'sameAsDefault' }] : []), ...ROLES] : []);

  // one running summary of the whole dialog, so no section hides its own state
  const footerNote = $derived(
    [
      nameOk ? t(CG + 'note.nameSet') : nameBad ? t(CG + 'note.nameNeeded') : null,
      isEmb ? (urlOk ? t(CG + 'note.urlSet') : urlBad ? t(CG + 'note.urlNeeded') : null) : null,
      isComm ? t(CG + 'note.channels', { count: channels.length }) : null,
      picked.length ? t(isChan ? CG + 'note.members' : CG + 'note.invites', { count: picked.length }) : null,
      isChan && invited.length ? t(CG + 'note.invites', { count: invited.length }) : null,
      gateCount ? t(CG + 'note.gates', { count: gateCount }) : null,
      rulesOn ? t(rulesText.trim() ? CG + 'note.rulesOn' : CG + 'note.rulesNeeded') : null,
      permsChanged ? t(CG + 'note.permissionsEdited') : null,
    ]
      .filter(Boolean)
      .join(' • '),
  );
  const showFooterNote = $derived(!!(nameOk || nameBad || picked.length || gateCount || rulesOn || permsChanged));
  const canCreate = $derived(nameOk && (!isEmb || urlOk));

  async function create() {
    if (creating) return;
    // pressing Create without a name sends the user back to the field that needs it
    if (!nameOk || (isEmb && !urlOk)) {
      nameTouched = true;
      urlTouched = isEmb;
      submitted = true;
      tab = 0;
      return;
    }
    // same for rules switched on but left blank
    if (!rulesOk && rulesTab >= 0) {
      submitted = true;
      tab = rulesTab;
      return;
    }
    const result: CreateGroupResult = {
        name: name.trim(),
        about,
        color,
        coverKey: cover,
        avatarFile,
        kind,
        embedded: isEmb,
        language: isComm ? lang : null,
        coverFile,
        channels: isComm ? [...channels] : [],
        url: url.trim(),
        previewForNonMembers: isEmb && publicOn && previewOn,
        isPublic: publicOn,
        visibleHistory: historyOn || (isChan && publicOn),
        disappearAfter: disappearOn ? after : null,
        members: [...picked],
        invites: isChan ? [...invited] : [],
        gates: gates ?? { count: 0 },
        rules: rulesOn ? { enabled: true, text: rulesText.trim() } : { enabled: false, text: '' },
        permissions: { general: { ...perms.general }, messages: { ...perms.messages }, threads: threadsOverride ? { ...perms.threads } : null },
    };
    // the dialog (and the whole form) stays until the host confirms
    creating = true;
    createError = false;
    try {
      await onCreate?.(result);
    } catch {
      createError = true;
      return;
    } finally {
      creating = false;
    }
    // animate out and stay hidden; the host unmounts the dialog once onCreate has resolved
    closing = true;
  }

  const nameHint = $derived(
    t(
      isChan
        ? nameOk
          ? CG + 'nameHint.channel'
          : CG + 'nameHint.channelRequired'
        : nameOk
          ? isComm
            ? CG + 'nameHint.community'
            : CG + 'nameHint.group'
          : isComm
            ? CG + 'nameHint.communityRequired'
            : CG + 'nameHint.groupRequired',
    ),
  );
  const kindIcon = $derived(isEmb ? 'embed' : isChan ? 'hash' : 'community');
</script>

{#snippet sectionLabel(text: string)}
  <span class="section-label">{text}</span>
{/snippet}

<div class="root" class:closing role="dialog" aria-modal="true" use:modal={() => close(onCancel)}>
  <div class="veil" onclick={() => close(onCancel)} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      <div class="head-row">
        <span class="kind-tile"><span class="kind-icon" style:mask={mask(kindIcon)}></span></span>
        <div class="head-text">
          <span class="head-title">{t(isComm ? CG + 'title.community' : isEmb ? CG + 'title.embedded' : isChan ? CG + 'title.channel' : CG + 'title.group')}</span>
          {#if isChan}<span class="head-sub">{t(CG + 'inCommunity', { community })}</span>{/if}
        </div>
        <span class="icon-button" onclick={() => close(onCancel)} role="button" tabindex="0" aria-label={t('ui.common.close')} title={t('ui.common.close')}><span class="icon-15" style:mask={mask('close')}></span></span>
      </div>
      <div class="tabs-row">
        <div class="cell grow">
          <SegmentedTabs
            labels={K.labels.slice(0, visibleKeys.length)}
            counts={visibleKeys.map((k) =>
              // the invite count sits on its tab so the total is visible from any section; nothing yet means no badge
              k === 'Invite' && picked.length + (isChan ? invited.length : 0)
                ? picked.length + (isChan ? invited.length : 0)
                : k === 'Gates' && gateCount
                  ? gateCount
                  : k === 'Channels' && channels.length
                    ? channels.length
                    : null,
            )}
            selectedIndex={tab}
            dotIndexes={[nameBad || urlBad ? 0 : null, rulesBad && advancedOpen && rulesTab >= 0 ? rulesTab : null].filter((i): i is number => i !== null)}
            onSelect={(i) => (tab = i)}
          />
        </div>
        <!-- only offered while the extra tabs are empty — collapsing with values set would hide settings already made -->
        {#if advancedOpen && !advancedTouched && advanced !== false}
          <span
            class="collapse"
            style:inset-inline-start="{(K.basic / K.keys.length) * 100}%"
            onclick={() => {
              advancedOpenState = false;
              tab = Math.min(tab, K.basic - 1);
            }}
            role="button"
            tabindex="0"
            aria-label={t(CG + 'hideExtra')}
            title={t(CG + 'hideExtra')}><span class="collapse-icon"></span></span
          >
        {/if}
        {#if !advancedOpen}
          <span class="more-options" onclick={() => (advancedOpenState = true)} role="button" tabindex="0">
            <span>{t(CG + 'moreOptions')}</span>
            <span class="more-icon"></span>
          </span>
        {/if}
      </div>
    </div>

    <div class="body">
      {#if current === 'Group'}
        <div class="details">
          {#if !isChan}
            <div class="cover" style:height={isComm ? '150px' : '112px'} style:background={coverUrl ? `url(${coverUrl}) center/cover no-repeat` : `var(--cover-${COVERS.includes(cover) ? cover : 'plum'})`}>
              <div class="cover-tools">
                <div class="cover-tools-inner">
                  <input
                    class="hidden-input"
                    bind:this={coverInput}
                    type="file"
                    accept="image/*"
                    oninput={(e) => {
                      const file = e.currentTarget.files?.[0];
                      if (file) setCover(file);
                    }}
                  />
                  <span class="cover-upload" onclick={() => coverInput?.click()} role="button" tabindex="0"><span class="cover-edit" style:mask={mask('edit')}></span>{t(coverUrl ? CG + 'changeCover' : CG + 'uploadCover')}</span>
                  <div class="swatches">
                    {#each COVERS as key}
                      <span
                        class="swatch"
                        style:background="var(--cover-{key})"
                        style:box-shadow={ring(key === cover)}
                        onclick={() => {
                          cover = key;
                          setCover(null);
                        }}
                        role="button"
                        tabindex="0"
                        aria-label={t(colourName(key))}
                        title={t(colourName(key))}
                      ></span>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <div class="page">
            <div class="column wide-gap">
              <div class="photo-row">
                <div class="photo" class:lifted={!isChan}>
                  <div class="photo-frame" class:round={isChan} style:background={GRADIENTS[color] ?? GRADIENTS.teal}>
                    <div class="photo-image" style:background={avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : 'none'}></div>
                  </div>
                  <input
                    class="hidden-input"
                    bind:this={avatarInput}
                    type="file"
                    accept="image/*"
                    oninput={(e) => {
                      const f = e.currentTarget.files?.[0];
                      if (f) setAvatar(f);
                    }}
                  />
                  <div class="photo-pick" onclick={() => avatarInput?.click()} role="button" tabindex="0"><span class="icon-15 ink" style:mask={mask('edit')}></span></div>
                </div>
                <div class="photo-text">
                  <span class="photo-title">{t(isChan ? CG + 'photo.channel' : isComm ? CG + 'photo.community' : CG + 'photo.group')}</span>
                  <div class="photo-line">
                    <span class="photo-hint">{t(CG + 'photo.hint')}</span>
                    <span class="grow"></span>
                    {#if avatarUrl}
                      <span
                        class="remove-photo"
                        onclick={() => setAvatar(null)}
                        role="button"
                        tabindex="0">{t(CG + 'photo.remove')}</span
                      >
                    {/if}
                    {#each Object.entries(GRADIENTS) as [key, gradient]}
                      <span class="swatch flex-none" style:background={gradient} style:box-shadow={ring(key === color)} onclick={() => (color = key)} role="button" tabindex="0" aria-label={t(colourName(key))} title={t(colourName(key))}></span>
                    {/each}
                  </div>
                </div>
              </div>

              <div class="field-block">
                <div class="field-label-row">
                  <span class="field-label">{t(isChan ? CG + 'name.channel' : isComm ? CG + 'name.community' : CG + 'name.group')}</span>
                  <span class="required">*</span>
                </div>
                <div class="input-box" class:bad={nameBad}>
                  {#if isChan}<span class="hash">#</span>{/if}
                  <input
                    value={name}
                    oninput={(e) => {
                      name = isChan ? slug(e.currentTarget.value) : e.currentTarget.value;
                      nameTouched = true;
                    }}
                    placeholder={t(isChan ? CG + 'name.channelPlaceholder' : isComm ? CG + 'name.community' : CG + 'name.group')}
                    maxlength={NAME_MAX}
                  />
                  <span class="name-left" class:low={NAME_MAX - name.length <= 5}>{NAME_MAX - name.length}</span>
                </div>
                <span class="hint" class:bad={nameBad}>{nameHint}</span>
              </div>

              {#if isComm}
                <div class="field-block language">
                  <span class="field-label">{t(CG + 'language')}</span>
                  <div
                    class="input-box select"
                    class:open={langOpen}
                    onclick={() => {
                      langOpen = !langOpen;
                      langQuery = '';
                    }}
                    role="button"
                    tabindex="0"
                  >
                    <span class="select-value">{lang}</span>
                    <span class="select-chevron" class:open={langOpen}></span>
                  </div>
                  <span class="hint">{t(CG + 'languageHint')}</span>
                  {#if langOpen}
                    <div class="catcher" onclick={() => (langOpen = false)} role="presentation"></div>
                    <div class="dropdown">
                      <div class="cell flex-none"><Field placeholder={t(CG + 'searchLanguages')} value={langQuery} onInput={(e) => (langQuery = e.currentTarget.value)} onClear={() => (langQuery = '')} showShortcut={false} /></div>
                      <div class="dropdown-list">
                        {#each languages as l}
                          <div
                            class="option"
                            class:selected={l === lang}
                            onclick={() => {
                              lang = l;
                              langOpen = false;
                            }}
                            tabindex="0"
                            role="option"
                            aria-selected={l === lang}
                          >
                            <span class="option-label">{l}</span>
                            <span class="option-check"></span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}

              {#if isEmb}
                <div class="field-block">
                  <div class="field-label-row">
                    <span class="field-label">{t(CG + 'externalUrl')}</span>
                    <span class="required">*</span>
                  </div>
                  <div class="input-box" class:bad={urlBad}>
                    <input
                      class="mono"
                      value={url}
                      oninput={(e) => {
                        url = e.currentTarget.value;
                        urlTouched = true;
                      }}
                      placeholder="https://"
                    />
                  </div>
                  <span class="hint url-hint" class:bad={urlBad}>{t(urlBad ? CG + 'urlBad' : CG + 'urlHint')}</span>
                </div>
              {/if}

              <div class="field-block">
                <div class="field-label-row wide">
                  <span class="field-label">{t(CG + 'description')}</span>
                  <span class="optional">{t(CG + 'optional')}</span>
                </div>
                <div class="cell">
                  <TextArea
                    value={about}
                    onInput={(e) => (about = e.currentTarget.value)}
                    placeholder={t(isChan ? CG + 'aboutPlaceholder.channel' : isComm ? CG + 'aboutPlaceholder.community' : CG + 'aboutPlaceholder.group')}
                    maxLength={ABOUT_MAX}
                    minHeight={49}
                  />
                </div>
              </div>

              <div class="list-block">
                {@render sectionLabel(t(CG + 'settings'))}
                <div class="list">
                  {#each switches as s, i}
                    <div class="switch-row" class:last={i === switches.length - 1}>
                      {#if s.timed}
                        <div class="cell">
                          <TimedToggle density="flush" label={s.title} on={s.on} value={after} offHint={t(CG + 'disappearingOff')} defaultOpen={true} stayOpen={true} onChange={s.set} onDurationChange={(label) => (after = label)} />
                        </div>
                      {:else}
                        <div class="switch-line">
                          <div class="switch-text">
                            <span class="switch-title">{s.title}</span>
                            <span class="switch-hint">{s.hint}</span>
                          </div>
                          <div class="toggle-cell"><Toggle on={s.on} disabled={!!s.disabled} onChange={s.set} /></div>
                        </div>
                      {/if}
                      {#if s.locked}
                        <UpgradeBanner text={t(CG + 'diamondOnly')} {onUpgrade} />
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if current === 'Invite'}
        <div class="centered">
          <div class="column mid-gap">
            {#if isChan}
              <div class="list-block small-gap">
                <div class="cell">
                  <SegmentedTabs
                    labels={[CG + 'addFromCommunity', CG + 'invitePeople']}
                    counts={[picked.length || null, invited.length || null]}
                    selectedIndex={memberMode}
                    dotIndexes={[]}
                    onSelect={(i) => {
                      memberMode = i;
                      query = '';
                    }}
                  />
                </div>
                <span class="mode-hint">{inviting ? t(CG + 'inviteHint') : t(CG + 'addHint', { community })}</span>
              </div>
            {/if}

            <div class="cell">
              <Field
                placeholder={inviting ? t(CG + 'searchPeople') : isChan ? t(CG + 'searchMembersOf', { community }) : t(CG + 'searchPeople')}
                value={query}
                onInput={(e) => (query = e.currentTarget.value)}
                onClear={() => (query = '')}
                showShortcut={false}
              />
            </div>

            <div class="picked-block">
              <div class="picked-head">
                <span class="small-label">{t(isChan && !inviting ? CG + 'addedCount' : CG + 'invitedCount', { count: active.length })}</span>
                <span class="grow"></span>
                {#if active.length > 0}
                  <span
                    class="clear-all"
                    onclick={() => {
                      if (inviting) invited = [];
                      else picked = [];
                    }}
                    role="button"
                    tabindex="0">{t(CG + 'clearAll')}</span
                  >
                {/if}
              </div>
              {#if active.length > 0}
                <div class="chips">
                  {#each active as handle}
                    {@const person = modePool.find((p) => p.handle === handle)}
                    <span class="person-chip">
                      <span class="chip-face" style:background={GRADIENTS[person?.color ?? 'violet'] ?? GRADIENTS.violet}></span>
                      <span class="chip-handle">{person?.handle ?? handle}</span>
                      <span class="chip-remove" onclick={() => toggleHandle(handle)} role="button" tabindex="0"><span class="chip-remove-icon"></span></span>
                    </span>
                  {/each}
                </div>
              {:else}
                <span class="none-picked"
                  >{isChan
                    ? inviting
                      ? t(CG + 'noneInvited')
                      : t(CG + 'noneAdded')
                    : t(CG + 'noneYet')}</span
                >
              {/if}
            </div>

            <div class="divider"></div>

            <div class="list-block small-gap">
              <span class="small-label padded">{needle ? t(CG + 'searchResults') : isChan && !inviting ? t(CG + 'membersOf', { community: community.toUpperCase() }) : t(CG + 'frequent')}</span>
              <div class="people">
                {#each listed as u}
                  {@const sel = active.includes(u.handle)}
                  <div class="person" class:selected={sel} onclick={() => toggleHandle(u.handle)} role="button" tabindex="0">
                    <span class="person-face" style:background={GRADIENTS[u.color] ?? GRADIENTS.violet}></span>
                    <div class="person-text">
                      <span class="person-name">{u.name}</span>
                      <span class="person-handle">{u.handle}</span>
                    </div>
                    <span class="person-add"><span class="person-add-icon" style:mask={mask(sel ? 'check' : 'plus')}></span></span>
                  </div>
                {/each}
              </div>
              {#if needle && listed.length === 0}
                <span class="no-results">{t(CG + 'noPeople', { query })}</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if current === 'Channels'}
        <div class="centered">
          <div class="column mid-gap">
            <div class="list-block tight">
              <div class="channels-head">
                <span class="big-title">{t(CG + 'channels.title')}</span>
                {#if channels.length > 1}
                  <span
                    class="remove-all"
                    onclick={() => {
                      channels = [];
                      chanEdit = null;
                      chanMenu = null;
                    }}
                    role="button"
                    tabindex="0">{t(CG + 'channels.removeAll')}</span
                  >
                {/if}
              </div>
              <span class="lead">{t(CG + 'channels.lead')}</span>
            </div>

            <div class="channel-list">
              {#each channels as channel, i}
                {@const editing = chanEdit === i}
                <div class="channel" class:editing class:dup={editing && editDup}>
                  <span class="channel-hash">#</span>
                  {#if editing}
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                      class="channel-input"
                      value={chanEditValue}
                      oninput={(e) => (chanEditValue = slug(e.currentTarget.value, CHAN_MAX))}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveChannelEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          chanEdit = null;
                        }
                      }}
                      maxlength={CHAN_MAX}
                      autofocus={true}
                    />
                    <span class="channel-save" onclick={saveChannelEdit} role="button" tabindex="0">{t('ui.common.save')}</span>
                    <span class="channel-cancel" onclick={() => (chanEdit = null)} role="button" tabindex="0">{t('ui.common.cancel')}</span>
                  {:else}
                    <span class="channel-name">{channel}</span>
                    <span class="kebab" class:open={chanMenu === i} onclick={() => (chanMenu = chanMenu === i ? null : i)} aria-label={t('ui.common.moreOptions')} role="button" tabindex="0" title={t('ui.common.moreOptions')}
                      ><span class="kebab-icon"></span></span
                    >
                  {/if}
                  {#if chanMenu === i}
                    <div class="catcher" onclick={() => (chanMenu = null)} role="presentation"></div>
                    <div class="channel-menu"><Menu minWidth="180px" items={channelMenu(i, channel)} /></div>
                  {/if}
                </div>
              {/each}
              {#if channels.length === 0}
                <span class="no-channels">{t(CG + 'channels.empty')}</span>
              {/if}
            </div>

            <div class="field-block">
              <span class="field-label">{t(CG + 'channels.add')}</span>
              <div class="add-row">
                <div class="add-box" class:bad={draftDup || (chanTried && !chanDraft)} class:filled={!!chanDraft}>
                  <span class="hash">#</span>
                  <input
                    value={chanDraft}
                    oninput={(e) => {
                      chanDraft = slug(e.currentTarget.value, CHAN_MAX);
                      chanTried = false;
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addChannel();
                      }
                    }}
                    placeholder={t(CG + 'name.channelPlaceholder')}
                    maxlength={CHAN_MAX}
                  />
                  <span class="name-left">{CHAN_MAX - chanDraft.length}</span>
                </div>
                <span class="add-button" class:ready={draftOk} onclick={addChannel} role="button" tabindex="0"><span class="add-icon"></span>{t('ui.common.add')}</span>
              </div>
              <span class="hint plain" class:bad={draftDup || (chanTried && !chanDraft)}
                >{draftDup ? t(CG + 'channels.duplicate', { name: chanDraft }) : chanTried && !chanDraft ? t(CG + 'channels.needsName') : t(CG + 'channels.hint')}</span
              >
            </div>
          </div>
        </div>
      {/if}

      {#if current === 'Gates'}
        <div class="gates-page">
          <div class="gates-column">
            <div class="info">
              <span class="info-icon"></span>
              <span class="info-text"><Translate key={CG + 'gatesInfo'} params={{ kind: isComm ? 'community' : isChan ? 'channel' : 'group' }}>{#snippet strong()}<span class="info-strong">{t(CG + 'gatesInfoStrong')}</span>{/snippet}</Translate></span>
            </div>
            <!-- the draft, not a prop: the builder unmounts on tab switch and must return showing the edits, which are also what Create submits -->
            <AccessGates {isDiamond} {onUpgrade} value={gates} onChange={(g) => (gates = g)} />
          </div>
        </div>
      {/if}

      {#if current === 'Rules'}
        <div class="centered">
          <div class="column huge-gap">
            <div class="switch-line">
              <div class="switch-text">
                <span class="switch-title">{t(CG + 'rules.enable')}</span>
                <span class="switch-hint">{t(CG + 'rules.enableHint')}</span>
              </div>
              <div class="toggle-cell"><Toggle on={rulesOn} onChange={(on) => (rulesOn = on)} /></div>
            </div>

            {#if rulesOn}
              <div class="list-block small-gap">
                {@render sectionLabel(t(CG + 'rules.templates'))}
                <div class="templates">
                  {#each RULE_TEMPLATES as tpl}
                    <div
                      class="template"
                      class:selected={rulesPreset === tpl.key}
                      onclick={() => {
                        rulesPreset = tpl.key;
                        rulesText = tpl.rules
                          .map((r, i) => `${i + 1}. ${t(r)}`)
                          .join('\n')
                          .slice(0, RULES_MAX);
                      }}
                      role="button"
                      tabindex="0"
                    >
                      <span class="template-label">{t(tpl.label)}</span>
                      <span class="template-desc">{t(tpl.desc)}</span>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="list-block small-gap">
                <div class="rules-head">
                  {@render sectionLabel(t(CG + 'rules.label'))}
                  <span class="grow"></span>
                  {#if rulesText}
                    <span
                      class="text-action"
                      onclick={() => {
                        rulesText = '';
                        rulesPreset = null;
                      }}
                      role="button"
                      tabindex="0">{t(CG + 'rules.clear')}</span
                    >
                  {/if}
                </div>
                <div class="cell">
                  <TextArea
                    value={rulesText}
                    onInput={(e) => {
                      rulesText = e.currentTarget.value;
                      rulesPreset = null;
                    }}
                    placeholder={t(CG + 'rules.placeholder')}
                    maxLength={RULES_MAX}
                    minHeight={162}
                    help={t(CG + 'rules.help')}
                    error={rulesBad}
                    errorText={t(CG + 'rules.error')}
                  />
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if current === 'Permissions'}
        <div class="centered">
          <div class="column mid-gap">
            <div class="perm-intro">
              <span class="switch-title">{t(CG + 'permissions.title')}</span>
              <span class="switch-hint">{t(CG + 'permissions.hint')}</span>
            </div>

            <div class="cell">
              <SegmentedTabs
                labels={[CG + 'permissions.general', CG + 'permissions.messages', CG + 'permissions.threads']}
                counts={[generalChanged || null, msgExceptions || null, threadsOverride ? thrExceptions || null : null]}
                selectedIndex={permSub}
                dotIndexes={[]}
                onSelect={(i) => {
                  permSub = i;
                  permMenu = null;
                }}
              />
            </div>

            {#if permsChanged > 0}
              <div class="changed">
                <span class="changed-text">{t(CG + 'permissions.changed', { count: permsChanged })}</span>
                <span
                  class="text-action"
                  onclick={() => {
                    perms = defaultPerms();
                    threadsOverride = false;
                    permMenu = null;
                  }}
                  role="button"
                  tabindex="0">{t(CG + 'permissions.reset')}</span
                >
              </div>
            {/if}

            {#if permSub === 2}
              <div class="thread-switch">
                <div class="switch-text">
                  <span class="switch-title small">{t(CG + 'permissions.threadsOverride')}</span>
                  <span class="switch-hint">{t(threadsOverride ? CG + 'permissions.threadsOwn' : CG + 'permissions.threadsFollow')}</span>
                </div>
                <div class="toggle-cell">
                  <Toggle
                    on={threadsOverride}
                    onChange={(on) => {
                      threadsOverride = on;
                      permMenu = null;
                    }}
                  />
                </div>
              </div>
            {/if}

            {#if permSub !== 2 || threadsOverride}
              {#each permRows as group}
                <div class="list-block tight">
                  {#if group.label}{@render sectionLabel(group.label)}{/if}
                  <div class="perm-list">
                    {#each group.items as p}
                      <div class="perm-row" class:last={p.last}>
                        <span class="perm-label" class:master={p.master}>{p.label}</span>
                        <span class="perm-pill {p.tone}" onclick={(e) => p.open(e.currentTarget)} role="button" tabindex="0">
                          <span class="perm-value">{p.valueLabel}</span>
                          <span class="perm-chevron"></span>
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            {/if}

            {#if permSub === 2 && !threadsOverride}
              <div class="inherited">
                <span class="inherited-title">{t(CG + 'permissions.inheritedTitle')}</span>
                <span class="inherited-hint">{t(CG + 'permissions.inheritedHint')}</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="footer">
      <span class="cancel" onclick={() => close(onCancel)} role="button" tabindex="0">{t('ui.common.cancel')}</span>
      <span class="grow"></span>
      {#if createError}
        <span class="note error" role="alert">{t(CG + 'createFailed')}</span>
      {:else if showFooterNote}
        <span class="note" class:error={nameBad || rulesBad || urlBad}>{footerNote}</span>
      {/if}
      <div class="create" class:ready={canCreate && !creating} onclick={create} role="button" tabindex="0" aria-disabled={creating}>
        <span class="create-icon" style:mask={mask(kindIcon)}></span>
        <span>{t(creating ? CG + 'creating' : isComm ? CG + 'create.community' : isEmb ? CG + 'create.embedded' : isChan ? CG + 'create.channel' : CG + 'create.group')}</span>
      </div>
    </div>
  </div>

  {#if permMenu}
    {@const selected = perms[permMenu.scope][permMenu.key]}
    <div class="menu-layer">
      <div class="menu-catch" onclick={() => (permMenu = null)} aria-hidden="true"></div>
      <!-- hidden for the one frame between mount and measurement, so it never paints mis-placed -->
      <div class="perm-menu" bind:this={permPanel} style:top={permMenu.top} style:left={permMenu.left} style:visibility={permMenu.measured ? 'visible' : 'hidden'} role="menu" aria-label={t(CG + 'permMenu.label')}>
        <span class="perm-menu-hint">{t(permMenu.allowInherit ? CG + 'permMenu.whoCanSend' : CG + 'permMenu.lowestRole')}</span>
        {#each permOptions as o}
          <div class="perm-option" class:selected={o.key === selected} onclick={() => permMenu && setPerm(permMenu.scope, permMenu.key, o.key)} role="button" tabindex="0">
            <span class="perm-dot"><span class="perm-tick"></span></span>
            <span class="perm-option-label">{t(o.label)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .root {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 780px;
    height: 740px;
    max-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  .root.closing {
    pointer-events: none;
  }

  .closing .veil {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .head-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
  }

  .kind-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .kind-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-2, #b9b9c6);
  }

  .head-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .head-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .head-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .icon-15 {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
  }

  .icon-15.ink {
    background: var(--ink, #ececf1);
  }

  .tabs-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .grow {
    flex: 1;
  }

  .flex-none {
    flex: none;
  }

  .collapse {
    position: absolute;
    z-index: 3;
    inset-block-start: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    background: var(--surface-2, #17171d);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.16)),
      0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    user-select: none;
  }

  .collapse:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.12));
  }

  .collapse-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .more-options {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-10) var(--space-12);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .more-options:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    color: var(--ink-2, #c9c9d4);
  }

  .more-icon {
    flex: none;
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--space-32) var(--space-18);
    display: flex;
    flex-direction: column;
    gap: var(--space-32);
  }

  .details {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin-block: calc(var(--space-32) * -1);
    margin-inline: calc(var(--space-18) * -1);
  }

  .cover {
    position: relative;
    flex: none;
  }

  .cover-tools {
    position: absolute;
    inset-block-start: 12px;
    inset-inline: 0;
    display: flex;
    justify-content: center;
    padding-inline: var(--space-18);
  }

  .cover-tools-inner {
    width: 100%;
    max-width: 600px;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-8);
  }

  .hidden-input {
    display: none;
  }

  .cover-upload {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 36px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    background: var(--on-cover-bg);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .cover-upload:hover {
    background: var(--on-cover-bg-hover);
  }

  .cover-edit {
    width: 14px;
    height: 14px;
    background: var(--ink);
  }

  .swatches {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    margin-inline-end: calc(var(--space-6) * -1);
    padding: var(--space-6);
    border-radius: var(--radius-md);
    background: var(--on-cover-bg);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 38%;
    cursor: pointer;
  }

  .page {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-22) var(--space-18) var(--space-32);
  }

  .centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .column {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .wide-gap {
    gap: var(--space-26);
  }

  .mid-gap {
    gap: var(--space-22);
  }

  .huge-gap {
    gap: var(--space-32);
  }

  .photo-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-16);
    min-width: 0;
  }

  .photo {
    position: relative;
    flex: none;
    width: 96px;
    height: 96px;
    margin-block-start: 0px;
  }

  .photo.lifted {
    margin-block-start: -64px;
  }

  .photo-frame {
    width: 96px;
    height: 96px;
    box-sizing: border-box;
    border: 5px solid var(--surface-1, #0e0e12);
    border-radius: 34%;
  }

  .photo-image {
    width: 100%;
    height: 100%;
    border-radius: 34%;
  }

  .photo-frame.round,
  .round .photo-image {
    border-radius: 50%;
  }

  .photo-pick {
    position: absolute;
    inset-inline-end: -2px;
    inset-block-end: -2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-pill);
    background: var(--surface-2, #17171d);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.14)),
      0 4px 12px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }

  .photo-pick:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .photo-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .photo-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .photo-line {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .photo-hint {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .remove-photo {
    flex: none;
    padding: var(--space-4) var(--space-10);
    border-radius: var(--radius-sm);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    font: var(--weight-semibold) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
    user-select: none;
  }

  .remove-photo:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  .field-block.language {
    position: relative;
  }

  .field-label-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-6);
  }

  .field-label-row.wide {
    gap: var(--space-8);
  }

  .field-label,
  .required {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .required {
    color: var(--accent, #ff5672);
  }

  .optional {
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .input-box {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: 0 var(--space-16);
    height: 52px;
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .input-box.bad {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .input-box input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .input-box input.mono {
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-mono);
  }

  .hash {
    flex: none;
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .input-box .hash {
    margin-inline-end: calc(var(--space-8) * -1);
  }

  .name-left {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .name-left.low {
    color: var(--status-warning, #ffb03d);
  }

  .hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .hint.url-hint {
    line-height: 1.45;
  }

  .hint.plain {
    text-wrap: initial;
  }

  .hint.bad {
    color: var(--status-danger, #f5493d);
  }

  .select {
    cursor: pointer;
    user-select: none;
  }

  .select.open {
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .select-value {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .select-chevron {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .select-chevron.open {
    transform: rotate(180deg);
  }

  .catcher {
    position: fixed;
    inset: 0;
    z-index: 19;
  }

  .dropdown {
    position: absolute;
    inset-inline: 0;
    top: 84px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-height: 300px;
    padding: var(--space-8);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-panel, 0 8px 24px rgba(0, 0, 0, 0.35));
  }

  .dropdown-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: 40px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .option.selected {
    background: color-mix(in srgb, var(--accent, #ff5672) 10%, transparent);
  }

  .option:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .option-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .selected .option-label {
    color: var(--accent-bright, #ff8298);
  }

  .option-check {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--accent, #ff5672);
    mask: var(--icon-check) center/contain no-repeat;
    opacity: 0;
  }

  .selected .option-check {
    opacity: 1;
  }

  .list-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
  }

  .list-block.small-gap {
    gap: var(--space-10);
  }

  .list-block.tight {
    gap: var(--space-8);
  }

  .section-label,
  .small-label {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .small-label.padded {
    padding-inline-start: var(--space-10);
  }

  .list {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    overflow: hidden;
  }

  .switch-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    min-width: 0;
    padding: var(--space-16);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .switch-row.last {
    border-block-end-color: transparent;
  }

  .switch-line {
    display: flex;
    align-items: flex-start;
    gap: var(--space-16);
    min-width: 0;
  }

  .switch-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .switch-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .switch-title.small {
    font-size: var(--text-md);
  }

  .switch-hint {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .toggle-cell {
    flex: none;
    display: flex;
  }

  .mode-hint,
  .none-picked {
    padding-inline: var(--space-10);
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .picked-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    min-width: 0;
  }

  .picked-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    min-width: 0;
    padding-inline: var(--space-10);
  }

  .clear-all {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    min-width: 0;
  }

  .person-chip {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 4px var(--space-10) 4px 4px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--status-verified, #3d9bff) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-verified, #3d9bff) 34%, transparent);
  }

  .chip-face {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-pill);
  }

  .chip-handle {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    white-space: nowrap;
  }

  .chip-remove {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .chip-remove-icon {
    width: 11px;
    height: 11px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .divider {
    height: 1px;
    background: var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .people {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .person {
    --add-bg: var(--overlay-2, rgba(255, 255, 255, 0.07));
    --add-line: var(--line-2, rgba(255, 255, 255, 0.12));
    --add-ink: var(--ink-3, #9a9aa8);
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: 7px var(--space-8);
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
  }

  .person.selected {
    --add-bg: var(--accent, #ff5672);
    --add-line: var(--accent, #ff5672);
    --add-ink: var(--on-accent, #2e0512);
    background: color-mix(in srgb, var(--accent, #ff5672) 8%, transparent);
  }

  .person:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .person-face {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-pill);
  }

  .person-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .person-name,
  .person-handle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .person-name {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .person-handle {
    font: var(--weight-regular) var(--text-sm) / 1.25 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .person-add {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-pill);
    background: var(--add-bg);
    box-shadow: inset 0 0 0 1px var(--add-line);
  }

  .person-add-icon {
    width: 14px;
    height: 14px;
    background: var(--add-ink);
  }

  .no-results {
    padding: var(--space-14) var(--space-10);
    font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .channels-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
  }

  .big-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-2xl) / 1.3 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
  }

  .remove-all {
    flex: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--status-danger, #f5493d);
    cursor: pointer;
    user-select: none;
  }

  .lead {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  .channel-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }

  .channel {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 56px;
    padding: 0 var(--space-8) 0 var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .channel.editing {
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .channel.dup {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .channel-hash {
    flex: none;
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
  }

  .channel-input {
    flex: 1;
    min-width: 0;
    height: 40px;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .channel-save,
  .channel-cancel {
    flex: none;
    display: flex;
    align-items: center;
    height: 32px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .channel-save {
    padding: 0 var(--space-12);
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .channel-cancel {
    padding: 0 var(--space-10);
    color: var(--ink-2, #c9c9d4);
  }

  .channel-cancel:hover,
  .kebab:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .channel-name {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kebab {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
  }

  .kebab.open {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .kebab-icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-kebab) center/contain no-repeat;
  }

  .channel-menu {
    position: absolute;
    inset-inline-end: var(--space-8);
    top: calc(100% - 4px);
    z-index: 20;
    display: grid;
    grid-template-columns: max-content;
  }

  .no-channels {
    padding: var(--space-14) var(--space-4);
    font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .add-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .add-box {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 48px;
    padding: 0 var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.08));
  }

  .add-box.filled {
    box-shadow: inset 0 0 0 1px var(--line-3, rgba(255, 255, 255, 0.22));
  }

  .add-box.bad {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .add-box input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .add-button {
    --add-ink: var(--ink-4, #7c7c8c);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 48px;
    padding: 0 var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--add-ink);
    cursor: not-allowed;
    user-select: none;
  }

  .add-button.ready {
    --add-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
    cursor: pointer;
  }

  .add-icon {
    width: 15px;
    height: 15px;
    background: var(--add-ink);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .gates-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    min-width: 0;
  }

  .gates-column {
    width: 100%;
    max-width: 600px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-18);
    min-width: 0;
  }

  .info {
    display: flex;
    align-items: flex-start;
    gap: var(--space-10);
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .info-icon {
    flex: none;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-info) center/contain no-repeat;
  }

  .info-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
  }

  .info-strong {
    font-weight: var(--weight-semibold);
    color: var(--status-chit, #ff9f45);
  }

  .templates {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-10);
    min-width: 0;
  }

  .template {
    --template-ink: var(--ink, #e4e4ec);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
    min-height: 86px;
    padding: var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    cursor: pointer;
    user-select: none;
  }

  .template.selected {
    --template-ink: var(--accent, #ff5672);
    background: color-mix(in oklch, var(--accent, #ff5672) 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 45%, transparent);
  }

  .template:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
  }

  .template-label {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--template-ink);
  }

  .template-desc {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .rules-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    min-width: 0;
  }

  .text-action {
    flex: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .changed .text-action {
    line-height: 1.4;
  }

  .text-action:hover {
    color: var(--accent-bright, #ff8298);
  }

  .perm-intro {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .changed {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-10) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--accent, #ff5672) 34%, transparent);
  }

  .changed-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .thread-switch {
    display: flex;
    align-items: flex-start;
    gap: var(--space-14);
    min-width: 0;
    padding: var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .perm-list {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .perm-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: 11px var(--space-14);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .perm-row.last {
    border-block-end-color: transparent;
  }

  .perm-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .perm-label.master {
    font-weight: var(--weight-semibold);
    color: var(--ink, #e4e4ec);
  }

  .perm-pill {
    --pill-ink: var(--accent-bright, #ff8298);
    flex: none;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: var(--space-6) var(--space-10);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--accent, #ff5672) 12%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #ff5672) 34%, transparent);
    cursor: pointer;
    user-select: none;
  }

  .perm-pill.off {
    --pill-ink: var(--ink-3, #9a9aa8);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .perm-pill.inherited {
    --pill-ink: var(--ink-4, #7c7c8c);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .perm-pill:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .perm-value {
    font: var(--weight-semibold) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--pill-ink);
    white-space: nowrap;
  }

  .perm-chevron {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--pill-ink);
    mask: var(--icon-chevron-down) center/contain no-repeat;
  }

  .inherited {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-26) var(--space-18);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    border: 1px dashed var(--line-2, rgba(255, 255, 255, 0.14));
  }

  .inherited-title {
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .inherited-hint {
    max-width: 340px;
    text-align: center;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .footer {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-18);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .cancel {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .cancel:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .note {
    margin-inline-end: var(--space-8);
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .note.error {
    color: var(--status-danger, #f5493d);
  }

  .create {
    --create-ink: var(--ink-4, #7c7c8c);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: var(--control-lg, 40px);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--create-ink);
    cursor: not-allowed;
    user-select: none;
  }

  .create.ready {
    --create-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
    cursor: pointer;
  }

  .create:hover {
    filter: brightness(1.08);
  }

  .create-icon {
    width: 17px;
    height: 17px;
    background: var(--create-ink);
  }

  .menu-layer {
    position: fixed;
    inset: 0;
    z-index: 60;
  }

  .menu-catch {
    position: absolute;
    inset: 0;
  }

  .perm-menu {
    position: absolute;
    width: 238px;
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

  .perm-menu-hint {
    padding: var(--space-6) var(--space-8) var(--space-8);
    font: var(--weight-regular) var(--text-xs) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .perm-option {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
    padding: var(--space-8);
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
  }

  .perm-option.selected {
    background: color-mix(in srgb, var(--accent, #ff5672) 12%, transparent);
  }

  .perm-option:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .perm-dot {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--line-2, rgba(255, 255, 255, 0.16));
  }

  .selected .perm-dot {
    background: var(--accent, #ff5672);
    box-shadow: inset 0 0 0 1.5px var(--accent, #ff5672);
  }

  .perm-tick {
    width: 10px;
    height: 10px;
    background: transparent;
    mask: var(--icon-check) center/contain no-repeat;
  }

  .selected .perm-tick {
    background: var(--on-accent, #2e0512);
  }

  .perm-option-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .perm-option.selected .perm-option-label {
    font-weight: var(--weight-semibold);
    color: var(--accent-bright, #ff8298);
  }
</style>

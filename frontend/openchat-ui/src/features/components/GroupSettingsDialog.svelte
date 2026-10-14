<!-- Group settings, one commit for the whole group: Group (cover, photo, name, description, public / history /
     disappearing switches), Gates (AccessGates), Rules (switch, templates, text) and Permissions (general, messages,
     threads; each set to the lowest role that has it, picked from a popover). Save is enabled once something changed;
     a blocked save jumps to the tab that needs attention.
     embedded: the Overview page of a Manage dialog — no tab strip (the host's `section` picks the page), stays open
     after saving, and Cancel becomes "Discard changes". embedded + readOnly: Overview turns into an About page and the
     other pages show their values as plain On/Off facts. -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import { durationText } from '../../lib/i18n';
  import { onDestroy, untrack } from 'svelte';
  import type { AccessGatesState, GroupRole, GroupSettings } from '../../lib/types';
  import AccessGates from './AccessGates.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TextArea from '../../lib/components/TextArea.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import UpgradeBanner from './UpgradeBanner.svelte';
  import { modal } from '../../lib/behaviours/modal';

  type Section = 'group' | 'gates' | 'rules' | 'permissions';
  type Scope = 'general' | 'messages' | 'threads';
  type PermValue = GroupRole | 'inherit';
  type Perms = { general: Record<string, GroupRole>; messages: Record<string, PermValue>; threads: Record<string, PermValue> };

  const TABS = ['ui.groupSettingsDialog.tabGroup', 'ui.groupSettingsDialog.tabGates', 'ui.groupSettingsDialog.tabRules', 'ui.groupSettingsDialog.tabPermissions'];
  const TAB_KEYS: Section[] = ['group', 'gates', 'rules', 'permissions'];
  const NAME_MAX = 40;
  const ABOUT_MAX = 500;
  const RULES_MAX = 1000;

  const GRADIENTS: Record<string, { label: string; value: string }> = {
    teal: { label: 'ui.groupSettingsDialog.colour.teal', value: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
    violet: { label: 'ui.groupSettingsDialog.colour.violet', value: 'linear-gradient(140deg,#ff5f9e,#6a2bff)' },
    amber: { label: 'ui.groupSettingsDialog.colour.amber', value: 'linear-gradient(140deg,#ffb03d,#ff4d4d)' },
    blue: { label: 'ui.groupSettingsDialog.colour.blue', value: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)' },
  };
  // swatches are the theme's --cover-<key> tokens
  const COVERS: Record<string, string> = { plum: 'ui.groupSettingsDialog.colour.plum', teal: 'ui.groupSettingsDialog.colour.teal', violet: 'ui.groupSettingsDialog.colour.violet', amber: 'ui.groupSettingsDialog.colour.amber', slate: 'ui.groupSettingsDialog.colour.slate' };

  // labels, descriptions and rules are resource keys; a template's rules are translated when inserted
  const RULE_TEMPLATES = [
    { key: 'standard', label: 'ui.groupSettingsDialog.template.standard.label', desc: 'ui.groupSettingsDialog.template.standard.desc', rules: ['ui.groupSettingsDialog.template.standard.rule1', 'ui.groupSettingsDialog.template.standard.rule2', 'ui.groupSettingsDialog.template.standard.rule3'] },
    { key: 'trading', label: 'ui.groupSettingsDialog.template.trading.label', desc: 'ui.groupSettingsDialog.template.trading.desc', rules: ['ui.groupSettingsDialog.template.trading.rule1', 'ui.groupSettingsDialog.template.trading.rule2', 'ui.groupSettingsDialog.template.trading.rule3'] },
    { key: 'support', label: 'ui.groupSettingsDialog.template.support.label', desc: 'ui.groupSettingsDialog.template.support.desc', rules: ['ui.groupSettingsDialog.template.support.rule1', 'ui.groupSettingsDialog.template.support.rule2', 'ui.groupSettingsDialog.template.support.rule3'] },
    { key: 'civil', label: 'ui.groupSettingsDialog.template.civil.label', desc: 'ui.groupSettingsDialog.template.civil.desc', rules: ['ui.groupSettingsDialog.template.civil.rule1', 'ui.groupSettingsDialog.template.civil.rule2', 'ui.groupSettingsDialog.template.civil.rule3'] },
    { key: 'project', label: 'ui.groupSettingsDialog.template.project.label', desc: 'ui.groupSettingsDialog.template.project.desc', rules: ['ui.groupSettingsDialog.template.project.rule1', 'ui.groupSettingsDialog.template.project.rule2', 'ui.groupSettingsDialog.template.project.rule3'] },
    { key: 'announce', label: 'ui.groupSettingsDialog.template.announce.label', desc: 'ui.groupSettingsDialog.template.announce.desc', rules: ['ui.groupSettingsDialog.template.announce.rule1', 'ui.groupSettingsDialog.template.announce.rule2', 'ui.groupSettingsDialog.template.announce.rule3'] },
  ];

  const ROLES: { key: GroupRole; label: string }[] = [
    { key: 'member', label: 'ui.groupSettingsDialog.role.member' },
    { key: 'moderator', label: 'ui.groupSettingsDialog.role.moderator' },
    { key: 'admin', label: 'ui.groupSettingsDialog.role.admin' },
    { key: 'owner', label: 'ui.groupSettingsDialog.role.owner' },
    { key: 'nobody', label: 'ui.groupSettingsDialog.role.nobody' },
  ];
  const VALUE_LABEL: Record<GroupRole, string> = { member: 'ui.groupSettingsDialog.value.member', moderator: 'ui.groupSettingsDialog.value.moderator', admin: 'ui.groupSettingsDialog.value.admin', owner: 'ui.groupSettingsDialog.value.owner', nobody: 'ui.groupSettingsDialog.value.nobody' };
  const GENERAL: { key: string; label: string; group: string; def: GroupRole }[] = [
    { key: 'roles', label: 'ui.groupSettingsDialog.perm.roles', group: 'Members', def: 'owner' },
    { key: 'edit', label: 'ui.groupSettingsDialog.perm.edit', group: 'Members', def: 'admin' },
    { key: 'invite', label: 'ui.groupSettingsDialog.perm.invite', group: 'Members', def: 'member' },
    { key: 'remove', label: 'ui.groupSettingsDialog.perm.remove', group: 'Members', def: 'moderator' },
    { key: 'delete', label: 'ui.groupSettingsDialog.perm.delete', group: 'Moderation', def: 'moderator' },
    { key: 'pin', label: 'ui.groupSettingsDialog.perm.pin', group: 'Moderation', def: 'moderator' },
    { key: 'react', label: 'ui.groupSettingsDialog.perm.react', group: 'Moderation', def: 'member' },
    { key: 'everyone', label: 'ui.groupSettingsDialog.perm.everyone', group: 'Moderation', def: 'admin' },
    { key: 'calls', label: 'ui.groupSettingsDialog.perm.calls', group: 'Moderation', def: 'member' },
  ];
  const PERM_GROUPS = ['Members', 'Moderation'];
  const PERM_GROUP_LABEL: Record<string, string> = { Members: 'ui.groupSettingsDialog.permGroup.members', Moderation: 'ui.groupSettingsDialog.permGroup.moderation' };
  const CONTENT = [
    { key: 'text', label: 'ui.groupSettingsDialog.content.text' },
    { key: 'image', label: 'ui.groupSettingsDialog.content.image' },
    { key: 'video', label: 'ui.groupSettingsDialog.content.video' },
    { key: 'audio', label: 'ui.groupSettingsDialog.content.audio' },
    { key: 'file', label: 'ui.groupSettingsDialog.content.file' },
    { key: 'poll', label: 'ui.groupSettingsDialog.content.poll' },
    { key: 'crypto', label: 'ui.groupSettingsDialog.content.crypto' },
    { key: 'giphy', label: 'ui.groupSettingsDialog.content.giphy' },
    { key: 'prize', label: 'ui.groupSettingsDialog.content.prize' },
    { key: 'meme', label: 'ui.groupSettingsDialog.content.meme' },
    { key: 'p2p', label: 'ui.groupSettingsDialog.content.p2p' },
  ];
  const INHERIT = 'inherit';

  function defaultPerms(): Perms {
    const o: Perms = { general: {}, messages: { default: 'member' }, threads: { default: 'member' } };
    GENERAL.forEach((p) => (o.general[p.key] = p.def));
    CONTENT.forEach((c) => {
      o.messages[c.key] = INHERIT;
      o.threads[c.key] = INHERIT;
    });
    return o;
  }

  const mask = (icon: string) => `var(--icon-${icon}) center/contain no-repeat`;

  interface OwnerMove {
    /** Resource key (or literal text). */
    label: string;
    /** Resource key (or literal text). */
    desc: string;
    /** CSS mask for the row icon. */
    mask: string;
    onPress?: () => void;
  }

  interface Props {
    value?: Partial<GroupSettings> | null;
    initialTab?: Section;
    /** false (the default) stops a private group being made public; making a public group private is always allowed. */
    isDiamond?: boolean;
    onUpgrade?: () => void;
    /** "community" also allows a custom cover image (and a taller cover). */
    noun?: 'group' | 'community';
    /** Save it. The form only counts as saved once this resolves; a rejection keeps the edits with an error. */
    onSave?: (all: GroupSettings) => Promise<unknown> | void;
    onCancel?: () => void;
    /** Embedded close button; falls back to onCancel. */
    onClose?: () => void;
    /** Reports whether there are unsaved edits, whenever that changes. */
    onDirtyChange?: (dirty: boolean) => void;
    embedded?: boolean;
    /** Embedded only: which page to show. */
    section?: Section;
    /** Embedded only: view-only (no edit permission). */
    readOnly?: boolean;
    /** Owner-only rows under the Group page ("Move to a community"). */
    ownerMoves?: OwnerMove[];
    /** About page, resource key (or literal text): e.g. "Public group · 1,204 members". */
    aboutMeta?: string;
    /** About page: your role chip, resource key (or literal text). */
    roleLabel?: string;
    isMuted?: boolean;
    isFavourite?: boolean;
    onMuteChange?: (mute: 'forever' | null) => void;
    /** Shows the Favourite action on the About page. */
    onToggleFavourite?: () => void;
    onOpenRules?: () => void;
  }

  let {
    value = null,
    initialTab = 'group',
    isDiamond = false,
    onUpgrade,
    noun = 'group',
    onSave,
    onCancel,
    onClose,
    onDirtyChange,
    embedded = false,
    section = 'group',
    readOnly: readOnlyProp = false,
    ownerMoves = [],
    aboutMeta = '',
    roleLabel = '',
    isMuted = false,
    isFavourite = false,
    onMuteChange,
    onToggleFavourite,
    onOpenRules,
  }: Props = $props();
  const t = useT();

  // --- the draft: everything Save writes
  const start = untrack(() => value) ?? {};
  const startInfo = start.info ?? ({} as Partial<GroupSettings['info']>);
  const startSet = start.settings ?? ({} as Partial<GroupSettings['settings']>);
  const startRules = start.rules ?? ({} as Partial<GroupSettings['rules']>);
  const startPerms = start.permissions ?? null;
  const base = defaultPerms();

  let name = $state(startInfo.name || '');
  let about = $state(startInfo.about || '');
  let color = $state(startInfo.color || 'teal');
  let coverKey = $state(startInfo.coverKey || 'plum');
  let coverUrl = $state<string | null>(startInfo.coverUrl || null);
  let avatar = $state(startInfo.avatar || '');
  // newly picked images: the files go to the host, the object URLs are previews only and are always released here
  let avatarFile = $state<File | null>(null);
  let coverFile = $state<File | null>(null);
  let avatarPreview = $state<string | null>(null);
  let coverPreview = $state<string | null>(null);
  const preview = (old: string | null, file: File | null) => {
    if (old) URL.revokeObjectURL(old);
    return file ? URL.createObjectURL(file) : null;
  };
  const setAvatarFile = (f: File | null) => {
    avatarFile = f;
    avatarPreview = preview(avatarPreview, f);
  };
  const setCoverFile = (f: File | null) => {
    coverFile = f;
    coverPreview = preview(coverPreview, f);
  };
  const avatarShown = $derived(avatarPreview ?? avatar);
  const coverShown = $derived(coverPreview ?? coverUrl);
  const fileKey = (f: File | null) => (f ? `${f.name}:${f.size}:${f.lastModified}` : null);
  let saving = $state(false);
  let saveError = $state(false);
  let isPublic = $state(!!startSet.isPublic);
  let history = $state(startSet.history !== undefined ? !!startSet.history : true);
  let disappearOn = $state(!!startSet.disappearOn);
  let after = $state(startSet.after || '12 hours');
  let gates = $state<AccessGatesState | null>(start.gates || null);
  let rulesOn = $state(startRules.enabled !== undefined ? !!startRules.enabled : !!(startRules.text || '').trim());
  let rulesText = $state(startRules.text || '');
  let perms = $state<Perms>({
    general: { ...base.general, ...(startPerms?.general ?? {}) },
    messages: { ...base.messages, ...(startPerms?.messages ?? {}) },
    threads: { ...base.threads, ...(startPerms?.threads ?? {}) },
  });
  let threadsOverride = $state(!!startPerms?.threads);

  const snapshot = () => ({ name, about, color, coverKey, coverUrl, avatar, avatarFile: fileKey(avatarFile), coverFile: fileKey(coverFile), isPublic, history, disappearOn, after, gates, rulesOn, rulesText, perms, threadsOverride });
  let initial = $state(JSON.stringify(untrack(snapshot)));

  // --- view state
  const startTab = untrack(() => TAB_KEYS.indexOf(initialTab));
  let tab = $state(startTab === -1 ? 0 : startTab);
  let permSub = $state(0);
  let permMenu = $state<{ scope: Scope; key: string; allowInherit: boolean; anchorTop: number; anchorBottom: number; top: string; left: string; measured: boolean } | null>(null);
  let rulesPreset = $state<string | null>(null);
  let touched = $state(false);
  let submitted = $state(false);
  let aboutMuted = $state<boolean | null>(null);
  let aboutFav = $state<boolean | null>(null);

  let avatarInput = $state<HTMLInputElement>();
  let coverInput = $state<HTMLInputElement>();
  let permPanel = $state<HTMLDivElement>();

  const nameOk = $derived(name.trim().length > 0);
  const rulesBad = $derived(rulesOn && !rulesText.trim());
  const dirty = $derived(JSON.stringify(snapshot()) !== initial);
  const viewOnly = $derived(embedded && readOnlyProp);
  // embedded: the host's nav picks the section, so the tab strip is hidden
  const tabIdx = $derived(embedded ? Math.max(0, TAB_KEYS.indexOf(section)) : tab);
  const isAbout = $derived(tabIdx === 0 && viewOnly);
  // pages other than the About page show plain On/Off status when view-only
  const statusOnly = $derived(viewOnly && tabIdx !== 0);
  const isCommunity = $derived(noun === 'community');

  const gateCount = $derived(gates && Array.isArray(gates.rules) ? gates.rules.length : 0);
  const ruleLines = $derived(rulesOn ? rulesText.split('\n').map((l) => l.replace(/^[•\-\s]+/, '').trim()).filter(Boolean).length : 0);
  const generalChanged = $derived(GENERAL.filter((p) => perms.general[p.key] !== p.def).length);
  const msgExceptions = $derived(CONTENT.filter((c) => perms.messages[c.key] !== INHERIT).length);
  const thrExceptions = $derived(CONTENT.filter((c) => perms.threads[c.key] !== INHERIT).length);
  const permsChanged = $derived(
    generalChanged +
      (perms.messages.default !== 'member' ? 1 : 0) +
      msgExceptions +
      (threadsOverride ? 1 + (perms.threads.default !== 'member' ? 1 : 0) + thrExceptions : 0),
  );
  const scope = $derived<Scope>(permSub === 2 ? 'threads' : 'messages');

  // the host guards unsaved edits when the user leaves this form; a fresh form is clean, so only changes are reported
  let reportedDirty = false;
  $effect(() => {
    const d = dirty;
    untrack(() => {
      if (onDirtyChange && reportedDirty !== d) {
        reportedDirty = d;
        onDirtyChange(d);
      }
    });
  });

  // place the permission popover once its height is known: below the pill, or above it when it doesn't fit
  $effect(() => {
    const m = permMenu, el = permPanel;
    if (!m || m.measured || !el) return;
    const H = el.offsetHeight, PAD = 12;
    const flip = window.innerHeight - m.anchorBottom - PAD < H && m.anchorTop - PAD >= H;
    const top = flip ? m.anchorTop - 6 - H : Math.min(m.anchorBottom + 6, window.innerHeight - PAD - H);
    permMenu = { ...m, measured: true, top: `${Math.max(PAD, top)}px` };
  });

  onDestroy(() => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  });

  function openPermMenu(target: HTMLElement, scopeKey: Scope, key: string, allowInherit: boolean) {
    const r = target.getBoundingClientRect(), W = 238, PAD = 12;
    permMenu = {
      scope: scopeKey,
      key,
      allowInherit,
      anchorTop: r.top,
      anchorBottom: r.bottom,
      top: `${r.bottom + 6}px`,
      left: `${Math.max(PAD, Math.min(r.right - W, window.innerWidth - PAD - W))}px`,
      measured: false,
    };
  }

  function setPerm(scopeKey: Scope, key: string, role: PermValue) {
    perms = { ...perms, [scopeKey]: { ...perms[scopeKey], [key]: role } };
    permMenu = null;
  }

  function discard() {
    const s = JSON.parse(initial);
    ({ name, about, color, coverKey, coverUrl, avatar, isPublic, history, disappearOn, after, gates, rulesOn, rulesText, perms, threadsOverride } = s);
    // the baseline never holds a picked file once saved, except the one just saved (kept as the preview)
    if (s.avatarFile !== fileKey(avatarFile)) setAvatarFile(null);
    if (s.coverFile !== fileKey(coverFile)) setCoverFile(null);
    saveError = false;
    submitted = false;
    touched = false;
  }

  async function save() {
    if (!dirty || saving) return;
    if (!nameOk) {
      submitted = true;
      tab = 0;
      return;
    }
    if (rulesBad) {
      submitted = true;
      tab = 2;
      return;
    }
    const saved = snapshot();
    const all: GroupSettings = {
      info: { name: name.trim(), about, color, coverKey, coverUrl: coverFile ? null : coverUrl, avatar: avatarFile ? '' : avatar, avatarFile, coverFile },
      settings: { isPublic, history, disappearOn, after },
      gates,
      rules: { enabled: rulesOn, text: rulesOn ? rulesText.trim() : '' },
      permissions: {
        general: { ...perms.general },
        messages: { ...perms.messages },
        threads: threadsOverride ? { ...perms.threads } : null,
      },
    };
    saving = true;
    saveError = false;
    try {
      await onSave?.(all);
    } catch {
      // the edits and the unsaved-changes guard stay as they were
      saveError = true;
      return;
    } finally {
      saving = false;
    }
    // embedded stays open after saving, so the saved draft becomes the new baseline (only once the host confirms)
    if (embedded) {
      initial = JSON.stringify(saved);
      submitted = false;
    }
  }

  const ringOf = (on: boolean) => (on ? '0 0 0 2px var(--surface-1,#0e0e12), 0 0 0 4px var(--accent,#FF5672)' : 'inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14))');

  const switches = $derived([
    {
      title: t('ui.groupSettingsDialog.publicGroup'),
      hint: t(isPublic ? 'ui.groupSettingsDialog.publicHintOn' : 'ui.groupSettingsDialog.publicHintOff'),
      on: isPublic,
      // going public needs Diamond; going private never does
      locked: !isDiamond && !isPublic,
      set: (v: boolean) => {
        if (v && !isDiamond) return;
        isPublic = v;
      },
      timed: false,
    },
    {
      title: t('ui.groupSettingsDialog.visibleHistory'),
      hint: t('ui.groupSettingsDialog.visibleHistoryHint'),
      on: history,
      set: (v: boolean) => (history = v),
      timed: false,
    },
    { title: t('ui.groupSettingsDialog.disappearing'), hint: '', on: disappearOn, set: (v: boolean) => (disappearOn = v), timed: true },
  ]);

  // --- About page (embedded + view-only Overview)
  const muted = $derived(aboutMuted ?? isMuted);
  const favourite = $derived(aboutFav ?? isFavourite);
  const ruleCount = $derived(rulesText.split('\n').map((l) => l.trim()).filter(Boolean).length);
  const facts = $derived([
    history ? { text: t('ui.groupSettingsDialog.factHistory'), icon: 'history' } : { text: t('ui.groupSettingsDialog.factNoHistory'), icon: 'hidden' },
    ...(disappearOn ? [{ text: t('ui.groupSettingsDialog.factDisappear', { duration: durationText(t, after) }), icon: 'timer' }] : []),
    isPublic ? { text: t('ui.groupSettingsDialog.factPublic', { noun }), icon: 'globe' } : { text: t('ui.groupSettingsDialog.factPrivate'), icon: 'lock' },
    ...(ruleCount
      ? [{ text: t(rulesOn ? 'ui.groupSettingsDialog.factRulesAccept' : 'ui.groupSettingsDialog.factRules', { count: ruleCount }), icon: 'rules', link: true }]
      : []),
  ]);

  // permissions list for the current sub-tab
  const permRows = $derived.by(() => {
    if (permSub === 0)
      return PERM_GROUPS.map((g) => {
        const items = GENERAL.filter((x) => x.group === g);
        return {
          label: t(PERM_GROUP_LABEL[g]).toUpperCase(),
          items: items.map((x, i) => {
            const cur = perms.general[x.key];
            return { label: t(x.label), master: false, last: i === items.length - 1, valueLabel: t(VALUE_LABEL[cur]), tone: cur === 'nobody' ? 'off' : 'set', open: (el: HTMLElement) => openPermMenu(el, 'general', x.key, false) };
          }),
        };
      });
    const set = perms[scope];
    const master = { label: t('ui.groupSettingsDialog.sendByDefault'), master: true, last: false, valueLabel: t(VALUE_LABEL[set.default as GroupRole]), tone: 'set', open: (el: HTMLElement) => openPermMenu(el, scope, 'default', false) };
    const content = CONTENT.map((c, i) => {
      const inherited = set[c.key] === INHERIT;
      const eff = (inherited ? set.default : set[c.key]) as GroupRole;
      return {
        label: t(c.label),
        master: false,
        last: i === CONTENT.length - 1,
        valueLabel: inherited ? t('ui.groupSettingsDialog.defaultValue', { value: t(VALUE_LABEL[eff]) }) : t(VALUE_LABEL[eff]),
        tone: inherited ? 'inherited' : 'set',
        open: (el: HTMLElement) => openPermMenu(el, scope, c.key, true),
      };
    });
    return [{ label: '', items: [master, ...content] }];
  });

  const permOptions = $derived(permMenu ? [...(permMenu.allowInherit ? [{ key: INHERIT as PermValue, label: 'ui.groupSettingsDialog.sameAsDefault' }] : []), ...ROLES] : []);

  const showNote = $derived((submitted && (!nameOk || rulesBad)) || dirty);
  const noteError = $derived(submitted && (!nameOk || rulesBad));
</script>

{#snippet sectionLabel(text: string)}
  <span class="section-label">{text}</span>
{/snippet}

{#snippet status(on: boolean)}
  <span class="status">{t(on ? 'ui.groupSettingsDialog.on' : 'ui.groupSettingsDialog.off')}</span>
{/snippet}

<div class="root" class:embedded use:modal={embedded ? undefined : () => (onClose ?? onCancel)?.()}>
  {#if !embedded}
    <div class="veil" onclick={onCancel} aria-hidden="true"></div>
  {/if}

  <div class="card">
    {#if embedded}
      <div class="embedded-head">
        <span class="embedded-title">{t([viewOnly ? 'ui.groupSettingsDialog.about' : 'ui.groupSettingsDialog.overview', 'ui.groupSettingsDialog.accessGates', 'ui.groupSettingsDialog.tabRules', 'ui.groupSettingsDialog.tabPermissions'][tabIdx])}</span>
        <span class="icon-button big" onclick={() => (onClose ?? onCancel)?.()} role="button" tabindex="0" aria-label={t('ui.common.close')} title={t('ui.common.close')}><span class="icon-16" style:mask={mask('close')}></span></span>
      </div>
    {:else}
      <div class="head">
        <div class="head-row">
          <span class="gear-tile"><span class="gear" style:mask={mask('gear')}></span></span>
          <div class="head-text">
            <span class="head-title">{t('ui.groupSettingsDialog.title')}</span>
            <span class="head-name">{value?.info?.name || t('ui.groupSettingsDialog.thisGroup')}</span>
          </div>
          <span class="icon-button" onclick={onCancel} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="icon-15" style:mask={mask('close')}></span></span>
        </div>
        <div class="cell">
          <SegmentedTabs
            labels={TABS.map((x) => t(x))}
            counts={[null, gateCount || null, ruleLines || null, permsChanged || null]}
            selectedIndex={tab}
            dotIndexes={[!nameOk && submitted ? 0 : null, rulesBad && submitted ? 2 : null].filter((i): i is number => i !== null)}
            onSelect={(i) => {
              tab = i;
              permMenu = null;
            }}
          />
        </div>
      </div>
    {/if}

    <div class="body" onscroll={() => permMenu && (permMenu = null)}>
      <div class="body-inner" inert={statusOnly ? true : undefined}>
        {#if tabIdx === 0 && !viewOnly}
          <div class="group-page">
            <div class="cover" style:height={isCommunity ? '150px' : '112px'} style:background={coverShown ? `url(${coverShown}) center/cover no-repeat` : `var(--cover-${COVERS[coverKey] ? coverKey : 'plum'})`}>
              <div class="cover-tools">
                <div class="cover-tools-inner">
                  {#if isCommunity}
                    <input
                      class="hidden-input"
                      bind:this={coverInput}
                      type="file"
                      accept="image/*"
                      oninput={(e) => {
                        const f = e.currentTarget.files?.[0];
                        if (!f) return;
                        setCoverFile(f);
                        e.currentTarget.value = '';
                      }}
                    />
                    <span class="cover-upload" onclick={() => coverInput?.click()} role="button" tabindex="0"><span class="cover-camera" style:mask={mask('camera')}></span>{t(coverShown ? 'ui.groupSettingsDialog.changeCover' : 'ui.groupSettingsDialog.uploadCover')}</span>
                  {/if}
                  <div class="swatches">
                    {#each Object.entries(COVERS) as [key, label]}
                      <span
                        class="swatch"
                        style:background="var(--cover-{key})"
                        style:box-shadow={ringOf(key === coverKey)}
                        onclick={() => {
                          coverKey = key;
                          coverUrl = null;
                          setCoverFile(null);
                        }}
                        role="button"
                        tabindex="0"
                        aria-label={t(label)}
                        title={t(label)}
                      ></span>
                    {/each}
                  </div>
                </div>
              </div>
            </div>

            <div class="page">
              <div class="column wide-gap">
                <div class="photo-row">
                  <div class="photo">
                    <div class="photo-frame" style:background={(GRADIENTS[color] ?? GRADIENTS.teal).value}>
                      <div class="photo-image" style:background={avatarShown ? `url(${avatarShown}) center/cover no-repeat` : 'none'}></div>
                    </div>
                    <input
                      class="hidden-input"
                      bind:this={avatarInput}
                      type="file"
                      accept="image/*"
                      oninput={(e) => {
                        const f = e.currentTarget.files?.[0];
                        if (f) setAvatarFile(f);
                        e.currentTarget.value = '';
                      }}
                    />
                    <div class="photo-pick" onclick={() => avatarInput?.click()} role="button" tabindex="0"><span class="icon-15 ink" style:mask={mask('camera')}></span></div>
                  </div>
                  <div class="photo-text">
                    <span class="photo-title">{t('ui.groupSettingsDialog.groupPhoto')}</span>
                    <div class="photo-line">
                      <span class="photo-hint">{t('ui.groupSettingsDialog.photoHint')}</span>
                      <span class="grow"></span>
                      {#if avatarShown}
                        <span
                          class="remove-photo"
                          onclick={() => {
                            avatar = '';
                            setAvatarFile(null);
                          }}
                          role="button"
                          tabindex="0">{t('ui.groupSettingsDialog.removePhoto')}</span>
                      {/if}
                      {#each Object.entries(GRADIENTS) as [key, g]}
                        <span class="swatch flex-none" style:background={g.value} style:box-shadow={ringOf(key === color)} onclick={() => (color = key)} role="button" tabindex="0" aria-label={t(g.label)} title={t(g.label)}></span>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="field-block">
                  <div class="field-label-row">
                    <span class="field-label">{t('ui.groupSettingsDialog.groupName')}</span>
                    <span class="required">*</span>
                  </div>
                  <div class="name-box" class:bad={!nameOk && (touched || submitted)}>
                    <input
                      value={name}
                      oninput={(e) => {
                        name = e.currentTarget.value;
                        touched = true;
                      }}
                      placeholder={t('ui.groupSettingsDialog.groupName')}
                      maxlength={NAME_MAX}
                    />
                    <span class="name-left" class:low={NAME_MAX - name.length <= 5}>{NAME_MAX - name.length}</span>
                  </div>
                  {#if !nameOk && (touched || submitted)}
                    <span class="name-error">{t('ui.groupSettingsDialog.nameError')}</span>
                  {/if}
                </div>

                <div class="field-block">
                  <div class="field-label-row wide">
                    <span class="field-label">{t('ui.groupSettingsDialog.description')}</span>
                    <span class="optional">{t('ui.groupSettingsDialog.optional')}</span>
                  </div>
                  <div class="cell"><TextArea value={about} onInput={(e) => (about = e.currentTarget.value)} placeholder={t('ui.groupSettingsDialog.descriptionPlaceholder')} maxLength={ABOUT_MAX} minHeight={49} /></div>
                </div>

                <div class="list-block">
                  {@render sectionLabel(t('ui.groupSettingsDialog.settings'))}
                  <div class="list">
                    {#each switches as s, i}
                      <div class="switch-row" class:last={i === switches.length - 1}>
                        {#if s.timed}
                          <div class="cell">
                            <TimedToggle density="flush" label={s.title} on={s.on} value={after} offHint={t('ui.groupSettingsDialog.disappearOffHint')} readOnly={statusOnly} onChange={s.set} onDurationChange={(label) => (after = label)} />
                          </div>
                        {:else}
                          <div class="switch-line">
                            <div class="switch-text">
                              <span class="switch-title">{s.title}</span>
                              <span class="switch-hint">{s.hint}</span>
                            </div>
                            <div class="toggle-cell"><Toggle on={s.on} disabled={!!s.locked} onChange={s.set} /></div>
                          </div>
                          {#if s.locked}
                            <UpgradeBanner text={t('ui.groupSettingsDialog.diamondOnly')} {onUpgrade} />
                          {/if}
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>

            {#if ownerMoves.length > 0}
              <div class="moves">
                {@render sectionLabel(t('ui.groupSettingsDialog.moveToCommunity'))}
                <div class="facts">
                  {#each ownerMoves as move}
                    <div class="fact link" onclick={move.onPress} role="button" tabindex="0">
                      <span class="fact-tile"><span class="icon-15 ink-2" style:mask={move.mask}></span></span>
                      <div class="move-text">
                        <span class="move-label">{t(move.label)}</span>
                        <span class="move-desc">{t(move.desc)}</span>
                      </div>
                      <span class="chev" data-oc-flip=""></span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        {#if isAbout}
          <div class="about">
            <div class="about-cover" style:height={isCommunity ? '150px' : '112px'} style:background={coverShown ? `url(${coverShown}) center/cover no-repeat` : `var(--cover-${COVERS[coverKey] ? coverKey : 'plum'})`}></div>
            <div class="about-body">
              <div class="photo-frame about-photo" style:background={(GRADIENTS[color] ?? GRADIENTS.teal).value}>
                <div class="photo-image" style:background={avatarShown ? `url(${avatarShown}) center/cover no-repeat` : 'none'}></div>
              </div>
              <div class="about-names">
                <span class="about-name">{name}</span>
                <span class="about-meta">{t(aboutMeta)}</span>
              </div>
              <div class="about-actions">
                {#if roleLabel}<span class="role-chip">{t(roleLabel)}</span>{/if}
                <span
                  class="about-action"
                  class:active={muted}
                  onclick={() => {
                    const was = muted;
                    aboutMuted = !was;
                    onMuteChange?.(was ? null : 'forever');
                  }}
                  role="button"
                  tabindex="0"><span class="about-action-icon" style:mask={mask(muted ? 'bell-off' : 'bell')}></span>{t(muted ? 'ui.groupSettingsDialog.muted' : 'ui.groupSettingsDialog.mute')}</span
                >
                {#if onToggleFavourite}
                  <span
                    class="about-action"
                    class:active={favourite}
                    onclick={() => {
                      const was = favourite;
                      aboutFav = !was;
                      onToggleFavourite?.();
                    }}
                    role="button"
                    tabindex="0"><span class="about-action-icon" style:mask={mask('heart')}></span>{t(favourite ? 'ui.groupSettingsDialog.favourited' : 'ui.groupSettingsDialog.favourite')}</span
                  >
                {/if}
              </div>
              {#if about.trim()}
                <p class="about-text">{about}</p>
              {/if}
              <div class="list-block stretch">
                {@render sectionLabel(t('ui.groupSettingsDialog.howItWorks', { noun }))}
                <div class="facts">
                  {#each facts as f}
                    {#if f.link}
                      <div class="fact link" onclick={() => onOpenRules?.()} tabindex="0" role="button">
                        <span class="fact-tile"><span class="icon-15 ink-2" style:mask={mask(f.icon)}></span></span>
                        <span class="fact-text">{f.text}</span>
                        <span class="chev" data-oc-flip=""></span>
                      </div>
                    {:else}
                      <div class="fact" tabindex="0">
                        <span class="fact-tile"><span class="icon-15 ink-2" style:mask={mask(f.icon)}></span></span>
                        <span class="fact-text">{f.text}</span>
                      </div>
                    {/if}
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/if}

        {#if tabIdx === 1}
          <div class="gates-page">
            <div class="column cell">
              <AccessGates readOnly={viewOnly} {isDiamond} value={gates} onChange={(g) => (gates = g)} />
            </div>
          </div>
        {/if}

        {#if tabIdx === 2}
          <div class="page tall">
            <div class="column huge-gap">
              <div class="switch-line">
                <div class="switch-text">
                  <span class="switch-title">{t('ui.groupSettingsDialog.enableRules')}</span>
                  <span class="switch-hint">{t('ui.groupSettingsDialog.enableRulesHint')}</span>
                </div>
                {#if statusOnly}{@render status(rulesOn)}{:else}<div class="toggle-cell"><Toggle on={rulesOn} onChange={(on) => (rulesOn = on)} /></div>{/if}
              </div>

              {#if rulesOn}
                {#if !statusOnly}
                  <div class="list-block small-gap">
                    {@render sectionLabel(t('ui.groupSettingsDialog.startFromTemplate'))}
                    <div class="templates">
                      {#each RULE_TEMPLATES as tpl}
                        <div
                          class="template"
                          class:selected={rulesPreset === tpl.key}
                          onclick={() => {
                            rulesPreset = tpl.key;
                            rulesText = tpl.rules.map((r) => `• ${t(r)}`).join('\n');
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
                {/if}

                <div class="list-block small-gap">
                  <div class="rules-head">
                    {@render sectionLabel(t('ui.groupSettingsDialog.rules'))}
                    <span class="grow"></span>
                    {#if rulesText.length > 0 && !viewOnly}
                      <span
                        class="text-action"
                        onclick={() => {
                          rulesText = '';
                          rulesPreset = null;
                        }}
                        role="button"
                        tabindex="0">{t('ui.groupSettingsDialog.clear')}</span
                      >
                    {/if}
                  </div>
                  <div class="cell">
                    <TextArea
                      value={rulesText}
                      onInput={(e) => (rulesText = e.currentTarget.value)}
                      placeholder={t('ui.groupSettingsDialog.rulesPlaceholder')}
                      maxLength={RULES_MAX}
                      minHeight={162}
                      help={t('ui.groupSettingsDialog.rulesHelp')}
                      error={rulesBad && submitted}
                      errorText={t('ui.groupSettingsDialog.rulesError')}
                    />
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if tabIdx === 3}
          <div class="page tall">
            <div class="column mid-gap">
              <div class="perm-intro">
                <span class="switch-title">{t('ui.groupSettingsDialog.whoCanDoWhat')}</span>
                <span class="switch-hint">{t('ui.groupSettingsDialog.whoCanDoWhatHint')}</span>
              </div>

              <div class="cell">
                <SegmentedTabs
                  labels={[t('ui.groupSettingsDialog.permGeneral'), t('ui.groupSettingsDialog.permMessages'), t('ui.groupSettingsDialog.permThreads')]}
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
                  <span class="changed-text">{t('ui.groupSettingsDialog.permsChanged', { count: permsChanged })}</span>
                  <span
                    class="text-action"
                    onclick={() => {
                      perms = defaultPerms();
                      threadsOverride = false;
                      permMenu = null;
                    }}
                    role="button"
                    tabindex="0">{t('ui.groupSettingsDialog.resetDefaults')}</span
                  >
                </div>
              {/if}

              {#if permSub === 2}
                <div class="thread-switch">
                  <div class="switch-text">
                    <span class="switch-title small">{t('ui.groupSettingsDialog.threadsOverride')}</span>
                    <span class="switch-hint">{t(threadsOverride ? 'ui.groupSettingsDialog.threadsOverrideOn' : 'ui.groupSettingsDialog.threadsOverrideOff')}</span>
                  </div>
                  {#if statusOnly}{@render status(threadsOverride)}{:else}<div class="toggle-cell">
                      <Toggle
                        on={threadsOverride}
                        onChange={(on) => {
                          threadsOverride = on;
                          permMenu = null;
                        }}
                      />
                    </div>{/if}
                </div>
              {/if}

              {#if permSub !== 2 || threadsOverride}
                {#each permRows as group}
                  <div class="list-block small-gap tight">
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
                  <span class="inherited-title">{t('ui.groupSettingsDialog.threadsFollow')}</span>
                  <span class="inherited-hint">{t('ui.groupSettingsDialog.threadsFollowHint')}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    {#if !viewOnly}
      <div class="footer">
        {#if !embedded || dirty}
          <span class="cancel" onclick={() => (embedded ? discard() : onCancel?.())} role="button" tabindex="0">{t(embedded ? 'ui.groupSettingsDialog.discardChanges' : 'ui.common.cancel')}</span>
        {/if}
        <span class="grow"></span>
        {#if saveError}
          <span class="note error" role="alert">{t('ui.groupSettingsDialog.saveFailed')}</span>
        {:else if showNote}
          <span class="note" class:error={noteError}>{t(submitted && !nameOk ? 'ui.groupSettingsDialog.nameNeeded' : submitted && rulesBad ? 'ui.groupSettingsDialog.rulesNeeded' : 'ui.groupSettingsDialog.unsaved')}</span>
        {/if}
        <div class="save" class:ready={dirty && !saving} onclick={save} role="button" tabindex="0" aria-disabled={!dirty || saving}>
          <span class="save-icon"></span>
          <span>{t(saving ? 'ui.groupSettingsDialog.saving' : 'ui.common.saveChanges')}</span>
        </div>
      </div>
    {/if}
  </div>

  {#if permMenu}
    {@const current = perms[permMenu.scope][permMenu.key]}
    <div class="menu-layer">
      <div class="menu-catch" onclick={() => (permMenu = null)} aria-hidden="true"></div>
      <div class="perm-menu" bind:this={permPanel} style:top={permMenu.top} style:left={permMenu.left} style:visibility={permMenu.measured ? 'visible' : 'hidden'} role="menu" aria-label={t('ui.groupSettingsDialog.whoCanDoThis')}>
        <span class="perm-menu-hint">{t(permMenu.allowInherit ? 'ui.groupSettingsDialog.whoCanSend' : 'ui.groupSettingsDialog.lowestRole')}</span>
        {#each permOptions as o}
          {@const sel = o.key === current}
          <div class="perm-option" class:selected={sel} onclick={() => permMenu && setPerm(permMenu.scope, permMenu.key, o.key)} role="button" tabindex="0">
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
    box-sizing: border-box;
  }

  .root.embedded {
    position: absolute;
    padding: 0;
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 780px;
    height: min(740px, 100%);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      0 30px 70px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }

  .embedded .card {
    max-width: none;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
  }

  .embedded-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 71px;
    box-sizing: border-box;
    padding: 0 var(--space-16) 0 var(--space-24);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .embedded-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
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

  .icon-button.big {
    width: 34px;
    height: 34px;
  }

  .icon-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .icon-15,
  .icon-16 {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
  }

  .icon-16 {
    width: 16px;
    height: 16px;
  }

  .icon-15.ink {
    background: var(--ink, #ececf1);
  }

  .icon-15.ink-2 {
    background: var(--ink-2, #c9c9d4);
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

  .gear-tile {
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

  .gear {
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

  .head-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
  }

  .body-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .group-page {
    display: flex;
    flex-direction: column;
    min-width: 0;
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

  .cover-camera {
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

  .flex-none {
    flex: none;
  }

  .page {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-22) var(--space-18) var(--space-32);
  }

  .page.tall {
    flex: initial;
    padding: var(--space-32) var(--space-18);
    box-sizing: border-box;
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

  .huge-gap {
    gap: var(--space-32);
  }

  .mid-gap {
    gap: var(--space-22);
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
    border-radius: 30%;
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

  .grow {
    flex: 1;
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

  .name-box {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: 0 var(--space-16);
    height: 52px;
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .name-box.bad {
    box-shadow: inset 0 0 0 1px var(--status-danger, #f5493d);
  }

  .name-box input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .name-left {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
  }

  .name-left.low {
    color: var(--status-warning, #ffb03d);
  }

  .name-error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
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

  .list-block.stretch {
    align-self: stretch;
  }

  .section-label {
    padding-inline-start: var(--space-4);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--ink-4, #7c7c8c);
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

  .status {
    flex: none;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .moves {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    min-width: 0;
    padding: var(--space-22) var(--space-18) var(--space-26);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .facts {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  .fact {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-12) var(--space-14);
    cursor: default;
  }

  .fact + .fact {
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .fact.link {
    cursor: pointer;
  }

  .fact.link:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .fact-tile {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fact-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-base) / 1.35 var(--font-sans);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .move-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .move-label {
    font: var(--weight-semibold) var(--text-base) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .move-desc {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .chev {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-chevron-right) center/contain no-repeat;
  }

  .about {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .about-cover {
    align-self: stretch;
    flex: none;
  }

  .about-body {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-22);
    padding: 0 var(--space-24) var(--space-32);
    box-sizing: border-box;
    min-width: 0;
  }

  .about-photo {
    flex: none;
    margin-block-start: -52px;
  }

  .about-names {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    margin-block-start: calc(var(--space-8) * -1);
    min-width: 0;
  }

  .about-name {
    font: var(--weight-bold) var(--text-2xl, 21px) / 1.2 var(--font-sans);
    color: var(--ink, #ececf1);
    text-align: center;
    text-wrap: balance;
  }

  .about-meta {
    font: var(--weight-regular) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-3, #8a8a99);
    text-align: center;
  }

  .about-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--space-8);
  }

  .role-chip,
  .about-action {
    flex: none;
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
  }

  .role-chip {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    color: var(--ink-2, #c9c9d4);
  }

  .about-action {
    --action-ink: var(--ink-2, #c9c9d4);
    gap: var(--space-6);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    color: var(--action-ink);
    cursor: pointer;
    user-select: none;
  }

  .about-action.active {
    --action-ink: var(--accent-bright, #ff8298);
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .about-action:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .about-action-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--action-ink);
  }

  .about-text {
    margin: 0;
    font: var(--weight-regular) var(--text-base) / 1.6 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-align: center;
    text-wrap: pretty;
    white-space: pre-line;
  }

  .gates-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-32);
    box-sizing: border-box;
    min-width: 0;
  }

  .templates {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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
    --template-ink: var(--accent-bright, #ff8298);
    background: color-mix(in srgb, var(--accent, #ff5672) 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #ff5672) 45%, transparent);
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
    text-wrap: pretty;
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
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .note {
    margin-inline-end: var(--space-8);
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .note.error {
    color: var(--status-danger, #f5493d);
  }

  .save {
    --save-ink: var(--ink-4, #7c7c8c);
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
    color: var(--save-ink);
    cursor: not-allowed;
    user-select: none;
  }

  .save.ready {
    --save-ink: var(--on-accent, #2e0512);
    background: var(--accent, #ff5672);
    cursor: pointer;
  }

  .save:hover {
    filter: brightness(1.08);
  }

  .save-icon {
    width: 17px;
    height: 17px;
    background: var(--save-ink);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .menu-layer {
    position: fixed;
    inset: 0;
    z-index: 80;
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

  .selected .perm-option-label {
    font-weight: var(--weight-semibold);
    color: var(--accent-bright, #ff8298);
  }
</style>

<!-- Profile & settings: a nav rail of sections (profile, stats, CHIT, Diamond, chats & calls, communities, sign-in providers,
     appearance, storage, bots, link device, delete account, invite, about) and the selected section. Profile fields edit
     in place; delete account runs a four-step "are you sure" flow; log out confirms first. Esc closes the innermost layer.
     Everything that changes the account goes through the host and waits on its promise (profile save, sign-in methods,
     community names, clear cache, log out, delete account); a rejection keeps the user's input with an error. Actions
     whose callback is absent are hidden. The CHIT calendar draws `claimHistory`. -->
<script lang="ts" module>
  export type ProfileSection =
    | 'profile'
    | 'stats'
    | 'chit'
    | 'diamond'
    | 'chats'
    | 'communities'
    | 'signin'
    | 'appearance'
    | 'storage'
    | 'bots'
    | 'device'
    | 'delete'
    | 'invite'
    | 'about';

  export interface SigninMethod {
    type: 'passkey' | 'ii' | 'email';
    id: string;
    title: string;
    /** How the method is named in "Confirm with your …". */
    short?: string;
    /** "Last used …" line. */
    used?: string;
    /** The method this session signed in with (can't be unlinked). */
    current?: boolean;
  }

  export interface ChatSettings {
    enterSends: boolean;
    doubleClick: boolean;
    notifications: boolean;
    lowBandwidth: boolean;
    hideBlocked: boolean;
    cameraOn: boolean;
    micOn: boolean;
    activeSpeaker: boolean;
    offensive: boolean;
    adult: boolean;
    underReview: boolean;
    ringtone: 'boring' | 'pleasant' | 'boomboom' | 'twostep' | 'siren';
  }

  /** One day of the CHIT claim history (UTC calendar days). */
  export interface ClaimDay {
    /** YYYY-MM-DD (UTC). */
    day: string;
    /** Streak day this claim counted as. */
    streakDay: number;
    /** CHIT claimed (absent for insured days). */
    amount?: number;
    /** Minute of the UTC day the claim was made. */
    minute?: number;
    /** Covered by streak insurance instead of a claim. */
    insured?: boolean;
  }

  export interface ProfileCommunity {
    id: string;
    name: string;
    /** Gradient key (teal, violet, amber, blue, plum, rose, slate), used when there is no avatar. */
    color?: string;
    /** CSS background (image URL or gradient) for the community face. */
    avatar?: string;
  }

  export interface ChitSettingsPatch {
    enabled?: boolean;
    notify?: boolean;
    hideAfterClaim?: boolean;
    puzzle?: boolean;
    puzzleRemind?: boolean;
    utc?: boolean;
  }

  type NavItem = [ProfileSection, string, string, ('chit' | 'diamond' | 'danger')?];

  const NAV: { label: string; items: NavItem[] }[] = [
    { label: 'ui.profileDialog.nav.account', items: [['profile', 'ui.profileDialog.nav.profile', 'user'], ['stats', 'ui.profileDialog.nav.stats', 'poll'], ['chit', 'CHIT', 'zap', 'chit'], ['diamond', 'ui.profileDialog.nav.diamond', 'gem', 'diamond']] },
    { label: 'ui.profileDialog.nav.settings', items: [['chats', 'ui.profileDialog.nav.chats', 'chat'], ['communities', 'ui.profileDialog.nav.communities', 'users'], ['signin', 'ui.profileDialog.nav.signin', 'key'], ['appearance', 'ui.profileDialog.nav.appearance', 'eye']] },
    { label: 'ui.profileDialog.nav.advanced', items: [['storage', 'ui.profileDialog.nav.storage', 'refresh'], ['bots', 'ui.profileDialog.nav.bots', 'bot'], ['device', 'ui.profileDialog.nav.device', 'device'], ['delete', 'ui.profileDialog.nav.delete', 'trash', 'danger']] },
    { label: 'ui.profileDialog.nav.openchat', items: [['invite', 'ui.profileDialog.nav.invite', 'share'], ['about', 'ui.profileDialog.nav.about', 'info']] },
  ];
  const TITLES: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i[0], i[1]])));

  const FIELDS = [
    { key: 'name', label: 'ui.profileDialog.fields.name', max: 25, placeholder: 'ui.profileDialog.fields.namePlaceholder', hint: 'ui.profileDialog.fields.nameHint', mono: false, area: false },
    { key: 'handle', label: 'ui.profileDialog.fields.handle', max: 20, placeholder: '', hint: 'ui.profileDialog.fields.handleHint', mono: true, area: false },
    { key: 'about', label: 'ui.profileDialog.fields.about', max: 2000, placeholder: 'ui.profileDialog.fields.aboutPlaceholder', hint: 'ui.profileDialog.fields.aboutHint', mono: false, area: true },
  ] as const;
  type FieldKey = (typeof FIELDS)[number]['key'];

  const MIX_COLORS = ['#5B8CFF', '#B06BFF', '#FFB03D', '#2EE6A8', '#6E6E7C'];

  const GRADS: Record<string, string> = {
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    plum: 'linear-gradient(140deg,#B06BFF,#6A2BFF)',
    rose: 'linear-gradient(140deg,#FF6B8B,#C13584)',
    slate: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
  };

  const FONT_SIZES = [
    { key: 'small', label: 'ui.profileDialog.sizes.small', glyph: '11px', scale: 0.92 },
    { key: 'default', label: 'ui.profileDialog.sizes.default', glyph: '13px', scale: 1 },
    { key: 'large', label: 'ui.profileDialog.sizes.large', glyph: '15px', scale: 1.1 },
    { key: 'larger', label: 'ui.profileDialog.sizes.larger', glyph: '17px', scale: 1.2 },
  ] as const;

  const THEME_PREVIEW = {
    system: { bg: 'linear-gradient(115deg,#0e0e12 0 50%,#FFFFFF 50% 100%)', recv: 'rgba(128,128,140,.45)', bar: 'linear-gradient(115deg,#191921 0 50%,#E7E5E0 50% 100%)' },
    dark: { bg: '#0e0e12', recv: '#22222c', bar: '#191921' },
    light: { bg: '#FFFFFF', recv: '#EFEDE8', bar: '#E7E5E0' },
  };
  const THEMES = [['system', 'ui.profileDialog.themes.system'], ['dark', 'ui.profileDialog.themes.dark'], ['light', 'ui.profileDialog.themes.light']] as const;
  const ACCENTS = [['pink', 'ui.profileDialog.accents.pink', '#FF5672'], ['blue', 'ui.profileDialog.accents.blue', '#3D9BFF'], ['orange', 'ui.profileDialog.accents.orange', '#FF8A3D'], ['green', 'ui.profileDialog.accents.green', '#2EE6A8']] as const;

  const CHAT_GROUPS: { label: string; rows: [keyof ChatSettings, string, string][] }[] = [
    {
      label: 'ui.profileDialog.chats.groupChats',
      rows: [
        ['enterSends', 'ui.profileDialog.chats.enterSends', 'ui.profileDialog.chats.enterSendsHint'],
        ['doubleClick', 'ui.profileDialog.chats.doubleClick', 'ui.profileDialog.chats.doubleClickHint'],
        ['notifications', 'ui.profileDialog.chats.notifications', 'ui.profileDialog.chats.notificationsHint'],
        ['lowBandwidth', 'ui.profileDialog.chats.lowBandwidth', 'ui.profileDialog.chats.lowBandwidthHint'],
        ['hideBlocked', 'ui.profileDialog.chats.hideBlocked', 'ui.profileDialog.chats.hideBlockedHint'],
      ],
    },
    {
      label: 'ui.profileDialog.chats.groupCalls',
      rows: [
        ['cameraOn', 'ui.profileDialog.chats.cameraOn', 'ui.profileDialog.chats.cameraOnHint'],
        ['micOn', 'ui.profileDialog.chats.micOn', 'ui.profileDialog.chats.micOnHint'],
        ['activeSpeaker', 'ui.profileDialog.chats.activeSpeaker', 'ui.profileDialog.chats.activeSpeakerHint'],
      ],
    },
    {
      label: 'ui.profileDialog.chats.groupRestricted',
      rows: [
        ['offensive', 'ui.profileDialog.chats.offensive', 'ui.profileDialog.chats.offensiveHint'],
        ['adult', 'ui.profileDialog.chats.adult', 'ui.profileDialog.chats.adultHint'],
        ['underReview', 'ui.profileDialog.chats.underReview', 'ui.profileDialog.chats.underReviewHint'],
      ],
    },
  ];
  const CHAT_DEFAULTS: ChatSettings = {
    enterSends: true,
    doubleClick: true,
    notifications: true,
    lowBandwidth: false,
    hideBlocked: false,
    cameraOn: false,
    micOn: true,
    activeSpeaker: false,
    offensive: false,
    adult: true,
    underReview: false,
    ringtone: 'pleasant',
  };

  // rough envelope per tone so each waveform reads differently
  const WAVES: Record<ChatSettings['ringtone'], (x: number) => number> = {
    boring: (x) => 0.35 + 0.1 * Math.sin(x * 40),
    pleasant: (x) => 0.3 + 0.55 * Math.pow(Math.sin(x * Math.PI), 1.5) * (0.75 + 0.25 * Math.sin(x * 23)),
    boomboom: (x) => (Math.sin(x * Math.PI * 4) > 0.2 ? 0.9 : 0.2) * (0.8 + 0.2 * Math.sin(x * 51)),
    twostep: (x) => (Math.floor(x * 8) % 2 ? 0.35 : 0.8) * (0.7 + 0.3 * Math.abs(Math.sin(x * 37))),
    siren: (x) => 0.25 + 0.7 * Math.abs(Math.sin(x * Math.PI * 2)),
  };
  const RINGTONES: [ChatSettings['ringtone'], string][] = [['boring', 'ui.profileDialog.ringtones.boring'], ['pleasant', 'ui.profileDialog.ringtones.pleasant'], ['boomboom', 'ui.profileDialog.ringtones.boomboom'], ['twostep', 'ui.profileDialog.ringtones.twostep'], ['siren', 'ui.profileDialog.ringtones.siren']];

  const DAY = 864e5;
  const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
  const dayStart = (t: number) => Math.floor(t / DAY) * DAY;

  const SI_TYPES = {
    passkey: { label: 'ui.profileDialog.signin.passkeys', icon: 'passkey', noun: 'ui.profileDialog.signin.passkey', addLabel: 'ui.profileDialog.signin.addPasskey', addTitle: 'ui.profileDialog.signin.addPasskey', empty: 'ui.profileDialog.signin.noPasskeys' },
    ii: { label: 'ui.profileDialog.signin.iiCaps', icon: 'ii', noun: 'ui.profileDialog.signin.ii', addLabel: 'ui.profileDialog.signin.linkIi', addTitle: 'ui.profileDialog.signin.linkIi', empty: 'ui.profileDialog.signin.noIi' },
    email: { label: 'ui.profileDialog.signin.emailCaps', icon: 'mail', noun: 'ui.profileDialog.signin.email', addLabel: 'ui.profileDialog.signin.addEmail', addTitle: 'ui.profileDialog.signin.addEmail', empty: 'ui.profileDialog.signin.noEmail' },
  };

  const ABOUT_LINKS: Record<string, [string, string]> = {
    architecture: ['ui.profileDialog.about.architecture', 'layers'],
    blog: ['ui.profileDialog.about.blog', 'news'],
    faq: ['ui.profileDialog.about.faq', 'info'],
    features: ['ui.profileDialog.about.features', 'sparkle'],
    guidelines: ['ui.profileDialog.about.guidelines', 'shield'],
    metrics: ['ui.profileDialog.about.metrics', 'poll'],
    roadmap: ['ui.profileDialog.about.roadmap', 'map'],
    whitepaper: ['ui.profileDialog.about.whitepaper', 'file'],
  };
  const ABOUT_GROUPS = [
    { label: 'ui.profileDialog.about.groupProduct', keys: ['features', 'roadmap', 'metrics'] },
    { label: 'ui.profileDialog.about.groupHow', keys: ['architecture', 'whitepaper', 'faq'] },
    { label: 'ui.profileDialog.about.groupCommunity', keys: ['blog', 'guidelines'] },
  ];

  const LINK_STEPS = ['ui.profileDialog.device.step1', 'ui.profileDialog.device.step2', 'ui.profileDialog.device.step3'];
  const icon = (name: string) => `var(--icon-${name}) center/contain no-repeat`;
  const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  // a principal: groups of five lower-case letters and digits, the last one shorter or not
  const PRINCIPAL = /^([a-z0-9]{5}-){4,}[a-z0-9]{1,5}$/;
  /** A principal's first two and last two groups with the rest elided; anything else (an email address) as it is. */
  const shortId = (id: string) => {
    if (!PRINCIPAL.test(id)) return id;
    const groups = id.split('-');
    return `${groups.slice(0, 2).join('-')}-…-${groups.slice(-2).join('-')}`;
  };
</script>

<script lang="ts">
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { Optimistic } from '../../lib/behaviours/optimistic.svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
  import Badge from '../../lib/components/Badge.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import { getI18n, segments, useT, type I18nParams } from '../../lib/i18n';
  import CopyButton from '../../lib/components/CopyButton.svelte';
  import Translate from '../../lib/components/Translate.svelte';

  interface Props {
    handle: string;
    userId: string;
    /** Literal text; without it, the date of `joined` in the host's locale. */
    memberSince?: string;
    streak: number;
    /** CHIT balance. */
    balance: number;
    name?: string;
    about?: string;
    /** CSS background for the avatar / cover. */
    avatar?: string;
    cover?: string;
    isDiamond?: boolean;
    isVerified?: boolean;
    /** Today's CHIT can still be claimed. */
    claimable?: boolean;
    /** Section to open on. */
    section?: ProfileSection;
    /** The sections offered in the nav, for a host that has built only some; defaults to all. */
    sections?: ProfileSection[];

    // CHIT
    chitEnabled?: boolean;
    chitNotify?: boolean;
    chitHideAfterClaim?: boolean;
    puzzleShown?: boolean;
    puzzleRemind?: boolean;
    /** Offer the daily puzzle setting; false for a host that has none. Defaults to true. */
    puzzleSetting?: boolean;
    /** Calendar shows claim times in UTC instead of local time. */
    chitUtc?: boolean;
    /** Local time offset used for the calendar's claim times; defaults to this browser's. */
    utcOffsetMinutes?: number;
    /** Claim history for the calendar (any order). */
    claimHistory?: ClaimDay[];
    /** "Today" for the calendar, ms epoch; defaults to now. */
    today?: number;
    /** When the account was created, ms epoch: the calendar doesn't page back before it. Defaults to `today`. */
    joined?: number;
    achievementsLeft?: number;
    /** All-time CHIT earned, shown in the delete flow. */
    chitEarned?: number;

    // stats
    onlineMinutes?: number;
    onlineMinutesPrev?: number;
    messageMix?: { label: string; count: number; color?: string }[];
    /** A number shows in the host's locale. */
    engagement?: { count: number | string; label: string }[];
    reported?: number;

    // settings
    communities?: ProfileCommunity[];
    /** Custom display name per community id. */
    communityNames?: Record<string, string>;
    signinMethods?: SigninMethod[];
    /** Resource key (or literal text): how the log-out confirmation names the sign-in method. */
    signInProvider?: string;
    chatSettings?: Partial<ChatSettings>;
    themePref?: 'system' | 'dark' | 'light';
    accentPref?: 'pink' | 'blue' | 'orange' | 'green';
    fontSize?: 'small' | 'default' | 'large' | 'larger';
    storageUsedMB?: number;
    /** Storage allowance in MB; defaults to 1024 for Diamond, else 100. */
    storageLimitMB?: number;
    /** Issue a device-link code (from the backend). The countdown runs to its expiresAt (ms epoch); without this the
     *  Show code button is hidden. */
    onRequestLinkCode?: () => Promise<{ code: string; expiresAt: number }>;
    inviteLink?: string;
    /** The invite link's QR code, drawn by the host (given the link); without it the dialog draws one with a global
     *  `qrcode` library, if the page has loaded one. */
    qrCode?: Snippet<[string]>;
    /** Rewards for inviting friends ("Becomes a Diamond member" → 5000); the list is hidden when empty. */
    inviteRewards?: { label: string; amount: number }[];
    /** Bot configuration values; a row is hidden when its value is absent. */
    icHost?: string;
    storageIndex?: string;
    publicKey?: string;
    /** Base for the About links (`${aboutBaseUrl}/features` …). */
    aboutBaseUrl?: string;
    /** The About pages the host has (`features`, `roadmap`, `metrics` …), for one without them all; defaults to all. */
    aboutPages?: string[];
    /** "Bot docs" link on the Bot configuration page. */
    botDocsUrl?: string;
    platform?: string;
    version?: string;

    onClose?: () => void;
    /** The section shown, as it opens and each time the user moves to another (for a host that loads a section's data
     *  only when it's seen). */
    onSectionChange?: (section: ProfileSection) => void;
    /** Open the CHIT dialog: it replaces this one, over the same backdrop (no exit plays). */
    onChit?: () => void;
    onEarn?: () => void;
    /** Open the Diamond dialog: it replaces this one, over the same backdrop (no exit plays). */
    onDiamond?: () => void;
    /** Save the profile fields. Reject to keep the editor open with an error. */
    onSave?: (v: { name: string; handle: string; about: string }) => Promise<unknown> | void;
    /** Whether a username is free (checked before saving a new one). */
    checkHandle?: (handle: string) => Promise<boolean>;
    /** Log out; the dialog closes once it resolves. Hidden without it. */
    onLogout?: () => Promise<unknown> | void;
    /** Delete the account after the user typed their handle; the host re-authenticates. Hidden without it. */
    onDeleteAccount?: (confirmedHandle: string) => Promise<unknown> | void;
    onShareApp?: (link: string) => void;
    onCoverEdit?: (isDiamond: boolean) => void;
    onPhotoEdit?: () => void;
    onChitSettings?: (patch: ChitSettingsPatch) => void;
    onChitBribe?: () => void;
    /** Set (or clear, with null) your name in a community. Rolls back with an error on rejection. */
    onCommunityName?: (communityId: string, name: string | null) => Promise<unknown> | void;
    /** A change of one setting, with the others as the host sent them. The toggle shows the new value until this
     *  settles; then the host's `chatSettings` show, so a change it didn't take goes back. */
    onChatSettings?: (settings: ChatSettings) => Promise<unknown> | void;
    onAppearance?: (patch: { theme?: string; accent?: string; font?: string }) => void;
    /** Clear this device's cache; "Cleared" shows once it resolves. Hidden without it. */
    onClearCache?: () => Promise<unknown> | void;
    /** Play a ringtone preview; may return a function that stops it. The play buttons are hidden without it. */
    onPreviewRingtone?: (tone: ChatSettings['ringtone']) => void | (() => void);
    /** Sign-in methods. Each control is hidden when its callback is absent; rejections show an error, the given one when they reject with { reason } (resource key or literal text), none when they reject with { cancelled: true } (the user gave the step up). */
    /** Create a passkey / sign in with II and link it (the host also confirms with the current method). */
    onLinkMethod?: (type: 'passkey' | 'ii') => Promise<SigninMethod>;
    /** Email a one-time code to this address. */
    onRequestEmailCode?: (email: string) => Promise<unknown>;
    /** Check the code and link the email. */
    onVerifyEmailCode?: (email: string, code: string) => Promise<SigninMethod>;
    onUnlinkMethod?: (id: string) => Promise<unknown>;
    onReportIssue?: () => void;
  }

  let {
    handle,
    userId,
    memberSince,
    streak,
    balance,
    name = '',
    about = '',
    avatar = 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    cover = 'var(--cover-pattern)',
    isDiamond = false,
    isVerified = false,
    claimable = false,
    section: initialSection = 'profile',
    sections,
    chitEnabled = true,
    chitNotify = true,
    chitHideAfterClaim = false,
    puzzleShown = true,
    puzzleRemind = false,
    puzzleSetting = true,
    chitUtc = false,
    utcOffsetMinutes = -new Date().getTimezoneOffset(),
    claimHistory = [],
    today: todayProp,
    joined: joinedProp,
    achievementsLeft = 0,
    chitEarned = 0,
    onlineMinutes = 0,
    onlineMinutesPrev = 0,
    messageMix = [],
    engagement = [],
    reported = 0,
    communities = [],
    communityNames = {},
    signinMethods = [],
    signInProvider = 'ui.profileDialog.logout.defaultProvider',
    chatSettings = {},
    themePref = 'dark',
    accentPref = 'pink',
    fontSize = 'default',
    storageUsedMB,
    storageLimitMB,
    onRequestLinkCode,
    inviteLink,
    qrCode,
    inviteRewards = [],
    icHost,
    storageIndex,
    publicKey,
    aboutBaseUrl = 'https://oc.app',
    aboutPages,
    botDocsUrl = 'https://github.com/open-chat-labs/open-chat-bots',
    platform = 'Web',
    version = '',
    onClose,
    onSectionChange,
    onChit,
    onEarn,
    onDiamond,
    onSave,
    checkHandle,
    onLogout,
    onDeleteAccount,
    onShareApp,
    onCoverEdit,
    onPhotoEdit,
    onChitSettings,
    onChitBribe,
    onCommunityName,
    onChatSettings,
    onAppearance,
    onClearCache,
    onPreviewRingtone,
    onLinkMethod,
    onRequestEmailCode,
    onVerifyEmailCode,
    onUnlinkMethod,
    onReportIssue,
  }: Props = $props();
  const t = useT();
  const i18n = getI18n();
  // numbers in the host's locale
  const fmt = (n: number) => Number(n).toLocaleString(i18n.locale ?? 'en');
  // month / weekday names come from Intl in the host's locale
  const dateFmt = (opts: Intl.DateTimeFormatOptions, t: number) => new Intl.DateTimeFormat(i18n.locale ?? 'en', { timeZone: 'UTC', ...opts }).format(t);
  /** A message as [text, strong] runs: the `bold` placeholders come back as their values, marked strong. */
  type Run = [string, boolean?];
  const rich = (key: string, bold: Record<string, string>, params: I18nParams = {}): Run[] =>
    segments(t, key, Object.keys(bold), params).map((seg): Run => ('slot' in seg ? [bold[seg.slot], true] : [seg.text, false]));

  // ---- shell ----
  let section = $derived<ProfileSection>(initialSection);
  // the exit (lib/behaviours/dialog.svelte.ts): once the dialog leaves it never comes back and drops off the modal stack
  /** Field being edited: a profile field key or "comm:<community>". */
  let editing = $state<string | null>(null);
  let draft = $state('');
  let field = $state<HTMLInputElement | HTMLTextAreaElement>();

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
    return t;
  };
  const cancel = (t: ReturnType<typeof setTimeout> | undefined) => {
    if (t === undefined) return;
    clearTimeout(t);
    timers.delete(t);
  };

  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());
  // nothing dismisses the dialog while a field save, the delete or the log-out is in flight: its result must be seen
  function close(fn?: () => void) {
    if (fieldBusy || delBusy || loBusy) return;
    flow.leave(fn);
  }

  // to another dialog, which opens in this one's place: the backdrop stays, only that dialog animates in
  function handOff(fn?: () => void) {
    if (fieldBusy || delBusy || loBusy) return;
    flow.handOff(fn);
  }

  // the About links to the pages the host has (aboutPages), and a group only with some
  const aboutGroups = $derived(
    ABOUT_GROUPS.map((g) => ({ ...g, keys: g.keys.filter((k) => !aboutPages || aboutPages.includes(k)) })).filter((g) => g.keys.length > 0),
  );

  $effect(() => {
    const shown = section;
    untrack(() => onSectionChange?.(shown));
  });

  // a section the host doesn't offer is never shown
  const offered = (s: ProfileSection) => sections === undefined || sections.includes(s);

  function go(next: ProfileSection) {
    if (!offered(next)) return;
    section = next;
    if (!fieldBusy) editing = null;
  }

  // while a field save is pending the editor stays on that field, so its result or error lands where it belongs
  function startEdit(key: string, value: string) {
    if (fieldBusy) return;
    editing = key;
    draft = value;
    fieldError = null;
  }

  function stopEdit() {
    if (fieldBusy) return;
    editing = null;
    draft = '';
    fieldError = null;
  }

  // focus the field being edited, caret at the end
  $effect(() => {
    if (!editing || !field) return;
    const el = field;
    untrack(() => {
      el.focus();
      const n = el.value.length;
      try {
        el.setSelectionRange(n, n);
      } catch {
        // input types without a selection (email, number) keep the default caret
      }
    });
  });

  // ---- profile ----
  // values the host has confirmed but not yet sent back as props; dropped whenever the props change
  let saved = $state<Partial<Record<FieldKey, string>>>({});
  $effect.pre(() => {
    void name;
    void handle;
    void about;
    untrack(() => (saved = {}));
  });
  const values = $derived({ name: saved.name ?? name, handle: saved.handle ?? handle, about: saved.about ?? about });
  let fieldBusy = $state(false);
  // a resource key: handle taken / save failed
  let fieldError = $state<string | null>(null);
  const shownName = $derived(values.name || values.handle);

  function validate(key: string, v: string) {
    if (key === 'handle') {
      if (v.length < 3) return 'ui.profileDialog.fields.handleTooShort';
      if (!/^[A-Za-z0-9_]+$/.test(v)) return 'ui.profileDialog.fields.handleInvalid';
    }
    return null;
  }

  async function saveField() {
    const key = editing as FieldKey | null;
    if (!key || fieldBusy || validate(key, draft)) return;
    const v = key === 'about' ? draft : draft.trim();
    if (v === values[key]) return stopEdit();
    fieldBusy = true;
    fieldError = null;
    try {
      if (key === 'handle' && checkHandle && !(await checkHandle(v))) {
        fieldError = 'ui.profileDialog.fields.handleTaken';
        return;
      }
      await onSave?.({ ...values, [key]: v });
    } catch {
      fieldError = 'ui.profileDialog.fields.saveFailed';
      return;
    } finally {
      fieldBusy = false;
    }
    saved = { ...saved, [key]: v };
    stopEdit();
  }

  const chitTag = $derived(balance >= 1e6 ? `${+(balance / 1e6).toFixed(1)}M` : balance >= 1e3 ? `${+(balance / 1e3).toFixed(1)}K` : String(balance));

  // ---- stats ----
  const mixTotal = $derived(messageMix.reduce((s, x) => s + x.count, 0) || 1);
  const mixTop = $derived(Math.max(1, ...messageMix.map((x) => x.count)));
  const onlinePct = $derived(onlineMinutesPrev ? Math.round(((onlineMinutes - onlineMinutesPrev) / onlineMinutesPrev) * 1000) / 10 : 0);
  // neutral until it becomes a signal worth flagging
  const reportTone = $derived(reported >= 25 ? 'var(--status-danger)' : reported >= 10 ? 'var(--status-warning)' : null);

  // ---- CHIT ----
  let monthOffset = $state(0);
  let hoverDay = $state<number | null>(null);
  const setChit = (patch: ChitSettingsPatch) => onChitSettings?.(patch);
  const puzzleMode = $derived(!puzzleShown ? 'off' : puzzleRemind ? 'remind' : 'show');

  const TODAY = $derived(dayStart(todayProp ?? Date.now()));
  const hist = $derived(Object.fromEntries(claimHistory.map((c) => [c.day, c])) as Record<string, ClaimDay>);

  const calendar = $derived.by(() => {
    const now = new Date(TODAY);
    const total = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const joinedAt = new Date(joinedProp ?? TODAY);
    const minTotal = Math.min(total, joinedAt.getUTCFullYear() * 12 + joinedAt.getUTCMonth());
    const view = Math.max(minTotal, total - monthOffset);
    const y = Math.floor(view / 12), mo = view % 12;
    const lead = new Date(Date.UTC(y, mo, 1)).getUTCDay();
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const hhmm = (m: number) => {
      m = ((m % 1440) + 1440) % 1440;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    };
    type Cell = {
      day?: number;
      kind: 'blank' | 'claim' | 'future' | 'insured' | 'claimed' | 'missed';
      amount?: number;
      col: number;
      head?: string;
      lines?: { text: string; tone: 'ink' | 'chit' | 'online' | 'muted' }[];
      title?: string;
    };
    const cells: Cell[] = [];
    let chit = 0, claimed = 0, insured = 0;
    for (let i = 0; i < lead; i++) cells.push({ kind: 'blank', col: i });
    for (let d = 1; d <= dim; d++) {
      const ts = Date.UTC(y, mo, d), rec = hist[dayKey(ts)], col = (lead + d - 1) % 7;
      const head = t('ui.profileDialog.calendar.dayHead', { weekday: dateFmt({ weekday: 'short' }, ts), day: d, month: dateFmt({ month: 'long' }, ts) });
      if (ts === TODAY && claimable) cells.push({ day: d, kind: 'claim', col, title: t('ui.profileDialog.calendar.claimToday') });
      else if (ts > TODAY) cells.push({ day: d, kind: 'future', col });
      else if (rec?.insured) {
        insured++;
        cells.push({
          day: d,
          kind: 'insured',
          col,
          head,
          lines: [
            { text: t('ui.profileDialog.calendar.insured'), tone: 'online' },
            { text: t('ui.profileDialog.calendar.streakKept', { day: rec.streakDay }), tone: 'muted' },
          ],
        });
      } else if (rec && rec.amount != null) {
        chit += rec.amount;
        claimed++;
        const time =
          rec.minute == null
            ? null
            : chitUtc
              ? t('ui.profileDialog.calendar.timeUtc', { time: hhmm(rec.minute) })
              : t('ui.profileDialog.calendar.timeLocal', { time: hhmm(rec.minute + utcOffsetMinutes) });
        cells.push({
          day: d,
          kind: 'claimed',
          amount: rec.amount,
          col,
          head,
          lines: [
            ...(time ? [{ text: t('ui.profileDialog.calendar.claimedAt', { time }), tone: 'ink' as const }] : []),
            { text: t('ui.profileDialog.calendar.claimedAmount', { amount: rec.amount, day: rec.streakDay }), tone: 'chit' },
          ],
        });
      } else cells.push({ day: d, kind: 'missed', col, title: t('ui.profileDialog.calendar.notClaimed', { day: d, month: dateFmt({ month: 'short' }, ts) }) });
    }
    while (cells.length % 7) cells.push({ kind: 'blank', col: cells.length % 7 });
    return { cells, label: dateFmt({ month: 'long', year: 'numeric' }, Date.UTC(y, mo, 1)), chit, claimed, insured, canPrev: view > minTotal, canNext: view < total, maxOffset: total - minTotal };
  });

  // ---- chats & calls ----
  let chatOverrides = $state<Partial<ChatSettings>>({});
  let playing = $state<ChatSettings['ringtone'] | null>(null);
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let stopPreview: (() => void) | undefined;
  const chat = $derived<ChatSettings>({ ...CHAT_DEFAULTS, ...chatSettings, ...chatOverrides });

  async function setChat<K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) {
    chatOverrides = { ...chatOverrides, [key]: value };
    // without a host the toggle keeps its value (the docs)
    if (!onChatSettings) return;
    try {
      // the host's settings, not other toggles still waiting on it
      await onChatSettings({ ...CHAT_DEFAULTS, ...chatSettings, [key]: value });
    } finally {
      // the host's value shows from now on, unless the toggle has changed again meanwhile
      if (chatOverrides[key] === value) {
        const rest = { ...chatOverrides };
        delete rest[key];
        chatOverrides = rest;
      }
    }
  }

  function endPreview() {
    cancel(previewTimer);
    stopPreview?.();
    stopPreview = undefined;
    playing = null;
  }

  // the host plays the sound; the waveform animates for the preview's length
  function preview(e: Event, tone: ChatSettings['ringtone']) {
    e.stopPropagation();
    const same = playing === tone;
    endPreview();
    if (same || !onPreviewRingtone) return;
    playing = tone;
    stopPreview = onPreviewRingtone(tone) || undefined;
    previewTimer = later(endPreview, 2500);
  }

  // ---- communities ----
  let commQuery = $state('');
  // optimistic per community (lib/behaviours/optimistic.svelte.ts): latest call wins, a rejected latest call falls back
  // to the name the host last accepted, new host names are followed once nothing is in flight
  const commStates = $state<Record<string, Optimistic<string | undefined>>>({});
  let lastComm = $state<ProfileCommunity | null>(null);
  $effect.pre(() => {
    void communityNames;
    untrack(() => Object.values(commStates).forEach((o) => o.sync()));
  });
  const commNames = $derived(Object.fromEntries([...new Set([...Object.keys(communityNames), ...Object.keys(commStates)])].map((id) => [id, commStates[id] ? commStates[id].current : communityNames[id]])) as Record<string, string | undefined>);
  const commError = $derived(lastComm && commStates[lastComm.id]?.failed ? t('ui.profileDialog.communities.saveFailed', { community: lastComm.name }) : null);
  const shownCommunities = $derived.by(() => {
    const q = commQuery.trim().toLowerCase();
    return q ? communities.filter((c) => c.name.toLowerCase().includes(q)) : communities;
  });

  function commitCommunity(c: ProfileCommunity, value: string) {
    lastComm = c;
    stopEdit();
    const state = (commStates[c.id] ??= new Optimistic(() => communityNames[c.id]));
    state.set(value, () => onCommunityName?.(c.id, value || null));
  }

  // ---- sign-in providers ----
  // passkey / II: one host call (create or sign in, then confirm with the current method); email: send a code, verify it
  type Adding = { type: SigninMethod['type']; step: 'new' | 'email' | 'code'; email: string; code: string; waiting?: boolean; error?: string };
  let siRemoved = $state<string[]>([]);
  let siAdded = $state<SigninMethod[]>([]);
  let siAdding = $state<Adding | null>(null);
  let siToast = $state<{ text: string } | null>(null);
  let siToastTimer: ReturnType<typeof setTimeout> | undefined;
  let siRun = 0;

  // a method linked here is listed until the host's signinMethods includes it, then only once
  const siAll = $derived([...signinMethods, ...siAdded.filter((a) => !signinMethods.some((m) => m.id === a.id))].filter((x) => !siRemoved.includes(x.id)));
  // only the method the host marks as current is locked; nothing is guessed
  const siCurrent = $derived(siAll.find((x) => x.current));
  const emailOk = $derived(!!siAdding && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(siAdding.email));
  const codeOk = $derived(!!siAdding && /^\d{6}$/.test(siAdding.code));
  const siBlocked = $derived(!!siAdding && (!!siAdding.waiting || (siAdding.step === 'email' && !emailOk) || (siAdding.step === 'code' && !codeOk)));
  const canAdd = (type: SigninMethod['type']) => (type === 'email' ? !!onRequestEmailCode && !!onVerifyEmailCode : !!onLinkMethod);

  function toast(text: string) {
    cancel(siToastTimer);
    siToast = { text };
    siToastTimer = later(() => (siToast = null), 5000);
  }

  function updateAdding(patch: Partial<Adding>) {
    if (siAdding) siAdding = { ...siAdding, ...patch };
  }

  function finishAdding(method: SigninMethod) {
    siAdded = [...siAdded, { ...method, current: false }];
    siAdding = null;
    toast(t('ui.profileDialog.signin.linked', { method: t(SI_TYPES[method.type].noun) }));
  }

  // runs a host step for the open "add" form; a newer form or Cancel makes it stale
  async function siStep<T>(call: () => Promise<T>, failKey: string, done: (v: T) => void) {
    const mine = ++siRun;
    updateAdding({ waiting: true, error: undefined });
    let value: T;
    try {
      value = await call();
    } catch (e) {
      // a host can say why, as AuthDialog's AuthFailure: { reason } (resource key or literal text), or that the user
      // gave the step up: { cancelled: true }, back to the form with nothing said
      const given = e as { reason?: unknown; cancelled?: unknown } | null;
      const reason = typeof given?.reason === 'string' && given.reason ? given.reason : failKey;
      if (mine === siRun) updateAdding({ waiting: false, error: given?.cancelled === true ? undefined : reason });
      return;
    }
    if (mine !== siRun) return;
    updateAdding({ waiting: false });
    done(value);
  }

  function startAdding(type: SigninMethod['type']) {
    siRun++;
    siAdding = { type, step: type === 'email' ? 'email' : 'new', email: '', code: '' };
  }

  function cancelAdding() {
    siRun++;
    siAdding = null;
  }

  function sendCode() {
    const a = siAdding;
    if (!a || !emailOk || a.waiting || !onRequestEmailCode) return;
    siStep(() => onRequestEmailCode(a.email), 'ui.profileDialog.signin.sendFailed', () => updateAdding({ step: 'code', code: '' }));
  }

  function verifyCode() {
    const a = siAdding;
    if (!a || !codeOk || a.waiting || !onVerifyEmailCode) return;
    siStep(() => onVerifyEmailCode(a.email, a.code), 'ui.profileDialog.signin.verifyFailed', finishAdding);
  }

  function linkMethod() {
    const a = siAdding;
    if (!a || a.type === 'email' || a.waiting || !onLinkMethod) return;
    const type = a.type;
    siStep(() => onLinkMethod(type), 'ui.profileDialog.signin.linkFailed', finishAdding);
  }

  // hidden while it runs, restored with a message if the host rejects
  async function unlink(x: SigninMethod) {
    if (!onUnlinkMethod) return;
    siRemoved = [...siRemoved, x.id];
    try {
      await onUnlinkMethod(x.id);
      toast(t('ui.profileDialog.signin.unlinked', { method: x.title }));
    } catch {
      siRemoved = siRemoved.filter((id) => id !== x.id);
      toast(t('ui.profileDialog.signin.unlinkFailed', { method: x.title }));
    }
  }

  type CheckItem = { label: string; state: 'done' | 'now' | 'wait' | 'todo'; action?: string; run?: () => void };
  const checklist = $derived.by((): CheckItem[] => {
    const a = siAdding;
    if (!a || a.type === 'email') return [];
    const state = a.waiting ? 'wait' : 'now';
    return [
      {
        label: t(a.type === 'passkey' ? 'ui.profileDialog.signin.createPasskey' : 'ui.profileDialog.signin.signInIi'),
        state,
        action: t(a.type === 'passkey' ? 'ui.profileDialog.signin.create' : 'ui.profileDialog.signin.signIn'),
        run: linkMethod,
      },
      ...(siCurrent ? [{ label: t('ui.profileDialog.signin.confirmWith', { method: siCurrent.short ?? siCurrent.title }), state: a.waiting ? ('wait' as const) : ('todo' as const) }] : []),
    ];
  });

  function addingKey(e: KeyboardEvent, ok: boolean, run: () => void) {
    if (e.key === 'Enter' && ok) run();
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancelAdding();
    }
  }

  // ---- appearance ----
  const setAppearance = (patch: { theme?: string; accent?: string; font?: string }) => onAppearance?.(patch);
  const sampleSize = $derived(onAppearance ? '13.5px' : `${Math.round(13.5 * (FONT_SIZES.find((f) => f.key === fontSize) ?? FONT_SIZES[1]).scale * 10) / 10}px`);

  // ---- storage ----
  let cache = $state<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const storageCap = $derived(storageLimitMB ?? (isDiamond ? 1024 : 100));
  const storageUsed = $derived(Math.min(storageCap, storageUsedMB ?? 0));
  const storageRatio = $derived(storageUsed / storageCap);
  const storageTone = $derived(storageRatio >= 0.95 ? 'var(--status-danger)' : storageRatio >= 0.8 ? 'var(--status-chit)' : null);
  const mb = (v: number) => (v >= 1000 ? `${(v / 1024).toFixed(2).replace(/\.?0+$/, '')} GB` : `${Math.round(v * 10) / 10} MB`);

  async function clearCache() {
    if (!onClearCache || cache === 'busy' || cache === 'done') return;
    cache = 'busy';
    try {
      await onClearCache();
      cache = 'done';
    } catch {
      cache = 'failed';
    }
  }

  // ---- bots ----
  const botRows = $derived(
    [
      { key: 'host', label: 'ui.profileDialog.bots.host', value: icHost },
      { key: 'storage', label: 'ui.profileDialog.bots.storage', value: storageIndex },
      { key: 'key', label: 'ui.profileDialog.bots.publicKey', value: publicKey },
    ].filter((r): r is { key: string; label: string; value: string } => !!r.value),
  );

  // ---- link device ----
  let lcCode = $state<string | null>(null);
  let lcLeft = $state(0);
  let lcHidden = $state(false);
  let lcCopied = $state(false);
  let lcTicker: ReturnType<typeof setInterval> | undefined;
  const lcLive = $derived(!!lcCode && lcLeft > 0);

  let lcSpan = $state(1); // seconds the current code was issued for, for the progress bar
  let lcState = $state<'idle' | 'loading' | 'failed'>('idle');
  let lcRun = 0;

  async function newLinkCode() {
    if (!onRequestLinkCode || lcState === 'loading') return;
    const mine = ++lcRun;
    lcState = 'loading';
    let issued: { code: string; expiresAt: number };
    try {
      issued = await onRequestLinkCode();
    } catch {
      if (mine === lcRun) lcState = 'failed';
      return;
    }
    if (mine !== lcRun) return;
    lcState = 'idle';
    const end = issued.expiresAt;
    clearInterval(lcTicker);
    lcHidden = false;
    lcCode = issued.code;
    lcLeft = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    lcSpan = Math.max(1, lcLeft);
    lcCopied = false;
    lcTicker = setInterval(() => {
      lcLeft = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (!lcLeft) {
        clearInterval(lcTicker);
        lcCode = null;
        lcHidden = false;
      }
    }, 250);
  }

  // ---- delete account ----
  let delOpen = $state(false);
  let delStep = $state(0);
  let delBusy = $state(false);
  let delTyped = $state('');
  let delError = $state(false);
  const delMatch = $derived(delTyped.trim().replace(/^@/, '').toLowerCase() === values.handle.toLowerCase());
  const delNextMile = $derived.by(() => {
    const n = [14, 30, 100, 365].find((v) => v > streak);
    return n ? t('ui.profileDialog.delete.nextMilestone', { days: n - streak, n }) : t('ui.profileDialog.delete.allMilestones');
  });
  const delLocked = $derived(delStep === 3 && (!delMatch || delBusy));
  // never earned any CHIT: nothing to lose, but all of it still to discover
  const noChit = $derived(balance === 0 && chitEarned === 0);

  function openDelete() {
    delOpen = true;
    delStep = 0;
    delBusy = false;
    delTyped = '';
    delError = false;
  }

  function stayNow() {
    delOpen = false;
    delStep = 0;
    delBusy = false;
    delTyped = '';
    delError = false;
  }

  // the host re-authenticates and deletes; the sheet stays (with an error) unless it resolves
  async function deletePrimary() {
    if (delStep < 3) {
      if (delStep === 2) onChitBribe?.();
      stayNow();
      return;
    }
    if (delLocked || !onDeleteAccount) return;
    delBusy = true;
    delError = false;
    try {
      await onDeleteAccount(values.handle);
    } catch {
      delBusy = false;
      delError = true;
      return;
    }
    stayNow();
    delBusy = false;
    flow.leave(onClose);
  }

  function deleteSecondary() {
    if (delBusy) return;
    if (delStep < 3) delStep++;
    else stayNow();
  }

  const delSteps = $derived([
    {
      icon: 'chat',
      title: t('ui.profileDialog.delete.step1Title'),
      body: rich('ui.profileDialog.delete.step1Body', { gone: t('ui.profileDialog.delete.step1Gone') }),
      primary: t('ui.profileDialog.delete.step1Stay'),
      primaryIcon: 'heart',
      secondary: t('ui.profileDialog.delete.step1Next'),
    },
    {
      icon: 'wallet',
      title: t('ui.profileDialog.delete.step2Title'),
      body: rich('ui.profileDialog.delete.step2Body', { moveOut: t('ui.profileDialog.delete.step2MoveOut') }),
      primary: t('ui.profileDialog.delete.step2Stay'),
      primaryIcon: 'wallet',
      secondary: t('ui.profileDialog.delete.step2Next'),
    },
    noChit
      ? {
          icon: 'zap',
          title: t('ui.profileDialog.delete.step3NoChitTitle'),
          body: rich('ui.profileDialog.delete.step3NoChitBody', {}),
          primary: t('ui.profileDialog.delete.step3NoChitStay'),
          primaryIcon: 'zap',
          secondary: t('ui.profileDialog.delete.step3Next'),
        }
      : {
          icon: null,
          title: t('ui.profileDialog.delete.step3Title'),
          body: rich('ui.profileDialog.delete.step3Body', {
            balance: t('ui.profileDialog.delete.chitAmount', { amount: fmt(balance) }),
            streak: t('ui.profileDialog.delete.streak', { count: streak }),
          }),
          primary: t('ui.profileDialog.delete.step3Stay'),
          primaryIcon: 'zap',
          secondary: t('ui.profileDialog.delete.step3Next'),
        },
    {
      icon: 'trash',
      title: t('ui.profileDialog.delete.step4Title'),
      body: rich('ui.profileDialog.delete.step4Body', { gone: t('ui.profileDialog.delete.step4Gone') }),
      primary: t(delBusy ? 'ui.profileDialog.delete.reauthenticating' : 'ui.profileDialog.delete.reauthenticate'),
      primaryIcon: delBusy ? 'refresh' : 'trash',
      secondary: t('ui.profileDialog.delete.step4Stay'),
    },
  ]);

  // ---- log out ----
  let loOpen = $state(false);
  let loBusy = $state(false);
  let loError = $state(false);

  async function confirmLogout() {
    if (loBusy || !onLogout) return;
    loBusy = true;
    loError = false;
    try {
      await onLogout();
    } catch {
      loBusy = false;
      loError = true;
      return;
    }
    loOpen = false;
    loBusy = false;
    flow.leave(onClose);
  }

  // ---- invite ----
  let qr = $state<{ link: string; src: string } | null>(null);
  const link = $derived(inviteLink ?? `https://oc.app/?ref=${userId}`);

  // the QR library loads as a global script; retry until it is there
  type QrFactory = (typeNumber: number, level: string) => { addData(s: string): void; make(): void; getModuleCount(): number; isDark(y: number, x: number): boolean };
  $effect(() => {
    if (qrCode || section !== 'invite' || qr?.link === link) return;
    const target = link;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const build = () => {
      const lib = (window as unknown as { qrcode?: QrFactory }).qrcode;
      if (!lib) {
        retry = setTimeout(build, 300);
        return;
      }
      const q = lib(0, 'M');
      q.addData(target);
      q.make();
      const n = q.getModuleCount();
      let d = '';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
      qr = {
        link: target,
        src: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path d="${d}" fill="#000"/></svg>`),
      };
    };
    build();
    return () => clearTimeout(retry);
  });

  function shareInvite() {
    if (navigator.share) navigator.share({ title: t('ui.profileDialog.invite.shareTitle'), url: link }).catch(() => {});
    else onShareApp?.(link);
  }

  // ---- keyboard ----
  // Esc (via use:modal, so only while this is the topmost dialog): closes the log-out / delete sheet first, then the dialog
  function escape() {
    if (editing) return;
    if (loOpen) {
      if (!loBusy) loOpen = false;
    } else if (delOpen) {
      if (!delBusy) {
        delOpen = false;
        delStep = 0;
      }
    } else close(onClose);
  }

  onMount(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if ((e.key === 'Enter' || e.key === ' ') && target?.getAttribute?.('role') === 'button') {
        e.preventDefault();
        target.click();
        return;
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  onDestroy(() => {
    timers.forEach(clearTimeout);
    clearInterval(lcTicker);
    // a host sound that loops would otherwise keep playing after the dialog closes
    stopPreview?.();
  });
</script>

{#snippet glyph(name: string, cls = 'glyph')}<span class={cls} style:mask={icon(name)}></span>{/snippet}

{#snippet toggleRow(title: string, hint: string, on: boolean, change: (v: boolean) => void)}
  <div class="setting">
    <div class="setting-text"><span class="setting-title">{t(title)}</span><span class="setting-hint">{t(hint)}</span></div>
    <div class="setting-control"><Toggle {on} ariaLabel={title} onChange={change} /></div>
  </div>
{/snippet}

{#snippet chatGroup(group: (typeof CHAT_GROUPS)[number])}
  <div class="block">
    <span class="caps">{t(group.label)}</span>
    <div class="list">
      {#each group.rows as [key, title, hint], i}
        {#if i > 0}<div class="rule"></div>{/if}
        {@render toggleRow(title, hint, !!chat[key], (v) => setChat(key, v))}
      {/each}
    </div>
  </div>
{/snippet}

<div class="layer oc-dialog-layer" class:closing={flow.closing} role="dialog" aria-modal="true" use:modal={flow.closing ? undefined : escape}>
  <div class="oc-veil" onclick={() => close(onClose)} aria-hidden="true"></div>
  <div class="card">
    <div class="rail">
      <div class="rail-scroll">
        {#each NAV as group}
          {@const items = group.items.filter((i) => offered(i[0]) && (i[0] !== 'chit' || chitEnabled || section === 'chit'))}
          {#if items.length > 0}
          <div class="nav-group">
            <span class="nav-label">{t(group.label)}</span>
            {#each items as [key, title, iconName, tone]}
              {@const on = key === section}
              <div class="nav-item {tone ?? ''}" class:on onclick={() => (key === 'diamond' ? handOff(onDiamond) : go(key))} role="button" tabindex="0">
                <span class="nav-icon" style:mask={icon(iconName)}></span>
                <span class="nav-title">{t(title)}</span>
                <span class="nav-meta" class:upgrade={tone === 'diamond' && !isDiamond}
                  >{tone === 'chit' && chitEnabled ? t('ui.profileDialog.nav.streakShort', { count: streak }) : tone === 'diamond' ? t(isDiamond ? 'ui.profileDialog.nav.member' : 'ui.profileDialog.nav.upgrade') : ''}</span
                >
              </div>
            {/each}
          </div>
          {/if}
        {/each}
      </div>
      <div class="rail-foot">
        {#if onLogout}
        <div
          class="nav-item"
          onclick={() => {
            loOpen = true;
            loBusy = false;
            loError = false;
          }}
          role="button"
          tabindex="0"
        >
          <span class="nav-icon logout" style:mask={icon('leave')}></span>
          <span class="nav-title">{t('ui.profileDialog.logout.action')}</span>
        </div>
        {/if}
      </div>
    </div>

    <div class="main">
      <div class="main-head">
        <span class="section-title">{t(TITLES[section] ?? 'ui.profileDialog.nav.profile')}</span>
        <span class="head-close" onclick={() => close(onClose)} aria-label={t('ui.common.close')} role="button" tabindex="0" title={t('ui.common.close')}>{@render glyph('close', 'head-close-glyph')}</span>
      </div>

      {#if section === 'profile'}
        <div class="scroll gap-18">
          <div class="cover" style:background={cover}>
            {#if onCoverEdit}<span class="cover-edit" onclick={() => onCoverEdit(isDiamond)} aria-label={t('ui.profileDialog.profile.changeCover')} role="button" tabindex="0" title={t('ui.profileDialog.profile.changeCover')}>{@render glyph('edit', 'cover-edit-glyph')}</span>{/if}
          </div>
          <div class="identity">
            <span class="avatar" style:background={avatar}>
              {#if onPhotoEdit}<span class="photo-edit" onclick={() => onPhotoEdit()} aria-label={t('ui.profileDialog.profile.changePhoto')} role="button" tabindex="0" title={t('ui.profileDialog.profile.changePhoto')}>{@render glyph('edit', 'photo-edit-glyph')}</span>{/if}
            </span>
            <div class="identity-text">
              <div class="name-line">
                <span class="display-name">{shownName}</span>
                {#if isVerified}<span class="badge-slot"><Badge variant="verified" /></span>{/if}
                {#if isDiamond}<span class="badge-slot"><Badge variant="tag" label={t('ui.profileDialog.profile.diamondTag')} /></span>{/if}
                {#if chitEnabled}<span class="badge-slot chit-tag" onclick={() => go('chit')} aria-label={t('ui.profileDialog.delete.chitAmount', { amount: fmt(balance) })} role="button" tabindex="0" title={t('ui.profileDialog.delete.chitAmount', { amount: fmt(balance) })}
                    ><Badge variant="chit" label={chitTag} /></span
                  >{/if}
              </div>
              <div class="handle-line"><span class="handle">@{values.handle}</span></div>
            </div>
          </div>

          <span class="caps lead-caps">{t('ui.profileDialog.profile.publicProfile')}</span>
          <div class="list pull-up">
            {#each FIELDS as f, i}
              {@const value = values[f.key]}
              {@const err = editing === f.key ? validate(f.key, draft) : null}
              <div class="field" class:ruled={i > 0}>
                {#if editing !== f.key}
                  <div class="kv-row editable" onclick={() => startEdit(f.key, value)} role="button" tabindex="0">
                    <span class="kv-label">{t(f.label)}</span>
                    <span class="kv-value" class:mono={f.mono} class:area={f.area} class:empty={!value}>{!value ? t(f.placeholder) : f.mono ? `@${value}` : value}</span>
                    {@render glyph('edit', 'kv-edit')}
                  </div>
                {:else}
                  <div class="editor">
                    <div class="editor-head"><span class="editor-label">{t(f.label)}</span><span class="editor-count">{f.area ? `${draft.length} / ${f.max}` : ''}</span></div>
                    {#if f.area}
                      <textarea
                        class="area-input"
                        class:invalid={!!err}
                        bind:this={field}
                        value={draft}
                        oninput={(e) => (draft = e.currentTarget.value)}
                        onkeydown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            stopEdit();
                          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            saveField();
                          }
                        }}
                        maxlength={f.max}
                        rows="3"
                      ></textarea>
                    {:else}
                      <div class="line-input" class:invalid={!!err}>
                        {#if f.mono}<span class="at">@</span>{/if}
                        <input
                          class:mono={f.mono}
                          class:roomy={!f.mono}
                          bind:this={field}
                          value={draft}
                          oninput={(e) => (draft = e.currentTarget.value)}
                          onkeydown={(e) => {
                            if (e.key === 'Escape') {
                              e.stopPropagation();
                              stopEdit();
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              saveField();
                            }
                          }}
                          maxlength={f.max}
                          placeholder={f.placeholder ? t(f.placeholder) : ''}
                        />
                      </div>
                    {/if}
                    <div class="editor-foot">
                      <span class="editor-hint" class:invalid={!!err || !!fieldError} role={fieldError ? 'alert' : undefined}>{t(err || fieldError || f.hint)}</span>
                      <span class="cancel" onclick={stopEdit} role="button" tabindex="0">{t('ui.common.cancel')}</span>
                      <span class="save" class:blocked={!!err || fieldBusy} onclick={saveField} role="button" tabindex="0" aria-disabled={!!err || fieldBusy}
                        >{t(fieldBusy ? 'ui.profileDialog.fields.saving' : 'ui.common.save')}</span
                      >
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <span class="caps lead-caps">{t('ui.profileDialog.profile.account')}</span>
          <div class="list pull-up">
            <div class="kv-row">
              <span class="kv-label">{t('ui.profileDialog.profile.status')}</span>
              <span class="status"><span class="online-dot"></span>{t('ui.profileDialog.profile.online')}</span>
            </div>
            <div class="kv-row ruled">
              <span class="kv-label">{t('ui.profileDialog.profile.memberSince')}</span>
              <span class="kv-plain">{memberSince ?? (joinedProp === undefined ? '' : new Intl.DateTimeFormat(i18n.locale ?? 'en', { day: 'numeric', month: 'short', year: 'numeric' }).format(joinedProp))}</span>
            </div>
            <div class="kv-row ruled">
              <span class="kv-label">{t('ui.profileDialog.profile.userId')}</span>
              <span class="kv-id">{userId}</span>
              <span class="copy"><CopyButton value={userId} label="ui.profileDialog.profile.copyUserId" size="md" /></span>
            </div>
          </div>
        </div>
      {/if}

      {#if section === 'stats'}
        <div class="scroll stats-grid">
          <div class="stat-online">
            <div class="online-main">
              <span class="small-label">{t('ui.profileDialog.stats.onlineThisMonth')}</span><span class="online-figure">{fmt(onlineMinutes)}<span class="online-unit">{t('ui.profileDialog.stats.minutesUnit')}</span></span>
            </div>
            <div class="online-side">
              <span class="delta" class:down={onlinePct < 0}
                ><span class="delta-glyph" style:mask={icon(onlinePct >= 0 ? 'chevron-up' : 'chevron-down')}></span>{onlinePct >= 0 ? '+' : ''}{onlinePct}%</span
              >
              <span class="prev">{t('ui.profileDialog.stats.lastMonth', { amount: fmt(onlineMinutesPrev) })}</span>
            </div>
          </div>
          {#each engagement as e}
            <div class="stat-tile"><span class="tile-figure">{typeof e.count === 'number' ? fmt(e.count) : e.count}</span><span class="small-label">{t(e.label)}</span></div>
          {/each}
          <div class="stat-mix">
            <div class="mix-head"><span class="small-label grow">{t('ui.profileDialog.stats.messagesSent')}</span><span class="mix-total">{fmt(mixTotal)}</span></div>
            {#each messageMix as x, i}
              <div class="mix-row">
                <span class="mix-label">{t(x.label)}</span>
                <div class="mix-track">
                  <div class="mix-fill" style:width="{((x.count / mixTop) * 100).toFixed(2)}%" style:background={x.color || MIX_COLORS[i % MIX_COLORS.length]}></div>
                </div>
                <span class="mix-count">{fmt(x.count)}</span>
              </div>
            {/each}
          </div>
          <div class="stat-report">
            <span class="report-glyph" style:background={reportTone ?? 'var(--ink-3)'} style:mask={icon('flag')}></span>
            <div class="report-text">
              <span class="report-title">{t('ui.profileDialog.stats.reported')}</span><span class="report-note"
                >{t(reportTone ? 'ui.profileDialog.stats.reportedHigh' : 'ui.profileDialog.stats.reportedNote')}</span
              >
            </div>
            <span class="report-count" style:color={reportTone ?? 'var(--ink)'}>{fmt(reported)}</span>
          </div>
        </div>
      {/if}

      {#if section === 'chit'}
        <div class="scroll gap-16">
          <div class="chit-master">
            <span class="chit-badge">{@render glyph('zap', 'chit-badge-glyph')}</span>
            <div class="setting-text">
              <span class="setting-title">{t('ui.profileDialog.chit.enable')}</span><span class="setting-hint"
                >{t('ui.profileDialog.chit.enableHint')}</span
              >
            </div>
            <div class="setting-control"><Toggle on={chitEnabled} ariaLabel="ui.profileDialog.chit.enable" onChange={(v) => setChit({ enabled: v })} /></div>
          </div>
          {#if chitEnabled}
            <div class="block">
              <span class="caps">{t('ui.profileDialog.chit.notifications')}</span>
              <div class="list">
                {@render toggleRow('ui.profileDialog.chit.notify', 'ui.profileDialog.chit.notifyHint', chitNotify, (v) => setChit({ notify: v }))}
                <div class="rule"></div>
                {@render toggleRow(
                  'ui.profileDialog.chit.hideIcon',
                  'ui.profileDialog.chit.hideIconHint',
                  chitHideAfterClaim,
                  (v) => setChit({ hideAfterClaim: v }),
                )}
              </div>
            </div>
            {#if puzzleSetting}
            <div class="block">
              <span class="caps">{t('ui.profileDialog.chit.puzzleCaps')}</span>
              <div class="list puzzle">
                <div class="setting-text"><span class="setting-title">{t('ui.profileDialog.chit.puzzle')}</span><span class="setting-hint">{t('ui.profileDialog.chit.puzzleHint')}</span></div>
                <div class="segments three" role="radiogroup" aria-label={t('ui.profileDialog.chit.puzzle')}>
                  {#each [['off', 'ui.profileDialog.chit.puzzleOff', 'eye-off'], ['show', 'ui.profileDialog.chit.puzzleShow', 'eye'], ['remind', 'ui.profileDialog.chit.puzzleRemind', 'bell']] as [k, label, iconName]}
                    <span
                      class="segment"
                      class:on={puzzleMode === k}
                      onclick={() => setChit({ puzzle: k !== 'off', puzzleRemind: k === 'remind' })}
                      role="radio"
                      aria-checked={puzzleMode === k}
                      tabindex="0">{@render glyph(iconName, 'segment-glyph')}{t(label)}</span
                    >
                  {/each}
                </div>
                <span class="setting-hint"
                  >{t(
                    puzzleMode === 'off'
                      ? 'ui.profileDialog.chit.puzzleOffHint'
                      : puzzleMode === 'show'
                        ? 'ui.profileDialog.chit.puzzleShowHint'
                        : 'ui.profileDialog.chit.puzzleRemindHint',
                  )}</span
                >
              </div>
            </div>
            {/if}
          {:else}
            <p class="chit-off">
              {t('ui.profileDialog.chit.off', { amount: fmt(balance) })}
            </p>
          {/if}
          {#if chitEnabled}
            {#if onEarn}
            <div class="earn" onclick={() => close(onEarn)} role="button" tabindex="0">
              {@render glyph('trophy', 'earn-glyph')}
              <div class="earn-text"><span class="earn-title">{t('ui.profileDialog.chit.earnMore')}</span><span class="earn-left">{t('ui.profileDialog.chit.achievementsLeft', { count: achievementsLeft })}</span></div>
              {@render glyph('chevron-right', 'earn-chevron')}
            </div>
            {/if}
            <div class="month-bar">
              <span
                class="month-step"
                class:disabled={!calendar.canPrev}
                onclick={() => (monthOffset = Math.min(calendar.maxOffset, monthOffset + 1))}
                aria-label={t('ui.profileDialog.calendar.prevMonth')}
                role="button"
                tabindex="0"
                title={t('ui.profileDialog.calendar.prevMonth')}>{@render glyph('back', 'month-glyph')}</span
              >
              <div class="month-text">
                <span class="month-label">{calendar.label}</span>
                <span class="month-sum"
                  ><Translate key="ui.profileDialog.calendar.summary" params={{ claimed: calendar.claimed }}
                    >{#snippet chit()}<span class="chit-ink">{t('ui.profileDialog.delete.chitAmount', { amount: fmt(calendar.chit) })}</span>{/snippet}{#snippet insured()}<span
                        class:online-ink={calendar.insured > 0}>{t('ui.profileDialog.calendar.insuredCount', { count: calendar.insured })}</span
                      >{/snippet}</Translate
                  ></span
                >
              </div>
              <span
                class="month-step"
                class:disabled={!calendar.canNext}
                onclick={() => (monthOffset = Math.max(0, monthOffset - 1))}
                aria-label={t('ui.profileDialog.calendar.nextMonth')}
                role="button"
                tabindex="0"
                title={t('ui.profileDialog.calendar.nextMonth')}>{@render glyph('chevron-right', 'month-glyph')}</span
              >
              <span class="grow"></span>
              <div class="segments tz">
                {#each [['ui.profileDialog.calendar.local', false], ['UTC', true]] as [label, utc]}
                  <span class="tz-option" class:on={chitUtc === utc} onclick={() => setChit({ utc: utc as boolean })} role="button" tabindex="0">{t(label as string)}</span>
                {/each}
              </div>
            </div>
            <div class="calendar">
              {#each [0, 1, 2, 3, 4, 5, 6] as d}<span class="weekday">{dateFmt({ weekday: 'short' }, Date.UTC(2023, 0, 1 + d)).slice(0, 2)}</span>{/each}
              {#each calendar.cells as cell}
                <div
                  class="day {cell.kind}"
                  class:inert={cell.kind === 'claim' && !onChit}
                  onclick={cell.kind === 'claim' && onChit ? () => handOff(onChit) : undefined}
                  aria-label={cell.title ?? ''}
                  role="button"
                  tabindex="0"
                  onmouseenter={cell.lines ? () => (hoverDay = cell.day!) : undefined}
                  onmouseleave={cell.lines ? () => hoverDay === cell.day && (hoverDay = null) : undefined}
                  title={cell.title ?? ''}
                >
                  <span class="day-num">{cell.day ?? ''}</span>
                  <span class="day-amount"
                    >{#if cell.kind === 'insured'}<span class="day-shield"></span>{/if}{cell.kind === 'claim' ? t('ui.profileDialog.calendar.claim') : cell.kind === 'claimed' ? cell.amount : ''}</span
                  >
                  {#if cell.lines && hoverDay === cell.day}
                    <div class="pop" class:start={cell.col === 0} class:end={cell.col === 6}>
                      <span class="pop-head">{cell.head}</span>
                      {#each cell.lines as line}<span class="pop-line {line.tone}">{line.text}</span>{/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if section === 'chats'}
        <div class="scroll gap-18">
          {#each CHAT_GROUPS.slice(0, 2) as group}
            {@render chatGroup(group)}
          {/each}
          <div class="block">
            <span class="caps">{t('ui.profileDialog.chats.ringtone')}</span>
            <div class="list">
              {#each RINGTONES as [tone, label], i}
                {@const on = chat.ringtone === tone}
                {@const isPlaying = playing === tone}
                {#if i > 0}<div class="rule"></div>{/if}
                <div class="ringtone" onclick={() => setChat('ringtone', tone)} role="button" tabindex="0">
                  <span class="ringtone-label" class:on>{t(label)}</span>
                  <span class="wave">
                    {#each { length: 28 } as _, j}<span
                        class="wave-bar"
                        class:selected={on}
                        class:playing={isPlaying}
                        style:height="{Math.max(3, Math.round(WAVES[tone](j / 27) * 20))}px"
                      ></span>{/each}
                  </span>
                  {#if onPreviewRingtone}<span
                    class="play"
                    onclick={(e) => preview(e, tone)}
                    aria-label={isPlaying ? t('ui.profileDialog.chats.stopPreview') : t('ui.profileDialog.chats.preview', { name: t(label) })}
                    role="button"
                    tabindex="0"
                    title={isPlaying ? t('ui.profileDialog.chats.stopPreview') : t('ui.profileDialog.chats.preview', { name: t(label) })}
                    ><span class="play-glyph" class:playing={isPlaying} style:mask={icon(isPlaying ? 'stop' : 'play')}></span></span
                  >{/if}
                  <span class="tick-slot"><span class="tick" class:on></span></span>
                </div>
              {/each}
            </div>
          </div>
          {#each CHAT_GROUPS.slice(2) as group}
            {@render chatGroup(group)}
          {/each}
        </div>
      {/if}

      {#if section === 'communities'}
        <div class="scroll gap-8">
          <span class="lead-text">{t('ui.profileDialog.communities.lead')}</span>
          <span class="caps flat spaced">{t('ui.profileDialog.communities.caps')}</span>
          {#if commError}<span class="inline-error" role="alert">{commError}</span>{/if}
          {#if communities.length > 10}
            <div class="filter">
              {@render glyph('search', 'filter-glyph')}<input bind:value={commQuery} placeholder={t('ui.profileDialog.communities.filter')} />
            </div>
          {/if}
          <div class="list flat">
            {#each shownCommunities as c, i}
              {@const custom = commNames[c.id] || ''}
              {@const key = `comm:${c.id}`}
              {#if i > 0}<div class="rule"></div>{/if}
              {#if editing !== key}
                <div class="community" onclick={() => onCommunityName && startEdit(key, custom)} role="button" tabindex={onCommunityName ? 0 : -1} aria-disabled={!onCommunityName}>
                  <span class="community-face" style:background={c.avatar || GRADS[c.color ?? ''] || GRADS.slate}></span>
                  <span class="community-name">{c.name}</span>
                  <span class="community-shown" class:custom={!!custom}>{custom || shownName}</span>
                  <span class="community-tag">{custom ? '' : t('ui.profileDialog.communities.defaultTag')}</span>
                  {@render glyph('edit', 'kv-edit')}
                </div>
              {:else}
                <div class="editor">
                  <div class="community-edit-head"><span class="community-chip" style:background={c.avatar || GRADS[c.color ?? ''] || GRADS.slate}></span><span class="editor-label">{t('ui.profileDialog.communities.yourNameIn', { community: c.name })}</span></div>
                  <div class="line-input">
                    <input
                      bind:this={field}
                      value={draft}
                      oninput={(e) => (draft = e.currentTarget.value)}
                      onkeydown={(e) => {
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          stopEdit();
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          commitCommunity(c, draft.trim());
                        }
                      }}
                      maxlength="25"
                      placeholder={shownName}
                    />
                  </div>
                  <div class="editor-foot">
                    {#if custom}<span class="reset" onclick={() => commitCommunity(c, '')} role="button" tabindex="0">{t('ui.profileDialog.communities.useDefault')}</span>{/if}
                    <span class="editor-hint">{t('ui.profileDialog.communities.leaveEmpty', { name: shownName })}</span>
                    <span class="cancel" onclick={stopEdit} role="button" tabindex="0">{t('ui.common.cancel')}</span>
                    <span class="save" onclick={() => commitCommunity(c, draft.trim())} role="button" tabindex="0">{t('ui.common.save')}</span>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
          {#if communities.length === 0}
            <span class="no-match">{t('ui.profileDialog.communities.none')}</span>
          {:else if shownCommunities.length === 0}
            <span class="no-match">{t('ui.profileDialog.communities.noMatch', { query: commQuery })}</span>
          {/if}
        </div>
      {/if}

      {#if section === 'signin'}
        <div class="signin">
          <div class="scroll gap-18 toast-room">
            {#if siCurrent}
              <div class="current">
                <span class="current-tile">{@render glyph(SI_TYPES[siCurrent.type].icon, 'current-glyph')}</span>
                <div class="current-text"><span class="current-kicker">{t('ui.profileDialog.signin.signedInWith')}</span><span class="current-title">{siCurrent.title}</span><span class="current-id" title={siCurrent.id}>{shortId(siCurrent.id)}</span></div>
                <span class="locked" title={t('ui.profileDialog.signin.lockedTitle')}>{@render glyph('lock', 'locked-glyph')}{t('ui.profileDialog.signin.cantUnlink')}</span>
              </div>
            {/if}
            <span class="lead-text">{t('ui.profileDialog.signin.lead')}</span>
            {#each ['passkey', 'ii', 'email'] as const as type}
              {@const T = SI_TYPES[type]}
              {@const items = siAll.filter((x) => x.type === type && x !== siCurrent)}
              {@const adding = siAdding?.type === type}
              <div class="block">
                <span class="caps">{t(T.label)}</span>
                <div class="list">
                  {#each items as x}
                    <div class="method">
                      {@render glyph(T.icon, 'method-glyph')}
                      <div class="method-text"><span class="method-title">{x.title + (type === 'email' ? '' : ` · ${x.id.slice(0, 5)}`)}</span>{#if x.used || siAdded.some((a) => a.id === x.id)}<span class="method-sub">{x.used || t('ui.profileDialog.signin.justLinked')}</span>{/if}</div>
                      {#if onUnlinkMethod}<span class="unlink" onclick={() => unlink(x)} role="button" tabindex="0">{@render glyph('unlink', 'unlink-glyph')}{t('ui.profileDialog.signin.unlink')}</span>{/if}
                    </div>
                  {/each}
                  {#if !items.length && !adding}
                    <div class="method-empty">{t(T.empty)}</div>
                  {/if}
                  {#if !adding}
                    {#if canAdd(type)}<div class="add" onclick={() => startAdding(type)} role="button" tabindex="0">{@render glyph('plus', 'add-glyph')}{t(T.addLabel)}</div>{/if}
                  {:else if siAdding}
                    <div class="adding">
                      <div class="adding-head"><span class="adding-title">{t(SI_TYPES[siAdding.type].addTitle)}</span><span class="adding-cancel" onclick={cancelAdding} role="button" tabindex="0">{t('ui.common.cancel')}</span></div>
                      {#if siAdding.type === 'email' && siAdding.step === 'email'}
                        <div class="inline-form">
                          <div class="line-input grow">
                            <input
                              bind:this={field}
                              value={siAdding.email}
                              oninput={(e) => updateAdding({ email: e.currentTarget.value })}
                              onkeydown={(e) => addingKey(e, emailOk, sendCode)}
                              placeholder={t('ui.profileDialog.signin.emailPlaceholder')}
                              type="email"
                              disabled={siAdding.waiting}
                            />
                          </div>
                          <span class="primary" class:blocked={siBlocked} onclick={sendCode} role="button" tabindex="0" aria-disabled={siBlocked}
                            >{t(siAdding.waiting ? 'ui.profileDialog.signin.sending' : 'ui.profileDialog.signin.sendCode')}</span
                          >
                        </div>
                        <span class="adding-hint" class:invalid={(!!siAdding.email && !emailOk) || !!siAdding.error} role={siAdding.error ? 'alert' : undefined}
                          >{siAdding.error ? t(siAdding.error) : siAdding.email && !emailOk ? t('ui.profileDialog.signin.emailInvalid') : t('ui.profileDialog.signin.emailHint')}</span
                        >
                      {/if}
                      {#if siAdding.type === 'email' && siAdding.step === 'code'}
                        <div class="inline-form">
                          <div class="line-input grow">
                            <input
                              bind:this={field}
                              value={siAdding.code}
                              oninput={(e) => updateAdding({ code: e.currentTarget.value.replace(/\D/g, '').slice(0, 6) })}
                              onkeydown={(e) => addingKey(e, codeOk, verifyCode)}
                              placeholder={t('ui.profileDialog.signin.codePlaceholder')}
                              inputmode="numeric"
                              maxlength="6"
                              disabled={siAdding.waiting}
                            />
                          </div>
                          <span class="primary" class:blocked={siBlocked} onclick={verifyCode} role="button" tabindex="0" aria-disabled={siBlocked}
                            >{t(siAdding.waiting ? 'ui.profileDialog.signin.waiting' : 'ui.profileDialog.signin.verify')}</span
                          >
                        </div>
                        <span class="adding-hint" class:invalid={!!siAdding.error} role={siAdding.error ? 'alert' : undefined}
                          >{siAdding.error ? t(siAdding.error) : t('ui.profileDialog.signin.codeHint', { email: siAdding.email })}</span
                        >
                      {/if}
                      {#if siAdding.type !== 'email'}
                        {#each checklist as c}
                          <div class="check-row">
                            <span class="check-mark {c.state}"><span class="check-glyph"></span></span>
                            <span class="check-label {c.state}">{c.label}</span>
                            {#if c.state === 'now' && c.run}<span class="check-action" onclick={c.run} role="button" tabindex="0">{c.action}</span>{/if}
                            {#if c.state === 'wait'}<span class="waiting">{t('ui.profileDialog.signin.waiting')}</span>{/if}
                          </div>
                        {/each}
                        {#if siAdding.error}<span class="adding-hint invalid" role="alert">{t(siAdding.error)}</span>{/if}
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
          {#if siToast}
            <div class="toast">
              <span class="toast-text" role="status">{siToast.text}</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if section === 'appearance'}
        <div class="scroll gap-22">
          <div class="block wide-gap">
            <span class="caps">{t('ui.profileDialog.appearance.theme')}</span>
            <div class="themes">
              {#each THEMES as [k, label]}
                {@const p = THEME_PREVIEW[k]}
                <div class="theme" class:on={themePref === k} onclick={() => setAppearance({ theme: k })} role="button" tabindex="0">
                  <div class="preview" style:background={p.bg}>
                    <div class="bubble recv one" style:background={p.recv}></div>
                    <div class="bubble sent"></div>
                    <div class="bubble recv two" style:background={p.recv}></div>
                    <div class="preview-bar" style:background={p.bar}></div>
                  </div>
                  <div class="theme-label">
                    <span class="radio"><span class="radio-dot"></span></span>
                    <span class="theme-name">{t(label)}</span>
                  </div>
                </div>
              {/each}
            </div>
            <span class="note">{t('ui.profileDialog.appearance.systemNote')}</span>
          </div>
          <div class="block wide-gap">
            <span class="caps">{t('ui.profileDialog.appearance.accent')}</span>
            <div class="accents">
              {#each ACCENTS as [k, label, color]}
                <div class="accent" class:on={accentPref === k} onclick={() => setAppearance({ accent: k })} role="button" tabindex="0">
                  <span class="swatch" style:background={color}><span class="swatch-check"></span></span>
                  <span class="theme-name">{t(label)}</span>
                </div>
              {/each}
            </div>
          </div>
          <div class="block wide-gap">
            <span class="caps">{t('ui.profileDialog.appearance.size')}</span>
            <div class="list sizes-panel">
              <div class="segments sizes">
                {#each FONT_SIZES as f}
                  <span class="size" class:on={fontSize === f.key} onclick={() => setAppearance({ font: f.key })} role="button" tabindex="0"
                    ><span class="size-glyph" style:font-size={f.glyph}>A</span><span class="size-label">{t(f.label)}</span></span
                  >
                {/each}
              </div>
              <div class="sample">
                <div class="sample-bubble recv" style:font-size={sampleSize}>{t('ui.profileDialog.appearance.sampleQuestion')}</div>
                <div class="sample-bubble sent" style:font-size={sampleSize}>{t('ui.profileDialog.appearance.sampleAnswer')}</div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if section === 'storage'}
        <div class="scroll gap-22">
          <span class="lead-text">{t('ui.profileDialog.storage.lead')}</span>
          <div class="block wide-gap">
            <span class="caps">{t('ui.profileDialog.storage.remote')}</span>
            <div class="list">
              <!-- no allowance (none without Diamond): no meter, which would divide by it -->
              {#if storageCap > 0}
              <div class="usage">
                <div class="usage-head">
                  <span class="usage-figure">{mb(storageUsed)}</span>
                  <span class="usage-of">{t('ui.profileDialog.storage.usedOf', { total: mb(storageCap) })}</span>
                  <span class="usage-pct" style:color={storageTone ?? 'var(--ink-3)'}>{Math.round(storageRatio * 100)}%</span>
                </div>
                <div class="usage-track"><div class="usage-fill" style:width="{Math.round(storageRatio * 100)}%" style:background={storageTone ?? 'var(--accent)'}></div></div>
                <span class="setting-hint">{t('ui.profileDialog.storage.left', { left: mb(storageCap - storageUsed) })}</span>
              </div>
              {/if}
              {#if !isDiamond}
                <div class="upsell" onclick={() => handOff(onDiamond)} role="button" tabindex="0">
                  <span class="upsell-text">{t('ui.profileDialog.storage.upsell')}</span>
                  <span class="upsell-cta">{t('ui.profileDialog.storage.getDiamond')}</span>
                </div>
              {/if}
            </div>
          </div>
          <div class="block wide-gap">
            <span class="caps">{t('ui.profileDialog.storage.cache')}</span>
            <div class="list">
              <div class="cache-row">
                <div class="cache-text">
                  <span class="setting-title">{t('ui.profileDialog.storage.clearTitle')}</span>
                  <span class="setting-hint muted3"
                    >{t('ui.profileDialog.storage.clearHint')}</span
                  >
                </div>
                {#if onClearCache}<span class="outline-button {cache}" onclick={clearCache} role="button" tabindex="0" aria-disabled={cache === 'busy' || cache === 'done'}
                    ><span class="outline-glyph" class:spin={cache === 'busy'} style:mask={icon(cache === 'done' ? 'check' : 'refresh')}></span>{t(
                      cache === 'busy' ? 'ui.profileDialog.storage.clearing' : cache === 'done' ? 'ui.profileDialog.storage.cleared' : 'ui.profileDialog.storage.clear',
                    )}</span
                  >{/if}
              </div>
              {#if cache === 'failed'}<span class="inline-error padded" role="alert">{t('ui.profileDialog.storage.clearFailed')}</span>{/if}
              {#if onReportIssue}
              <div class="cache-row ruled">
                <div class="cache-text">
                  <span class="setting-title">{t(cache === 'done' ? 'ui.profileDialog.storage.fixed' : 'ui.profileDialog.storage.problems')}</span>
                  <span class="setting-hint muted3">{t('ui.profileDialog.storage.reportHint')}</span>
                </div>
                <span class="outline-button report" onclick={() => onReportIssue()} role="button" tabindex="0">{@render glyph('flag', 'outline-glyph flag')}{t('ui.profileDialog.storage.report')}</span>
              </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if section === 'bots'}
        <div class="scroll gap-18">
          <span class="lead-text tight"
            ><Translate key="ui.profileDialog.bots.lead"
              >{#snippet docs()}<a href={botDocsUrl} target="_blank" rel="noopener">{t('ui.profileDialog.bots.docs')}</a
                >{/snippet}</Translate
            ></span
          >
          <div class="list">
            {#each botRows as b, i}
              <div class="bot-row" class:ruled={i > 0}>
                <div class="bot-text">
                  <span class="small-label">{t(b.label)}</span>
                  <span class="bot-value" class:pre={b.key === 'key'}>{b.value}</span>
                </div>
                <span class="bot-copy"><CopyButton value={b.value} label={t('ui.profileDialog.bots.copy', { label: t(b.label) })} size="md" /></span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if section === 'device'}
        <div class="scroll gap-18">
          <span class="lead-text">{t('ui.profileDialog.device.lead')}</span>
          <div class="list">
            {#each LINK_STEPS as text, i}
              <div class="link-step" class:ruled={i > 0}>
                <span class="step-n">{i + 1}</span>
                <span class="step-text">{t(text)}</span>
              </div>
            {/each}
          </div>
          {#if !lcLive}
            <div class="code-intro">
              {@render glyph('shield', 'shield-glyph')}
              <span class="code-warning">{t('ui.profileDialog.device.warning')}</span>
              {#if onRequestLinkCode}
                <span class="show-code" onclick={newLinkCode} role="button" tabindex="0" aria-disabled={lcState === 'loading'}>{t(lcState === 'loading' ? 'ui.profileDialog.device.requesting' : 'ui.profileDialog.device.showCode')}</span>
              {/if}
            </div>
            {#if lcState === 'failed'}<span class="code-error" role="alert">{t('ui.profileDialog.device.failed')}</span>{/if}
          {:else}
            {@const warn = lcLeft <= 30}
            <div class="code-live">
              <div class="code-line">
                <span class="code" class:hidden={lcHidden}>{(lcCode ?? '').slice(0, 3)} {(lcCode ?? '').slice(3)}</span>
                <CopyButton value={lcCode ?? ''} label="ui.profileDialog.device.copyCode" variant="outline" size="md" bind:copied={lcCopied} />
              </div>
              <div class="code-track"><div class="code-fill" class:warn style:width="{Math.max(0, Math.min(100, (lcLeft / lcSpan) * 100)).toFixed(1)}%"></div></div>
              <div class="code-foot">
                <span class="code-status" class:warn
                  >{t('ui.profileDialog.device.expires', { time: `${String(Math.floor(lcLeft / 60)).padStart(2, '0')}:${String(lcLeft % 60).padStart(2, '0')}` })}</span
                >
                <span class="code-toggle" onclick={() => (lcHidden = !lcHidden)} role="button" tabindex="0">{t(lcHidden ? 'ui.profileDialog.device.showCode' : 'ui.profileDialog.device.hideCode')}</span>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if section === 'delete'}
        <div class="scroll gap-18">
          <div class="block wide-gap">
            <span class="caps">{t('ui.profileDialog.delete.lossCaps')}</span>
            <div class="list">
              {#each [{ icon: 'chat', title: t('ui.profileDialog.delete.lossChats'), sub: t('ui.profileDialog.delete.lossChatsSub') }, { icon: 'wallet', title: t('ui.profileDialog.delete.lossWallet'), sub: t('ui.profileDialog.delete.lossWalletSub') }, { icon: 'zap', title: t('ui.profileDialog.delete.lossChit', { amount: fmt(balance), count: streak }), sub: t('ui.profileDialog.delete.lossChitSub') }] as l, i}
                <div class="loss" class:ruled={i > 0}>
                  <span class="loss-tile">{@render glyph(l.icon, 'loss-glyph')}</span>
                  <div class="loss-text">
                    <span class="setting-title">{l.title}</span>
                    <span class="loss-sub">{l.sub}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
          <div class="danger-zone">
            <span class="danger-text">{t('ui.profileDialog.delete.permanent')}</span>
            {#if onDeleteAccount}<span class="danger-button" onclick={openDelete} role="button" tabindex="0">{@render glyph('trash', 'danger-glyph')}{t('ui.profileDialog.delete.open')}</span>{/if}
          </div>
        </div>
      {/if}

      {#if section === 'about'}
        <div class="scroll gap-22">
          <div class="about-head">
            <span class="logo"><span class="logo-hole"></span></span>
            <div class="about-text">
              <span class="about-title">OpenChat</span>
              <span class="about-sub">{t('ui.profileDialog.about.tagline')}</span>
            </div>
            <span class="version">{platform}{version ? ` · v${version}` : ''}</span>
          </div>
          {#each aboutGroups as group}
            <div class="block wide-gap">
              <span class="caps">{t(group.label)}</span>
              <div class="list">
                {#each group.keys as k, i}
                  <a class="about-link" class:ruled={i > 0} href="{aboutBaseUrl}/{k}" target="_blank" rel="noopener">
                    {@render glyph(ABOUT_LINKS[k][1], 'about-glyph')}
                    <span class="about-label">{t(ABOUT_LINKS[k][0])}</span>
                    {@render glyph('external', 'external-glyph')}
                  </a>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if section === 'invite'}
        <div class="scroll gap-22">
          <span class="lead-text">{t('ui.profileDialog.invite.lead')}</span>
          <div class="invite">
            <div class="qr">{#if qrCode}{@render qrCode(link)}{:else}<img src={qr?.link === link ? qr.src : BLANK_GIF} alt={t('ui.profileDialog.invite.qrAlt')} />{/if}</div>
            <div class="invite-side">
              <span class="invite-caps">{t('ui.profileDialog.invite.caps')}</span>
              <span class="invite-link">{link}</span>
              <div class="invite-actions">
                <span class="invite-copy"><CopyButton value={link} variant="text" /></span>
                <span class="invite-share" onclick={shareInvite} role="button" tabindex="0">{@render glyph('share', 'invite-share-glyph')}{t('ui.common.share')}</span>
              </div>
            </div>
          </div>
          {#if inviteRewards.length}
            <div class="block wide-gap">
              <span class="caps">{t('ui.profileDialog.invite.earnCaps')}</span>
              <div class="list">
                {#each inviteRewards as r, i}
                  <div class="reward" class:ruled={i > 0}>
                    {@render glyph('gem', 'about-glyph')}
                    <span class="reward-label">{t(r.label)}</span>
                    <span class="reward-amount">{@render glyph('zap', 'reward-glyph')}{fmt(r.amount)}</span>
                  </div>
                {/each}
              </div>
              <span class="invite-note">{t('ui.profileDialog.invite.note')}</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if section === 'diamond'}
        <div class="placeholder"><span class="placeholder-text">{t('ui.profileDialog.diamondPlaceholder', { section: t(TITLES[section]) })}</span></div>
      {/if}
    </div>
  </div>

  {#if delOpen}
    {@const step = delSteps[delStep]}
    <div class="sub-layer" role="dialog" aria-modal="true">
      <div class="sub-veil" onclick={() => !delBusy && stayNow()} aria-hidden="true"></div>
      <div class="sub-card delete">
        <div class="sub-head">
          {#if delStep > 0 && !delBusy}
            <span class="sub-back" onclick={() => (delStep = Math.max(0, delStep - 1))} aria-label={t('ui.common.back')} role="button" tabindex="0" title={t('ui.common.back')}>{@render glyph('back', 'sub-back-glyph')}</span>
          {/if}
          <div class="sub-heading">
            <span class="sub-title">{t('ui.profileDialog.nav.delete')}</span>
            <span class="sub-step">{t('ui.profileDialog.delete.stepOf', { step: delStep + 1, total: 4 })}</span>
          </div>
          <span class="sub-close" onclick={() => !delBusy && stayNow()} role="button" tabindex="0" aria-label={t('ui.common.close')}>{@render glyph('close', 'sub-close-glyph')}</span>
        </div>
        <div class="steps">
          {#each delSteps as _, k}<span class="step-dot" class:passed={k <= delStep} class:final={k === 3}></span>{/each}
        </div>
        <div class="sub-body">
          {#if step.icon}
            <span class="step-tile">{@render glyph(step.icon, delStep === 3 ? 'step-glyph final' : 'step-glyph')}</span>
          {/if}
          <div class="step-copy">
            <span class="step-title">{step.title}</span>
            <span class="step-body">{#each step.body as [text, strong]}<span class:strong>{text}</span>{/each}</span>
          </div>
          {#if delStep === 2 && !noChit}
            <div class="list">
              <div class="chit-pair">
                <div class="chit-cell">
                  <span class="small-label icon-label">{@render glyph('zap', 'streak-glyph')}{t('ui.profileDialog.delete.dayStreak')}</span>
                  <span class="chit-figure">{streak}</span>
                </div>
                <div class="chit-cell ruled-start">
                  <span class="small-label">{t('ui.profileDialog.delete.chitBalance')}</span>
                  <span class="chit-figure">{fmt(balance)}</span>
                </div>
              </div>
              <div class="chit-foot">
                <span class="chit-next">{delNextMile}</span>
                <span class="chit-earned">{t('ui.profileDialog.delete.earnedTotal', { amount: fmt(chitEarned) })}</span>
              </div>
            </div>
          {/if}
          {#if delStep === 3}
            <div class="confirm-type">
              <span class="confirm-label"
                ><Translate key="ui.profileDialog.delete.typeToConfirm">{#snippet handle()}<span class="confirm-handle">@{values.handle}</span>{/snippet}</Translate></span
              >
              <input class="confirm-input" class:match={delMatch} bind:value={delTyped} placeholder="@{values.handle}" spellcheck="false" autocomplete="off" disabled={delBusy} />
            </div>
            {#if delError}<span class="inline-error" role="alert">{t('ui.profileDialog.delete.failed')}</span>{/if}
          {/if}
        </div>
        <div class="sub-actions">
          <span class="step-primary" class:final={delStep === 3} class:locked={delLocked} class:faded={delStep === 3 && !delMatch} onclick={deletePrimary} role="button" tabindex="0"
            ><span class="step-primary-glyph" style:mask={icon(step.primaryIcon)}></span>{step.primary}</span
          >
          <span class="step-secondary" class:busy={delBusy} onclick={deleteSecondary} role="button" tabindex="0"
            >{step.secondary}<span class="step-secondary-glyph" style:mask={icon(delStep === 3 ? 'heart' : 'chevron-right')}></span></span
          >
        </div>
      </div>
    </div>
  {/if}

  {#if loOpen}
    <div class="sub-layer" role="dialog" aria-modal="true">
      <div class="sub-veil" onclick={() => !loBusy && (loOpen = false)} aria-hidden="true"></div>
      <div class="sub-card logout">
        <div class="lo-who">
          <span class="lo-avatar" style:background={avatar}></span>
          <div class="lo-names">
            <span class="lo-name">{shownName}</span>
            <span class="lo-handle">@{values.handle}</span>
          </div>
        </div>
        <div class="lo-copy">
          <span class="lo-title">{t('ui.profileDialog.logout.title')}</span>
          <span class="lo-body">{t('ui.profileDialog.logout.body', { provider: t(signInProvider) })}</span>
          {#if loError}<span class="inline-error" role="alert">{t('ui.profileDialog.logout.failed')}</span>{/if}
        </div>
        <div class="lo-actions">
          <span class="lo-cancel" class:busy={loBusy} onclick={() => !loBusy && (loOpen = false)} role="button" tabindex="0">{t('ui.common.cancel')}</span>
          <span class="lo-confirm" class:busy={loBusy} onclick={confirmLogout} role="button" tabindex="0"
            ><span class="lo-glyph" class:spin={loBusy} style:mask={icon(loBusy ? 'refresh' : 'leave')}></span>{t(loBusy ? 'ui.profileDialog.logout.busy' : 'ui.profileDialog.logout.action')}</span
          >
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .inline-error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .inline-error.padded {
    padding: 0 var(--space-16) var(--space-12);
  }

  /* ---- shell ---- */
  .layer {
    z-index: 70;
  }

  .card {
    position: relative;
    display: flex;
    width: 100%;
    max-width: 860px;
    height: 770px;
    max-height: 100%;
    box-sizing: border-box;
    border: 1px solid var(--line-2);
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow: var(--shadow-modal);
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .rail {
    flex: none;
    width: 250px;
    display: flex;
    flex-direction: column;
    background: var(--surface-0);
    border-inline-end: 1px solid var(--line-1);
  }

  .rail-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 10px 12px;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-label {
    padding: 6px 10px;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    letter-spacing: 0.06em;
    color: var(--ink-4);
  }

  .nav-item {
    --nav-ink: var(--ink-3);
    --nav-label: var(--ink-2);
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    user-select: none;
  }

  .nav-item.on {
    --nav-ink: var(--ink);
    --nav-label: var(--ink);
    background: var(--overlay-2);
  }

  .nav-item.chit {
    --nav-ink: var(--status-chit);
  }

  .nav-item.diamond {
    --nav-ink: var(--accent);
  }

  .nav-item.danger {
    --nav-ink: var(--status-danger);
    --nav-label: var(--status-danger);
  }

  .nav-item:hover {
    background: var(--overlay-1);
  }

  .nav-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--nav-ink);
  }

  .nav-icon.logout {
    background: var(--ink-3);
  }

  .nav-title {
    flex: 1;
    font: 500 var(--text-md) / 1 var(--font-sans);
    color: var(--nav-label);
  }

  .on .nav-title {
    font-weight: 600;
  }

  .nav-meta {
    font: var(--weight-semibold) 10.5px/1 var(--font-mono);
    color: var(--status-chit);
  }

  .diamond .nav-meta {
    color: var(--ink-4);
  }

  .diamond .nav-meta.upgrade {
    color: var(--accent);
  }

  .rail-foot {
    flex: none;
    padding: 8px 10px;
    border-block-start: 1px solid var(--line-1);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .main-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 69px;
    box-sizing: border-box;
    padding: 0 26px;
    border-block-end: 1px solid var(--line-1);
  }

  .section-title {
    flex: 1;
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--ink);
  }

  .head-close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-inline-end: -8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .head-close:hover {
    background: var(--btn-hover);
  }

  .head-close-glyph {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 22px 26px;
    display: flex;
    flex-direction: column;
  }

  .gap-8 {
    gap: 8px;
  }

  .gap-16 {
    gap: 16px;
  }

  .gap-18 {
    gap: 18px;
  }

  .gap-22 {
    gap: 22px;
  }

  /* ---- shared blocks ---- */
  .caps {
    padding-inline: 4px;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    letter-spacing: 0.06em;
    color: var(--ink-4);
  }

  .lead-caps {
    flex: none;
    margin-top: 4px;
    padding-inline: 0;
  }

  .caps.flat {
    flex: none;
  }

  .caps.spaced {
    margin-top: 10px;
  }

  .block {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .block.wide-gap {
    gap: 10px;
  }

  .list {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    overflow: hidden;
  }

  .list.flat {
    flex: none;
  }

  .list.pull-up {
    flex: none;
    margin-top: -10px;
  }

  .rule {
    height: 1px;
    background: var(--line-1);
  }

  .ruled {
    border-block-start: 1px solid var(--line-1);
  }

  .lead-text {
    flex: none;
    padding-inline: 4px;
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .lead-text.tight {
    line-height: 1.5;
  }

  .note {
    padding-inline: 4px;
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }

  .small-label {
    font: var(--weight-medium) 11px/1 var(--font-sans);
    color: var(--ink-3);
  }

  .grow {
    flex: 1;
  }

  .setting {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    padding: var(--space-16);
  }

  .setting-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .setting-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .setting-hint {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .setting-hint.muted3 {
    color: var(--ink-3);
  }

  .setting-control {
    flex: none;
    display: flex;
  }

  .segments {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .kv-edit {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-3);
  }

  /* ---- profile ---- */
  .cover {
    flex: none;
    position: relative;
    height: 118px;
    border-radius: var(--radius-lg);
  }

  .cover-edit,
  .photo-edit {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: var(--card-2);
    box-shadow: inset 0 0 0 1px var(--line-2);
    cursor: pointer;
  }

  .cover-edit {
    top: var(--space-8);
    inset-inline-end: var(--space-8);
  }

  .photo-edit {
    bottom: -2px;
    inset-inline-end: -2px;
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 0 0 3px var(--surface-1);
  }

  /* the hover tint over the button's own surface: on its own it's see-through, and these sit on
     an image */
  .cover-edit:hover,
  .photo-edit:hover {
    background: linear-gradient(var(--btn-hover), var(--btn-hover)), var(--card-2);
  }

  .cover-edit-glyph {
    width: 16px;
    height: 16px;
    background: var(--ink-3);
  }

  .photo-edit-glyph {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .identity {
    flex: none;
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-top: -44px;
    padding-inline: 16px;
  }

  .avatar {
    position: relative;
    flex: none;
    width: 88px;
    height: 88px;
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 4px var(--surface-1);
  }

  .identity-text {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding-bottom: 4px;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .display-name {
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge-slot {
    flex: none;
    display: grid;
    grid-template-columns: max-content;
  }

  .chit-tag {
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .chit-tag:hover {
    filter: brightness(1.15);
  }

  .handle-line {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .handle {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-3);
  }

  .field {
    display: flex;
    flex-direction: column;
  }

  .kv-row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 0 16px;
  }

  .kv-row.editable {
    cursor: pointer;
  }

  .kv-row.editable:hover {
    background: var(--overlay-1);
  }

  .kv-label {
    flex: none;
    width: 110px;
    font: var(--weight-medium) 11px/1 var(--font-sans);
    color: var(--ink-3);
  }

  .kv-value {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) 13px/1.35 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kv-value.mono {
    font: var(--weight-medium) 12.5px/1 var(--font-mono);
  }

  .kv-value.area {
    color: var(--ink-2);
  }

  .kv-value.empty {
    color: var(--ink-4);
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: var(--overlay-1);
  }

  .editor-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .editor-label {
    flex: 1;
    font: var(--weight-medium) 11px/1 var(--font-sans);
    color: var(--ink-3);
  }

  .community-edit-head .editor-label {
    flex: initial;
  }

  .editor-count {
    font: var(--weight-medium) 10.5px/1 var(--font-mono);
    color: var(--ink-4);
  }

  .area-input {
    box-sizing: border-box;
    width: 100%;
    resize: none;
    padding: 11px 12px;
    border: none;
    outline: none;
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1.5px var(--accent);
    font: var(--weight-regular) 13px/1.5 var(--font-sans);
    color: var(--ink);
  }

  .line-input {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 12px;
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .line-input.grow {
    flex: 1;
    min-width: 0;
  }

  .area-input.invalid,
  .line-input.invalid {
    box-shadow: inset 0 0 0 1.5px var(--status-danger);
  }

  .line-input input,
  .filter input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    font: var(--weight-medium) 13px/1 var(--font-sans);
    color: var(--ink);
  }

  .line-input input.roomy {
    line-height: 1.35;
  }

  .line-input input.mono {
    font: var(--weight-medium) 12.5px/1 var(--font-mono);
  }

  .at {
    font: var(--weight-medium) 13px/1 var(--font-mono);
    color: var(--ink-4);
  }

  .editor-foot {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .editor-hint {
    flex: 1;
    font: var(--weight-regular) 10.5px/1.3 var(--font-sans);
    color: var(--ink-4);
  }

  .editor-hint.invalid {
    color: var(--status-danger);
  }

  .cancel {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) 12px/1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .cancel:hover {
    background: var(--btn-hover);
  }

  .save {
    display: flex;
    align-items: center;
    height: 30px;
    padding: 0 14px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    font: var(--weight-semibold) 12px/1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;
  }

  .save:hover {
    background: var(--accent-hover);
  }

  .save.blocked {
    opacity: 0.4;
    pointer-events: none;
  }

  .status {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font: var(--weight-medium) 13px/1 var(--font-sans);
    color: var(--ink);
  }

  .online-dot {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--status-online);
  }

  .kv-plain {
    flex: 1;
    font: var(--weight-medium) 13px/1 var(--font-sans);
    color: var(--ink);
  }

  .kv-id {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) 12px/1 var(--font-mono);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .copy {
    flex: none;
    display: flex;
    margin-inline-end: -8px;
  }

  /* ---- stats ---- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-content: start;
    gap: 8px;
  }

  .stat-online,
  .stat-mix,
  .stat-report {
    grid-column: 1/-1;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
  }

  .stat-online {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    padding: 18px;
  }

  .online-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .online-figure {
    font: var(--weight-bold) var(--text-3xl) / 1 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--ink);
  }

  .online-unit {
    margin-inline-start: 6px;
    font: var(--weight-medium) 13px/1 var(--font-sans);
    color: var(--ink-3);
  }

  .online-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 7px;
  }

  .delta {
    --delta: var(--status-online);
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--delta) 14%, transparent);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--delta);
  }

  .delta.down {
    --delta: var(--status-danger);
  }

  .delta-glyph {
    width: 11px;
    height: 11px;
    background: var(--delta);
  }

  .prev {
    font: var(--weight-regular) 11px/1 var(--font-sans);
    color: var(--ink-4);
  }

  .stat-tile {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 16px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
  }

  .tile-figure,
  .report-count {
    font: var(--weight-bold) 24px/1 var(--font-sans);
    color: var(--ink);
  }

  .stat-mix {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }

  .mix-head {
    display: flex;
    align-items: baseline;
  }

  .mix-total {
    font: var(--weight-bold) 15px/1 var(--font-sans);
    color: var(--ink);
  }

  .mix-row {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 12px;
  }

  .mix-label {
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mix-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--overlay-1);
  }

  .mix-fill {
    min-width: 4px;
    height: 100%;
    border-radius: var(--radius-pill);
  }

  .mix-count {
    text-align: end;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .stat-report {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px 18px;
  }

  .report-glyph {
    flex: none;
    width: 17px;
    height: 17px;
  }

  .report-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .report-title {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .report-note {
    font: var(--weight-regular) 11px/1.35 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .report-count {
    flex: none;
  }

  /* ---- CHIT ---- */
  .chit-master {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-14);
    padding: var(--space-16);
    border-radius: var(--radius-md);
    background: var(--overlay-1);
  }

  .chit-badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--status-chit-soft);
  }

  .chit-badge-glyph {
    width: 18px;
    height: 18px;
    background: var(--status-chit);
  }

  .list.puzzle {
    gap: var(--space-12);
    padding: var(--space-16);
  }

  .list.puzzle .setting-text {
    flex: 1;
  }

  .segments.three {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3px;
    border-radius: var(--radius-md);
  }

  .segment {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    border-radius: calc(var(--radius-md) - 3px);
    background: transparent;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
  }

  .segment.on {
    background: var(--overlay-3, rgba(255, 255, 255, 0.12));
  }

  .segment.on,
  .segment:hover {
    color: var(--ink);
  }

  .segment-glyph {
    width: 13px;
    height: 13px;
    background: currentColor;
  }

  .chit-off {
    flex: none;
    margin: -4px 0 0;
    padding-inline: 4px;
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .earn {
    flex: none;
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: var(--status-chit-soft);
    cursor: pointer;
    user-select: none;
  }

  .earn:hover {
    filter: brightness(1.12);
  }

  .earn-glyph {
    flex: none;
    width: 18px;
    height: 18px;
    background: var(--status-chit);
  }

  .earn-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .earn-title {
    font: var(--weight-semibold) 13px/1 var(--font-sans);
    color: var(--ink);
  }

  .earn-left {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--status-chit);
  }

  .earn-chevron {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--status-chit);
  }

  .month-bar {
    flex: none;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .month-step {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
    cursor: pointer;
  }

  .month-step:hover {
    background: var(--overlay-2);
  }

  .month-step.disabled {
    opacity: 0.35;
    pointer-events: none;
  }

  .month-glyph {
    width: 14px;
    height: 14px;
    background: var(--ink-2);
  }

  .month-text {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    padding-inline: 4px;
  }

  .month-label {
    font: var(--weight-bold) 15px/1 var(--font-sans);
    color: var(--ink);
  }

  .month-sum {
    font: var(--weight-medium) 11px/1 var(--font-mono);
    color: var(--ink-3);
    white-space: nowrap;
  }

  .chit-ink {
    color: var(--status-chit);
  }

  .online-ink {
    color: var(--status-online);
  }

  .tz-option {
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 6px;
    background: transparent;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
  }

  .tz-option.on {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .calendar {
    flex: none;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }

  .weekday {
    padding: 4px 0;
    text-align: center;
    font: var(--weight-medium) 10.5px/1 var(--font-sans);
    color: var(--ink-4);
  }

  .day {
    --day-ink: var(--ink-4);
    --day-amount: var(--status-chit);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 48px;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: default;
    user-select: none;
  }

  .day.claim {
    --day-ink: var(--ink);
    box-shadow: inset 0 0 0 1.5px var(--status-chit);
    cursor: pointer;
  }

  /* nothing to open without onChit */
  .day.claim.inert {
    cursor: default;
  }

  .day.future {
    --day-ink: var(--ink-3);
    opacity: 0.5;
  }

  .day.missed {
    --day-ink: var(--ink-3);
  }

  .day.insured {
    --day-ink: var(--ink);
    --day-amount: var(--status-online);
    background: color-mix(in srgb, var(--status-online) 12%, transparent);
  }

  .day.claimed {
    --day-ink: var(--ink);
    background: var(--status-chit-soft);
  }

  .day-num {
    font: var(--weight-semibold) 12px/1 var(--font-sans);
    color: var(--day-ink);
  }

  .day-amount {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 10px;
    font: var(--weight-semibold) 10px/1 var(--font-mono);
    color: var(--day-amount);
  }

  .day-shield {
    width: 10px;
    height: 10px;
    background: var(--day-amount);
    mask: var(--icon-shield) center/contain no-repeat;
  }

  .pop {
    position: absolute;
    z-index: 5;
    bottom: calc(100% + 6px);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 240px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 12px 32px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    text-align: start;
  }

  .pop.start {
    inset-inline-start: 0;
    transform: none;
  }

  .pop.end {
    inset-inline-start: auto;
    inset-inline-end: 0;
    transform: none;
  }

  .pop-head {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .pop-line {
    font: var(--weight-medium) 11.5px/1.2 var(--font-sans);
    white-space: nowrap;
  }

  .pop-line.ink {
    color: var(--ink);
  }

  .pop-line.chit {
    color: var(--status-chit);
  }

  .pop-line.online {
    color: var(--status-online);
  }

  .pop-line.muted {
    color: var(--ink-3);
  }

  /* ---- chats & calls ---- */
  .ringtone {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 52px;
    padding: 0 16px;
    cursor: pointer;
    user-select: none;
  }

  .ringtone:hover {
    background: var(--overlay-1);
  }

  .ringtone-label {
    flex: 1;
    min-width: 0;
    font: 500 var(--text-base) / 1 var(--font-sans);
    color: var(--ink);
  }

  .ringtone-label.on {
    font-weight: 600;
  }

  .wave {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 20px;
  }

  .wave-bar {
    width: 2px;
    border-radius: 1px;
    background: var(--line-3);
  }

  .wave-bar.selected {
    background: var(--ink-3);
  }

  .wave-bar.playing {
    background: var(--accent);
  }

  .play {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .play:hover {
    background: var(--btn-hover);
  }

  .play-glyph {
    width: 12px;
    height: 12px;
    background: var(--ink-3);
  }

  .play-glyph.playing {
    background: var(--accent);
  }

  .tick-slot {
    flex: none;
    display: flex;
    justify-content: flex-end;
    width: 42px;
  }

  .tick {
    width: 16px;
    height: 16px;
    background: var(--accent);
    mask: var(--icon-check) center/contain no-repeat;
    opacity: 0;
  }

  .tick.on {
    opacity: 1;
  }

  /* ---- communities ---- */
  .filter {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 12px;
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .filter-glyph {
    width: 13px;
    height: 13px;
    background: var(--ink-3);
  }

  .community {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    cursor: pointer;
  }

  .community:hover {
    background: var(--overlay-1);
  }

  .community-face {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }

  .community-name {
    flex: none;
    width: 150px;
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .community-shown {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) 13px/1.2 var(--font-sans);
    color: var(--ink-4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .community-shown.custom {
    font: var(--weight-semibold) 13.5px/1.2 var(--font-sans);
    color: var(--ink);
  }

  .community-tag {
    font: var(--weight-medium) 10.5px/1 var(--font-mono);
    color: var(--ink-4);
  }

  .community-edit-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .community-chip {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 8px;
  }

  .reset {
    padding: 8px 0;
    font: var(--weight-semibold) 11.5px/1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
  }

  .reset:hover {
    color: var(--ink);
  }

  .no-match {
    flex: none;
    padding: 12px 4px;
    font: var(--weight-regular) var(--text-md) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }

  /* ---- sign-in providers ---- */
  .signin {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .scroll.toast-room {
    padding-bottom: 84px;
  }

  .current {
    flex: none;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-online) 35%, transparent);
  }

  .current-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: color-mix(in srgb, var(--status-online) 14%, transparent);
  }

  .current-glyph {
    width: 20px;
    height: 20px;
    background: var(--status-online);
  }

  .current-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .current-kicker {
    font: var(--weight-medium) 11px/1 var(--font-sans);
    color: var(--status-online);
  }

  .current-title {
    font: var(--weight-semibold) 14px/1.2 var(--font-sans);
    color: var(--ink);
  }

  .current-id {
    overflow: hidden;
    font: var(--weight-regular) 11.5px/1 var(--font-mono);
    color: var(--ink-4);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .locked {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    font: var(--weight-medium) 11px/1 var(--font-sans);
    color: var(--ink-4);
  }

  .locked-glyph {
    width: 13px;
    height: 13px;
    background: var(--ink-4);
  }

  .method {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-block-end: 1px solid var(--line-1);
  }

  /* the rule only separates rows: none under the last (no "add" row after it) */
  .method:last-child,
  .method-empty:last-child {
    border-block-end: none;
  }

  .method-glyph {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-3);
  }

  .method-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .method-title {
    font: var(--weight-semibold) 13px/1.2 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .method-sub {
    font: var(--weight-regular) 11px/1 var(--font-sans);
    color: var(--ink-4);
  }

  .unlink {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    margin-inline-end: -6px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) 11.5px/1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
  }

  .unlink:hover {
    background: var(--btn-danger-bg);
    color: var(--status-danger);
  }

  .unlink-glyph {
    width: 13px;
    height: 13px;
    background: currentColor;
  }

  /* as tall as a method's row (14px padding round its 28px unlink button), the note centred */
  .method-empty {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 56px;
    padding: 0 16px;
    border-block-end: 1px solid var(--line-1);
    font: var(--weight-regular) 11.5px/1.4 var(--font-sans);
    color: var(--ink-4);
  }

  .add {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 46px;
    padding: 0 16px;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .add:hover {
    background: var(--overlay-1);
  }

  .add-glyph {
    width: 13px;
    height: 13px;
    background: var(--accent);
  }

  .adding {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--overlay-1);
  }

  .adding-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .adding-title {
    flex: 1;
    font: var(--weight-semibold) 13px/1 var(--font-sans);
    color: var(--ink);
  }

  .adding-cancel {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) 12px/1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .adding-cancel:hover,
  .toast-undo:hover {
    background: var(--btn-hover);
  }

  .inline-form {
    display: flex;
    gap: 8px;
  }

  .primary,
  .check-action {
    flex: none;
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    background: var(--accent);
    font: var(--weight-semibold) 12px/1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;
  }

  .primary {
    height: 40px;
    padding: 0 16px;
    border-radius: var(--radius-md);
    font-size: 12.5px;
  }

  .check-action {
    height: 30px;
    padding: 0 12px;
  }

  .primary:hover,
  .check-action:hover {
    background: var(--accent-hover);
  }

  .primary.blocked {
    opacity: 0.4;
    pointer-events: none;
  }

  .adding-hint {
    font: var(--weight-regular) 11px/1.4 var(--font-sans);
    color: var(--ink-4);
  }

  .adding-hint.invalid {
    color: var(--status-danger);
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
  }

  .check-mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-pill);
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .check-mark.todo {
    box-shadow: inset 0 0 0 1.5px var(--line-3);
  }

  .check-mark.done {
    background: var(--status-online);
    box-shadow: none;
  }

  .check-glyph {
    display: none;
    width: 11px;
    height: 11px;
    background: var(--surface-1);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .done .check-glyph {
    display: block;
  }

  .check-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) 12.5px/1.3 var(--font-sans);
    color: var(--ink);
  }

  .check-label.done,
  .check-label.todo {
    font-weight: var(--weight-medium);
    color: var(--ink-3);
  }

  .waiting {
    flex: none;
    font: var(--weight-medium) 11px/1 var(--font-sans);
    color: var(--ink-3);
  }

  .toast {
    position: absolute;
    inset-inline: 26px;
    bottom: 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 46px;
    padding: 0 8px 0 16px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 14px 36px rgba(0, 0, 0, 0.5);
  }

  .toast-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toast-undo {
    flex: none;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    font: var(--weight-bold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  /* ---- appearance ---- */
  .themes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .theme {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 8px 12px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    cursor: pointer;
    user-select: none;
  }

  .theme.on,
  .accent.on {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .theme:hover,
  .accent:hover {
    background: var(--overlay-2);
  }

  .preview {
    position: relative;
    height: 84px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .bubble {
    position: absolute;
    height: 14px;
    border-radius: 7px;
  }

  .bubble.one {
    top: 10px;
    inset-inline-start: 10px;
    width: 52%;
  }

  .bubble.sent {
    top: 30px;
    inset-inline-end: 10px;
    width: 44%;
    background: var(--accent);
  }

  .bubble.two {
    top: 50px;
    inset-inline-start: 10px;
    width: 36%;
  }

  .preview-bar {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 12px;
  }

  .theme-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-inline: 4px;
  }

  .radio {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-pill);
    box-shadow: inset 0 0 0 1.5px var(--line-3);
  }

  .on .radio {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .radio-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    opacity: 0;
  }

  .on .radio-dot,
  .on .swatch-check {
    opacity: 1;
  }

  .theme-name {
    flex: 1;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .accents {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .accent {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 12px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    cursor: pointer;
    user-select: none;
  }

  .swatch {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-pill);
  }

  .swatch-check {
    width: 12px;
    height: 12px;
    background: rgba(0, 0, 0, 0.7);
    mask: var(--icon-check) center/contain no-repeat;
    opacity: 0;
  }

  .list.sizes-panel {
    gap: 14px;
    padding: 16px;
    overflow: visible;
  }

  .size {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 36px;
    border-radius: 6px;
    background: transparent;
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
  }

  .size.on {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .size-glyph {
    font-family: var(--font-sans);
    font-weight: var(--weight-bold);
    line-height: 1;
  }

  .size-label {
    font: var(--weight-semibold) 12px/1 var(--font-sans);
  }

  .sample {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--surface-1);
  }

  .sample-bubble {
    max-width: 78%;
    padding: var(--space-12) var(--space-14);
    font-family: var(--font-sans);
    font-weight: var(--weight-regular);
    line-height: 1.45;
  }

  .sample-bubble.recv {
    align-self: flex-start;
    border-radius: var(--radius-xs) var(--radius-xl) var(--radius-xl) var(--radius-xl);
    background: var(--bubble-recv-bg);
    box-shadow: inset 0 0 0 1px var(--line-1);
    color: var(--bubble-recv-text);
  }

  .sample-bubble.sent {
    align-self: flex-end;
    border-radius: var(--radius-xl) var(--radius-xs) var(--radius-xl) var(--radius-xl);
    background: var(--bubble-send-bg);
    color: var(--bubble-text);
  }

  /* ---- storage ---- */
  .usage {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 16px;
  }

  .usage-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .usage-figure {
    font: var(--weight-bold) 26px/1 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .usage-of {
    flex: 1;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .usage-pct {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
  }

  .usage-track {
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--overlay-1);
    overflow: hidden;
  }

  .usage-fill {
    min-width: 4px;
    height: 100%;
    border-radius: var(--radius-pill);
  }

  .upsell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 16px;
    border-block-start: 1px solid var(--line-1);
    cursor: pointer;
  }

  .upsell:hover {
    background: var(--overlay-1);
  }

  .upsell-text {
    flex: 1;
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-2);
  }

  .upsell-cta {
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--accent);
  }

  .cache-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
  }

  .cache-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .outline-button {
    --button-ink: var(--ink);
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 16px;
    border-radius: var(--radius-sm);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--button-ink);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }

  .outline-button:hover {
    background: var(--overlay-2);
  }

  .outline-button.busy,
  .outline-button.done {
    cursor: default;
  }

  .outline-button.done {
    --button-ink: var(--status-online);
  }

  .outline-glyph {
    width: 14px;
    height: 14px;
    background: var(--button-ink);
  }

  .outline-glyph.flag {
    background: var(--ink-2);
  }

  .spin {
    animation: oc-spin 0.8s linear infinite;
  }

  /* ---- bots ---- */
  .bot-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
  }

  .bot-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .bot-value {
    font: var(--weight-medium) 12.5px/1.55 var(--font-mono);
    color: var(--ink);
    white-space: normal;
    overflow-wrap: anywhere;
    user-select: all;
  }

  .bot-value.pre {
    white-space: pre-wrap;
  }

  .bot-copy {
    flex: none;
    display: flex;
    margin: -6px -8px 0 0;
  }

  /* ---- link device ---- */
  .link-step {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 0 16px;
  }

  .step-n {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) 12px/1 var(--font-mono);
    color: var(--ink-2);
  }

  .step-text {
    font: var(--weight-medium) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink);
  }

  .code-intro,
  .danger-zone {
    flex: none;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border-radius: var(--radius-md);
  }

  .code-intro {
    background: var(--overlay-1);
  }

  .shield-glyph {
    flex: none;
    width: 18px;
    height: 18px;
    background: var(--status-chit);
  }

  .code-warning,
  .danger-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .code-error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .show-code {
    flex: none;
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 18px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }

  .show-code:hover,
  .danger-button:hover,
  .invite-share:hover,
  .step-primary:hover,
  .lo-confirm:hover {
    filter: brightness(1.08);
  }

  .code-live {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 45%, transparent);
  }

  .code-line {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .code {
    flex: 1;
    min-width: 0;
    font: var(--weight-semibold) 34px/1 var(--font-mono);
    letter-spacing: 0.32em;
    color: var(--ink);
    user-select: all;
    filter: none;
    transition: filter 0.2s ease;
  }

  .code.hidden {
    user-select: none;
    filter: blur(9px);
  }

  .code-track {
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    overflow: hidden;
  }

  .code-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
    transition: width 0.25s linear;
  }

  .code-fill.warn {
    background: var(--status-chit);
  }

  .code-foot {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .code-status {
    flex: 1;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }

  .code-status.warn {
    color: var(--status-chit);
  }

  .code-toggle {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  /* ---- delete ---- */
  .loss {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 68px;
    padding: 12px 16px;
    box-sizing: border-box;
  }

  .loss-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-sm);
    background: var(--overlay-2);
  }

  .loss-glyph {
    width: 18px;
    height: 18px;
    background: var(--ink-2);
  }

  .loss-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .loss-sub {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3);
  }

  .danger-zone {
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-danger) 40%, transparent);
  }

  .danger-button {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 18px;
    border-radius: var(--radius-sm);
    background: var(--status-danger);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }

  .danger-glyph {
    width: 14px;
    height: 14px;
    background: #fff;
  }

  /* ---- about ---- */
  .about-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 14px;
    padding-inline: 4px;
  }

  .logo {
    flex: none;
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-pill);
    background: conic-gradient(from 200deg, #ffb23f, #f7641e 45%, #e0237a 70%, #8a2bb5 90%, #ffb23f);
  }

  .logo-hole {
    position: absolute;
    inset: 10px;
    border-radius: var(--radius-pill);
    background: var(--surface-1);
  }

  .about-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .about-title {
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--ink);
  }

  .about-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .version {
    flex: none;
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-medium) 11px/1 var(--font-mono);
    color: var(--ink-3);
    white-space: nowrap;
  }

  .about-link,
  .reward {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 0 16px;
  }

  .about-link {
    text-decoration: none;
    color: inherit;
  }

  .about-link:hover {
    background: var(--overlay-1);
  }

  .about-glyph {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--ink-3);
  }

  .about-label,
  .reward-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .reward-label {
    line-height: 1.3;
  }

  .external-glyph {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--ink-4);
  }

  /* ---- invite ---- */
  .invite {
    flex: none;
    display: flex;
    align-items: stretch;
    gap: var(--space-22);
    padding: 18px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
  }

  .qr {
    flex: none;
    width: 156px;
    height: 156px;
    box-sizing: border-box;
    padding: 10px;
    border-radius: var(--radius-md);
    background: #fff;
  }

  /* the dialog's own image, or the host's (qrCode) */
  .qr :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .invite-side {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-12);
  }

  .invite-caps {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.06em;
    color: var(--ink-4);
  }

  .invite-link {
    font: var(--weight-medium) 12.5px/1.5 var(--font-mono);
    color: var(--ink);
    overflow-wrap: anywhere;
    user-select: all;
  }

  .invite-actions {
    display: flex;
    gap: var(--space-10);
  }

  .invite-share {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 38px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .invite-copy {
    flex: 1;
    display: flex;
  }

  /* CopyButton's text pill stretched to sit level with Share */
  .invite-copy > :global(.copy) {
    flex: 1;
    height: 38px;
    font-size: var(--text-md);
  }

  .invite-share {
    background: var(--accent);
    color: var(--on-accent);
  }

  .invite-share-glyph {
    width: 14px;
    height: 14px;
    background: var(--on-accent);
  }

  .reward-amount {
    flex: none;
    display: flex;
    align-items: center;
    gap: 5px;
    font: var(--weight-bold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .reward-glyph {
    width: 12px;
    height: 12px;
    background: var(--status-chit);
  }

  .invite-note {
    padding-inline: 4px;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .placeholder {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 26px;
  }

  .placeholder-text {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4);
  }

  /* ---- confirmation layers ---- */
  .sub-layer {
    position: fixed;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .sub-veil {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    animation: oc-veil-in var(--duration-base) var(--ease-out) both;
  }

  .sub-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .sub-card.delete {
    max-width: 480px;
    max-height: 100%;
    overflow: hidden;
  }

  .sub-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-24) var(--space-32) var(--space-22);
  }

  .sub-back,
  .sub-close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .sub-back {
    width: 32px;
    height: 32px;
    margin-inline-start: -10px;
  }

  .sub-back:hover,
  .sub-close:hover,
  .step-secondary:hover,
  .lo-cancel:hover {
    background: var(--overlay-2);
  }

  .sub-back-glyph {
    width: 16px;
    height: 16px;
    background: var(--ink-2);
  }

  .sub-close-glyph {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .sub-heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .sub-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .sub-step {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
  }

  .steps {
    flex: none;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    padding: 0 var(--space-32);
  }

  .step-dot {
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    transition: background 0.2s;
  }

  .step-dot.passed {
    background: var(--ink);
  }

  .step-dot.passed.final {
    background: var(--status-danger);
  }

  .sub-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-22);
    padding: var(--space-32) var(--space-32) 0;
  }

  .step-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
  }

  .step-glyph {
    width: 24px;
    height: 24px;
    background: var(--ink);
  }

  .step-glyph.final {
    background: var(--status-danger);
  }

  .step-copy {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .step-title {
    font: var(--weight-bold) 22px/1.25 var(--font-sans);
    letter-spacing: -0.015em;
    color: var(--ink);
    text-wrap: balance;
  }

  .step-body {
    font: var(--weight-regular) var(--text-md) / 1.6 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .step-body .strong {
    color: var(--ink);
    font-weight: var(--weight-semibold);
  }

  .chit-pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .chit-cell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
  }

  .chit-cell.ruled-start {
    border-inline-start: 1px solid var(--line-1);
  }

  .icon-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .streak-glyph {
    width: 12px;
    height: 12px;
    background: var(--accent);
  }

  .chit-figure {
    font: var(--weight-bold) 30px/1 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .chit-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border-block-start: 1px solid var(--line-1);
  }

  .chit-next {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .chit-earned {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .confirm-type {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .confirm-label {
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .confirm-handle {
    font-family: var(--font-mono);
    color: var(--ink);
  }

  .confirm-input {
    height: 44px;
    box-sizing: border-box;
    padding: 0 14px;
    border: none;
    outline: none;
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink);
  }

  .confirm-input.match {
    box-shadow: inset 0 0 0 1px var(--status-danger);
  }

  .sub-actions {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-32);
  }

  .step-primary,
  .step-secondary {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .step-primary {
    --primary-ink: var(--on-accent);
    gap: 10px;
    background: var(--accent);
    color: var(--primary-ink);
    transition: opacity 0.15s;
  }

  .step-primary.final {
    --primary-ink: #fff;
    background: var(--status-danger);
  }

  .step-primary.locked {
    cursor: default;
  }

  .step-primary.faded {
    opacity: 0.4;
  }

  .step-primary-glyph {
    width: 16px;
    height: 16px;
    background: var(--primary-ink);
  }

  .step-secondary {
    gap: 8px;
    color: var(--ink-2);
  }

  .step-secondary.busy,
  .lo-cancel.busy {
    cursor: default;
    opacity: 0.5;
  }

  .step-secondary-glyph {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
  }

  .sub-card.logout {
    align-items: center;
    gap: var(--space-22);
    max-width: 380px;
    padding: var(--space-32);
  }

  .lo-who {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .lo-avatar {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-pill);
    background-size: cover;
    background-position: center;
    box-shadow:
      0 0 0 4px var(--surface-1),
      0 0 0 5px var(--line-2);
  }

  .lo-names {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }

  .lo-name {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .lo-handle {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .lo-copy {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .lo-title {
    font: var(--weight-bold) var(--text-xl) / 1.25 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .lo-body {
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .lo-actions {
    flex: none;
    align-self: stretch;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-10);
  }

  .lo-cancel,
  .lo-confirm {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .lo-cancel {
    box-shadow: inset 0 0 0 1px var(--line-2);
    color: var(--ink);
  }

  .lo-confirm {
    gap: 8px;
    background: var(--accent);
    color: var(--on-accent);
  }

  .lo-confirm.busy {
    cursor: default;
  }

  .lo-glyph {
    width: 15px;
    height: 15px;
    background: var(--on-accent);
  }
</style>

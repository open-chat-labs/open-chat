// Logic for CreateGroupDialog.svelte — carried over from lib/CreateGroupDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const CLOSE = "var(--icon-close) center/contain no-repeat";
const EDIT = "var(--icon-edit) center/contain no-repeat";
const GROUP = "var(--icon-community) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const CLOCK = "var(--icon-clock) center/contain no-repeat";
const PLUS = "var(--icon-plus) center/contain no-repeat";
const CHEVRON = "var(--icon-chevron-down) center/contain no-repeat";
const CHEVRON_RIGHT = "var(--icon-chevron-right) center/contain no-repeat";
const CHEVRON_LEFT = "var(--icon-back) center/contain no-repeat";
const ALERT = "var(--icon-warning) center/contain no-repeat";

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
};

// `line` is the mock cover section's border, so the choice reads even without a fill
const COVERS = {
  plum: { dark: "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)", light: "repeating-linear-gradient(115deg,#E9E3F0 0 10px,#DED6E8 10px 20px)", line: "#6E4C86" },
  teal: { dark: "linear-gradient(120deg,#0f3330,#143049)", light: "linear-gradient(120deg,#D8EFE8,#DCE9F4)", line: "#2E8C84" },
  violet: { dark: "linear-gradient(120deg,#271a3c,#3b1e39)", light: "linear-gradient(120deg,#E3DAF5,#F1DCEC)", line: "#7C58B8" },
  amber: { dark: "linear-gradient(120deg,#3a2716,#42301b)", light: "linear-gradient(120deg,#F7E7CE,#F2E3D2)", line: "#A97A32" },
  slate: { dark: "linear-gradient(120deg,#1a1c22,#24272f)", light: "linear-gradient(120deg,#E7E7EC,#DEDEE6)", line: "#6B7284" },
};

const NAME_MAX = 40;
const ABOUT_MAX = 500;
const AMOUNTS = ["1", "2", "3", "4", "6", "12"];
const UNITS = ["minutes", "hours", "days"];

const TABS = ["Group", "Invite", "Gates", "Rules", "Permissions"];
// same builder for groups and community channels; internal keys stay the group ones
const KINDS = {
  group: { keys: TABS, labels: TABS, basic: 2 },
  channel: { keys: TABS, labels: ["Channel", "Members", "Gates", "Rules", "Permissions"], basic: 2 },
  community: { keys: ["Group", "Invite", "Channels", "Gates", "Rules", "Permissions"], labels: ["Community", "Invite", "Channels", "Gates", "Rules", "Permissions"], basic: 3 },
  embedded: { keys: ["Group", "Invite", "Gates", "Permissions"], labels: ["Embedded channel", "Members", "Gates", "Permissions"], basic: 2 },
};
const HASH_MASK = "var(--icon-hash) center/contain no-repeat";
const EMBED_MASK = "var(--icon-embed) center/contain no-repeat";
const slugName = v => String(v).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");

const RULES_MAX = 1000;
const GEM_MASK = "var(--icon-gem) center/contain no-repeat";
const RULE_TEMPLATES = [
  { key: "standard", label: "Community standard", desc: "Respect, no impersonation, stay on topic", rules: ["Do not impersonate others in a deceptive or misleading manner", "Do not intentionally share false or misleading information", "Keep messages relevant to the group"] },
  { key: "trading", label: "Trading group", desc: "No financial advice, no pump talk", rules: ["No financial advice — do your own research", "No coordinated pumping or shilling", "Disclose any position you hold in a token you post about"] },
  { key: "support", label: "Support group", desc: "Privacy and no self-promotion", rules: ["Do not share other members' private details", "No promotion or recruiting", "Assume good faith — disagree without insults"] },
  { key: "civil", label: "Keep it civil", desc: "Harassment and slur policy", rules: ["No harassment, slurs, or hate speech", "No sexually explicit content", "Take heated arguments to DMs"] },
  { key: "project", label: "Project team", desc: "Stay on task, decisions in writing", rules: ["Keep discussion to the work in hand", "Write decisions down so nobody has to scroll for them", "Use threads for side conversations"] },
  { key: "announce", label: "Announcements", desc: "Few posters, replies in threads", rules: ["Only owners and admins post to the main channel", "Reply in a thread rather than the channel", "No promotion of other groups or products"] },
];

// role ladder, lowest first; "nobody" switches a permission off entirely
const ROLES = [
  { key: "member", label: "Members" },
  { key: "moderator", label: "Moderator" },
  { key: "admin", label: "Admin" },
  { key: "owner", label: "Owner" },
  { key: "nobody", label: "Nobody" },
];
const VALUE_LABEL = { member: "Everyone", moderator: "Moderator +", admin: "Admin +", owner: "Owner only", nobody: "Nobody" };
const PERMS = [
  { key: "roles", label: "Change member roles", group: "Members", def: "owner" },
  { key: "edit", label: "Edit group info", group: "Members", def: "admin" },
  { key: "invite", label: "Invite users", group: "Members", def: "member" },
  { key: "remove", label: "Remove / block members", group: "Members", def: "moderator" },
  { key: "delete", label: "Delete messages", group: "Moderation", def: "moderator" },
  { key: "pin", label: "Pin messages", group: "Moderation", def: "moderator" },
  { key: "react", label: "React to messages", group: "Moderation", def: "member" },
  { key: "everyone", label: "Mention all members (@everyone)", group: "Moderation", def: "admin" },
  { key: "calls", label: "Start video calls", group: "Moderation", def: "member" },
];
PERMS.push(
  { key: "pubChannels", label: "Create public channels", group: "Channels", def: "admin", only: "community" },
  { key: "privChannels", label: "Create private channels", group: "Channels", def: "member", only: "community" },
  { key: "userGroups", label: "Manage user groups", group: "Channels", def: "owner", only: "community" },
);
const PERM_GROUPS = ["Members", "Moderation", "Channels"];
const LANGUAGES = ["English", "Français", "Deutsch", "Italiano", "Español", "Português", "Türkçe", "Polski", "Nederlands", "Русский", "Українська", "日本語", "한국어", "中文", "हिन्दी", "Tiếng Việt", "Bahasa Indonesia"];
const CHAN_MAX = 30;
const KEBAB_MASK = "var(--icon-kebab) center/contain no-repeat";
const CHEV_DOWN = "var(--icon-chevron-down) center/contain no-repeat";
// messages and threads share this list; each type inherits the master unless set
const CONTENT = [
  { key: "text", label: "Text messages" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "file", label: "Files" },
  { key: "poll", label: "Polls" },
  { key: "crypto", label: "Crypto transfers" },
  { key: "giphy", label: "GIFs" },
  { key: "prize", label: "Prizes" },
  { key: "meme", label: "Meme Fighter" },
  { key: "p2p", label: "P2P swaps" },
];
const INHERIT = "inherit";
const permsChangedCount = p => {
  if (!p) return 0;
  return PERMS.filter(x => p.general[x.key] !== x.def).length
    + CONTENT.filter(c => p.messages[c.key] !== INHERIT).length
    + (p.messages.default !== "member" ? 1 : 0);
};

const DEFAULT_PERMS = () => {
  const o = { general: {}, messages: { default: "member" }, threads: { default: "member" } };
  PERMS.forEach(p => (o.general[p.key] = p.def));
  CONTENT.forEach(c => { o.messages[c.key] = INHERIT; o.threads[c.key] = INHERIT; });
  return o;
};
const roleIdx = key => ROLES.findIndex(r => r.key === key);

const SECTIONS = {
  Gates: { title: "Access gates", body: "Fine tune who can join your group by setting specific access gates, and how often members are re-checked." },
  Rules: { title: "Group rules", body: "Define a set of rules that the members of your group will have to follow." },
  Permissions: { title: "Permissions", body: "Define which user groups can access certain features within the group." },
};

const SEARCH = "var(--icon-search) center/contain no-repeat";


const PEOPLE = [
  { name: "Alice Anderson", handle: "@alice_anderson", color: "violet" },
  { name: "Lucy Linden", handle: "@lucy_linden", color: "teal" },
  { name: "Priya Raman", handle: "@priya_raman", color: "amber" },
  { name: "Danielle Moreau", handle: "@danielle_m", color: "blue" },
  { name: "Jonah Weiss", handle: "@jonah_weiss", color: "violet" },
  { name: "Robert Rodriguez", handle: "@robert_r", color: "amber" },
  { name: "Nadia Rahman", handle: "@nadia_r", color: "teal" },
  { name: "Otto Lindqvist", handle: "@otto_l", color: "blue" },
];

const FREQUENT = ["@alice_anderson", "@lucy_linden", "@priya_raman", "@danielle_m", "@jonah_weiss", "@robert_r"];
const PICKED_AT_START = ["@alice_anderson", "@lucy_linden"];

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      tab: 0, closing: false, nameTouched: false, advancedOpen: false,
      name: "", about: "", color: "teal", cover: "plum", avatarUrl: null,
      invited: [], memberMode: 0, channels: ["general"], chanDraft: "", chanEdit: null, chanEditValue: "", chanMenu: null, chanTried: false, lang: "English", langOpen: false, langQuery: "", coverUrl: null, publicOn: props.kind === "embedded", disappearOn: false, historyOn: false, previewOn: false, url: "", urlTouched: false,
      after: "12 hours",
      query: "", picked: (props.kind ?? "group") === "group" ? PICKED_AT_START : [],
      rulesOn: false, rulesText: "", rulesPreset: null, submitted: false,
      perms: DEFAULT_PERMS(), permSub: 0, threadsOverride: false, permMenu: null,
    };
    this._avatarInput = React.createRef();
    this._coverInput = React.createRef();

  }

  // the role menu is fixed-positioned so the dialog's overflow-y:auto body can never
  // clip it; it opens against the pill and its real height is measured after mount
  _openPermMenu(scope, key, el, allowInherit) {
    const r = el.getBoundingClientRect();
    const W = 238, PAD = 12;
    this.setState({
      permMenu: {
        scope, key, allowInherit,
        anchorTop: r.top, anchorBottom: r.bottom,
        top: (r.bottom + 6) + "px",
        left: Math.max(PAD, Math.min(r.right - W, window.innerWidth - PAD - W)) + "px",
        measured: false,
      },
    });
  }

  _setPerm(scope, key, role) {
    this.setState(st => ({ perms: { ...st.perms, [scope]: { ...st.perms[scope], [key]: role } }, permMenu: null }));
  }

  // a content type with no explicit setting reads as what it inherits, in muted ink
  _contentRow(scope, c, i, last) {
    const v = this.state.perms[scope];
    const inherited = v[c.key] === INHERIT;
    const eff = inherited ? v.default : v[c.key];
    return {
      label: c.label,
      divider: i === last ? "transparent" : "var(--line-1,rgba(255,255,255,.07))",
      weight: "var(--weight-regular)",
      labelInk: "var(--ink-2,#C9C9D4)",
      valueLabel: inherited ? "Default · " + VALUE_LABEL[eff] : VALUE_LABEL[eff],
      pillBg: inherited ? "transparent" : "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)",
      pillLine: inherited ? "var(--line-2,rgba(255,255,255,.12))" : "color-mix(in srgb, var(--accent,#FF5672) 34%, transparent)",
      pillInk: inherited ? "var(--ink-4,#7C7C8C)" : "var(--accent-bright,#FF8298)",
      onOpen: e => this._openPermMenu(scope, c.key, e.currentTarget, true),
    };
  }

  _masterRow(scope) {
    return {
      label: "Send messages by default",
      divider: "var(--line-1,rgba(255,255,255,.07))",
      weight: "var(--weight-semibold)",
      labelInk: "var(--ink,#E4E4EC)",
      valueLabel: VALUE_LABEL[this.state.perms[scope].default],
      pillBg: "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)",
      pillLine: "color-mix(in srgb, var(--accent,#FF5672) 34%, transparent)",
      pillInk: "var(--accent-bright,#FF8298)",
      onOpen: e => this._openPermMenu(scope, "default", e.currentTarget, false),
    };
  }

  _permsChangedCount() {
    const v = this.state.perms;
    let n = PERMS.filter(p => v.general[p.key] !== p.def).length;
    if (v.messages.default !== "member") n++;
    n += CONTENT.filter(c => v.messages[c.key] !== INHERIT).length;
    if (this.state.threadsOverride) {
      n++;
      if (v.threads.default !== "member") n++;
      n += CONTENT.filter(c => v.threads[c.key] !== INHERIT).length;
    }
    return n;
  }

  componentDidUpdate() {
    const m = this.state.permMenu;
    const el = this._permPanel;
    if (!m || m.measured || !el) return;
    const H = el.offsetHeight, PAD = 12;
    const flip = window.innerHeight - m.anchorBottom - PAD < H && m.anchorTop - PAD >= H;
    const top = flip ? m.anchorTop - 6 - H : Math.min(m.anchorBottom + 6, window.innerHeight - PAD - H);
    this.setState({ permMenu: { ...m, measured: true, top: Math.max(PAD, top) + "px" } });
  }

  componentWillUnmount() {
    clearTimeout(this._t);
    if (this.state.avatarUrl) URL.revokeObjectURL(this.state.avatarUrl);
  }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  _chip(label, mask, tone) {
    const c = tone === "muted" ? "var(--ink-3,#9A9AA8)" : "var(--status-verified,#3D9BFF)";
    return {
      label, mask, ink: c,
      wash: "color-mix(in srgb, " + c + " 14%, transparent)",
      line: "color-mix(in srgb, " + c + " 28%, transparent)",
    };
  }

  renderVals() {
    const s = this.state;
    const kind = KINDS[this.props.kind] ? this.props.kind : "group";
    const K = KINDS[kind];
    const isComm = kind === "community";
    const noun = isComm ? "community" : "group";
    const permList = PERMS.filter(x => !x.only || x.only === kind);
    const chName = v => String(v).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "").slice(0, CHAN_MAX);
    const draft = s.chanDraft;
    const draftDup = !!draft && s.channels.indexOf(draft) >= 0;
    const draftOk = !!draft && !draftDup;
    const addChan = () => { if (draftOk) this.setState(x => ({ channels: x.channels.concat([draft]), chanDraft: "", chanTried: false })); else this.setState({ chanTried: true }); };
    const editDup = s.chanEdit != null && s.channels.some((c, i) => i !== s.chanEdit && c === s.chanEditValue);
    const saveEdit = () => { if (!s.chanEditValue || editDup) return; this.setState(x => ({ channels: x.channels.map((c, i) => i === x.chanEdit ? x.chanEditValue : c), chanEdit: null })); };
    const langQ = s.langQuery.trim().toLowerCase();
    const isChan = kind === "channel" || kind === "embedded", isEmb = kind === "embedded";
    const tab = K.keys[s.tab] ?? "Group";
    // channels live in an existing community, so group-level Diamond limits don't apply
    const isDiamond = isChan || (this.props.isDiamond ?? true) !== false;
    const pool = this.props.people ?? PEOPLE;
    const commName = this.props.communityName ?? "the community";
    const urlOk = /^https?:\/\/\S+\.\S+/.test(s.url.trim());
    const urlBad = isEmb && !urlOk && s.urlTouched;
    // disclosure: Basic is Group + Invite. It opens revealed if anything advanced
    // already has a value, and reveals itself when the group is made public —
    // that is exactly when gates stop being exotic
    const advancedTouched = !!(s.gateCount || s.rulesOn || s.rulesText || permsChangedCount(s.perms));
    const advancedOpen = (this.props.advanced ?? true) === false || s.advancedOpen || advancedTouched;
    const visibleKeys = advancedOpen ? K.keys : K.keys.slice(0, K.basic);
    const visibleTabs = K.labels.slice(0, visibleKeys.length);
    const nameOk = s.name.trim().length > 0;
    const nameBad = !nameOk && s.nameTouched;
    // rules on with an empty field blocks creation, but only reads as an error once Create is pressed
    const rulesOk = !s.rulesOn || !!s.rulesText.trim();
    const rulesBad = !rulesOk && s.submitted;
    const coverMode = (this.props.mode ?? "dark") === "light" ? "light" : "dark";
    const section = SECTIONS[tab];
    const permsChanged = this._permsChangedCount();
    const contentScope = s.permSub === 2 ? "threads" : "messages";
    const msgExceptions = CONTENT.filter(c => s.perms.messages[c.key] !== INHERIT).length;
    const thrExceptions = CONTENT.filter(c => s.perms.threads[c.key] !== INHERIT).length;
    const pm = s.permMenu;
    // channels: mode 0 adds community members directly, mode 1 invites anyone (they must accept)
    const inviting = isChan && s.memberMode === 1;
    const listKey = inviting ? "invited" : "picked";
    const active = s[listKey];
    const toggle = handle => this.setState(st => ({
      [listKey]: st[listKey].indexOf(handle) === -1
        ? st[listKey].concat([handle])
        : st[listKey].filter(h => h !== handle),
    }));
    const q = s.query.trim().toLowerCase();
    // someone already added can't also be invited, and vice versa
    const other = isChan ? s[inviting ? "picked" : "invited"] : [];
    const modePool = (inviting ? (this.props.invitePeople ?? PEOPLE) : pool).filter(p => other.indexOf(p.handle) === -1);
    const results = q
      ? modePool.filter(p => (p.name + " " + p.handle).toLowerCase().indexOf(q) !== -1)
      : [];
    const row = u => {
      const sel = active.indexOf(u.handle) !== -1;
      return {
        name: u.name,
        handle: u.handle,
        gradient: GRADIENTS[u.color] ?? GRADIENTS.violet,
        onToggle: () => toggle(u.handle),
        rowBg: sel ? "color-mix(in srgb, var(--accent,#FF5672) 8%, transparent)" : "transparent",
        addBg: sel ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.07))",
        addLine: sel ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
        addInk: sel ? "var(--on-accent,#2E0512)" : "var(--ink-3,#9A9AA8)",
        addMask: sel ? CHECK : PLUS,
      };
    };
    const pick = (list, current, key) => list.map(label => {
      const on = label === current;
      return {
        label,
        wash: on ? "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)" : "var(--overlay-1,rgba(255,255,255,.05))",
        line: on ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.1))",
        ink: on ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)",
        onSelect: () => this.setState({ [key]: label }),
      };
    });

    return {
      veilAnim: s.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: s.closing ? OUT_CARD : IN_CARD,
      closeMask: CLOSE,
      editMask: EDIT,
      groupMask: isEmb ? EMBED_MASK : isChan ? HASH_MASK : GROUP,
      dialogTitle: isComm ? "Create community" : isEmb ? "Add embedded #channel" : isChan ? "Add new #channel" : "Create group",
      hasDialogSub: isChan,
      dialogSub: "in " + commName,
      createLabel: isComm ? "Create community" : isEmb ? "Create embedded channel" : isChan ? "Create channel" : "Create group",
      showCover: !isChan,
      isChannelKind: isChan,
      isEmbedded: isEmb,
      avatarLift: isChan ? "0px" : "-64px",
      avatarRadius: isChan ? "50%" : "34%",
      photoLabel: isChan ? "Channel photo" : isComm ? "Community photo" : "Group photo",
      nameLabel: isChan ? "Channel name" : isComm ? "Community name" : "Group name",
      namePlaceholder: isChan ? "channel-name" : isComm ? "Community name" : "Group name",
      aboutPlaceholder: isChan ? "Optionally, tell people what this channel is about" : isComm ? "Tell people what your community is about" : "Tell people what your group is about",
      url: s.url,
      onUrl: e => this.setState({ url: e.target.value, urlTouched: true }),
      urlLine: urlBad ? "var(--status-danger,#F5493D)" : "var(--line-2,rgba(255,255,255,.08))",
      urlHintInk: urlBad ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",
      urlHint: urlBad ? "Enter a full URL starting with https://" : "The site must allow being shown in an iframe. OpenChat can’t control that.",

      tabLabels: visibleTabs,
      showMoreOptions: !advancedOpen,
      onShowAdvanced: () => this.setState({ advancedOpen: true }),
      chevronRightMask: CHEVRON_RIGHT,
      // only offered while the extra tabs are empty — collapsing with values set
      // would hide settings the user has already made
      canCollapse: advancedOpen && !advancedTouched && (this.props.advanced ?? true) !== false,
      // the seam after Invite — two of the five equal tracks
      collapseAt: ((K.basic / K.keys.length) * 100) + "%",
      collapseMask: CHEVRON_LEFT,
      onHideAdvanced: () => this.setState({ advancedOpen: false, tab: Math.min(this.state.tab, K.basic - 1) }),
      // invite count sits on the Invites tab so the total is visible from any section
      // no invites yet means no badge at all
      tabCounts: visibleKeys.map(t =>
        t === "Invite" && (s.picked.length + (isChan ? s.invited.length : 0)) ? s.picked.length + (isChan ? s.invited.length : 0)
        : t === "Gates" && s.gateCount ? s.gateCount
        : t === "Channels" && s.channels.length ? s.channels.length
        : null),
      tabIndex: s.tab,
      tabDots: [nameBad || urlBad ? 0 : null, rulesBad && advancedOpen && K.keys.indexOf("Rules") >= 0 ? K.keys.indexOf("Rules") : null].filter(i => i !== null),
      onTab: i => this.setState({ tab: i }),
      isDetails: tab === "Group",
      isMembers: tab === "Invite",
      isGates: tab === "Gates",
      isChannelsTab: tab === "Channels",
      kindNoun: isComm ? "community" : isChan ? "channel" : "group",
      infoMask: "var(--icon-info) center/contain no-repeat",
      isCommunityKind: isComm,
      kebabMask: KEBAB_MASK, plusMask: PLUS, chevronDownMask: CHEV_DOWN, chanMax: CHAN_MAX,
      channelRows: s.channels.map((name, i) => ({
        name, editing: s.chanEdit === i, notEditing: s.chanEdit !== i,
        line: s.chanEdit === i ? (editDup ? "var(--status-danger,#F5493D)" : "var(--accent,#FF5672)") : "var(--line-2,rgba(255,255,255,.08))",
        menuOpen: s.chanMenu === i,
        kebabBg: s.chanMenu === i ? "var(--overlay-2,rgba(255,255,255,.09))" : "transparent",
        toggleMenu: () => this.setState(x => ({ chanMenu: x.chanMenu === i ? null : i })),
        menuItems: [
          { label: "Edit", mask: EDIT, onSelect: () => this.setState({ chanMenu: null, chanEdit: i, chanEditValue: name }) },
          { label: "Remove", mask: "var(--icon-trash) center/contain no-repeat", variant: "danger", onSelect: () => this.setState(x => ({ chanMenu: null, chanEdit: null, channels: x.channels.filter((_, k) => k !== i) })) },
        ],
      })),
      closeChanMenu: () => this.setState({ chanMenu: null }),
      noChannels: s.channels.length === 0,
      canRemoveAllChannels: s.channels.length > 1,
      onRemoveAllChannels: () => this.setState({ channels: [], chanEdit: null, chanMenu: null }),
      chanEditValue: s.chanEditValue,
      onChanEditInput: e => this.setState({ chanEditValue: chName(e.target.value) }),
      onChanEditKey: e => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.setState({ chanEdit: null }); } },
      onChanEditSave: saveEdit,
      onChanEditCancel: () => this.setState({ chanEdit: null }),
      chanDraft: draft,
      chanDraftLeft: String(CHAN_MAX - draft.length),
      onChanDraft: e => this.setState({ chanDraft: chName(e.target.value), chanTried: false }),
      onChanDraftKey: e => { if (e.key === "Enter") { e.preventDefault(); addChan(); } },
      onChanAdd: addChan,
      chanAddLine: (draftDup || (s.chanTried && !draft)) ? "var(--status-danger,#F5493D)" : draft ? "var(--line-3,rgba(255,255,255,.22))" : "var(--line-2,rgba(255,255,255,.08))",
      chanAddBg: draftOk ? "var(--accent,#FF5672)" : "var(--overlay-1,rgba(255,255,255,.05))",
      chanAddInk: draftOk ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      chanAddCursor: draftOk ? "pointer" : "not-allowed",
      chanHint: draftDup ? "#" + draft + " is already in the list." : (s.chanTried && !draft) ? "Your channel needs a name." : "Lowercase, no spaces. Press Enter to add.",
      chanHintInk: draftDup || (s.chanTried && !draft) ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",
      langLabel: s.lang,
      langLine: s.langOpen ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.08))",
      langChevron: s.langOpen ? "rotate(180deg)" : "none",
      langOpen: s.langOpen,
      onLangToggle: () => this.setState(x => ({ langOpen: !x.langOpen, langQuery: "" })),
      onLangClose: () => this.setState({ langOpen: false }),
      langQuery: s.langQuery,
      onLangQuery: e => this.setState({ langQuery: e.target.value }),
      onLangClear: () => this.setState({ langQuery: "" }),
      langOptions: LANGUAGES.filter(l => !langQ || l.toLowerCase().indexOf(langQ) >= 0).map(l => ({
        label: l, bg: l === s.lang ? "color-mix(in srgb, var(--accent,#FF5672) 10%, transparent)" : "transparent",
        ink: l === s.lang ? "var(--accent-bright,#FF8298)" : "var(--ink,#ECECF1)", checkOpacity: l === s.lang ? 1 : 0,
        pick: () => this.setState({ lang: l, langOpen: false }),
      })),
      coverRef: this._coverInput,
      coverHeight: isComm ? "150px" : "112px",
      coverUploadLabel: s.coverUrl ? "Change cover" : "Upload cover",
      onPickCover: () => { if (this._coverInput.current) this._coverInput.current.click(); },
      onCoverFile: e => { const file = e.target.files && e.target.files[0]; if (!file) return; if (s.coverUrl) URL.revokeObjectURL(s.coverUrl); this.setState({ coverUrl: URL.createObjectURL(file) }); },
      // the draft, not a prop: the builder unmounts on tab switch and must return
      // showing the edits, which are also what Create submits
      gates: s.gates,
      onGatesChange: g => this.setState({ gateCount: g.count, gates: g }),
      isRules: tab === "Rules",
      isDiamond,
      gemMask: GEM_MASK,
      onUpgrade: this.props.onUpgrade,
      rulesOn: s.rulesOn,
      onRulesOn: v => this.setState({ rulesOn: v }),
      rulesText: s.rulesText,
      hasRulesText: !!s.rulesText,
      rulesMax: RULES_MAX,
      rulesError: rulesBad,
      onRulesText: e => { const v = e && e.target ? e.target.value : e; this.setState({ rulesText: v, rulesPreset: null }); },
      onClearRules: () => this.setState({ rulesText: "", rulesPreset: null }),
      rulePresets: RULE_TEMPLATES.map(t => {
        const on = s.rulesPreset === t.key;
        return {
          label: t.label, desc: t.desc,
          bg: on ? "color-mix(in oklch,var(--accent,#FF5672) 10%,transparent)" : "var(--overlay-1,rgba(255,255,255,.04))",
          line: on ? "color-mix(in oklch,var(--accent,#FF5672) 45%,transparent)" : "var(--line-1,rgba(255,255,255,.07))",
          ink: on ? "var(--accent,#FF5672)" : "var(--ink,#E4E4EC)",
          onSelect: () => this.setState({ rulesPreset: t.key, rulesText: t.rules.map((r, i) => (i + 1) + ". " + r).join("\n").slice(0, RULES_MAX) }),
        };
      }),
      isPerms: tab === "Permissions",
      chevronMask: CHEVRON,
      checkMask: CHECK,

      permSub: s.permSub,
      onPermSub: i => this.setState({ permSub: i, permMenu: null }),
      permSubLabels: ["General", "Messages", "Threads"],
      permSubCounts: [
        PERMS.filter(x => s.perms.general[x.key] !== x.def).length || null,
        msgExceptions || null,
        s.threadsOverride ? (thrExceptions || null) : null,
      ],

      threadsOverride: s.threadsOverride,
      onThreadsOverride: v => this.setState({ threadsOverride: v, permMenu: null }),
      threadHint: s.threadsOverride
        ? "Threads use the set below. Messages outside threads are unaffected."
        : "Threads currently follow whatever you set for messages.",
      showThreadSwitch: s.permSub === 2,
      showPermList: s.permSub !== 2 || s.threadsOverride,
      showThreadsInherited: s.permSub === 2 && !s.threadsOverride,

      permGroups: s.permSub === 0
        ? PERM_GROUPS.filter(g => permList.some(x => x.group === g)).map(g => {
            const items = permList.filter(x => x.group === g);
            return {
              label: g.toUpperCase(),
              hasLabel: true,
              items: items.map((x, i) => {
                const cur = s.perms.general[x.key];
                const off = cur === "nobody";
                return {
                  label: x.key === "edit" ? "Edit " + noun + " info" : x.label,
                  divider: i === items.length - 1 ? "transparent" : "var(--line-1,rgba(255,255,255,.07))",
                  weight: "var(--weight-regular)",
                  labelInk: "var(--ink-2,#C9C9D4)",
                  valueLabel: VALUE_LABEL[cur],
                  pillBg: off ? "var(--overlay-1,rgba(255,255,255,.05))" : "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)",
                  pillLine: off ? "var(--line-2,rgba(255,255,255,.12))" : "color-mix(in srgb, var(--accent,#FF5672) 34%, transparent)",
                  pillInk: off ? "var(--ink-3,#9A9AA8)" : "var(--accent-bright,#FF8298)",
                  onOpen: e => this._openPermMenu("general", x.key, e.currentTarget, false),
                };
              }),
            };
          })
        : [{
            label: "", hasLabel: false,
            items: [this._masterRow(contentScope)].concat(CONTENT.map((c, i) => this._contentRow(contentScope, c, i, CONTENT.length - 1))),
          }],

      permMenuOpen: !!pm,
      permMenuTop: pm ? pm.top : "0px",
      permMenuLeft: pm ? pm.left : "0px",
      // hidden for the one frame between mount and measurement, so it never paints mis-placed
      permMenuVis: pm && pm.measured ? "visible" : "hidden",
      permPanelRef: el => { this._permPanel = el; },
      permMenuHint: pm && pm.allowInherit ? "Who can send this" : "Lowest role with this permission",
      onClosePermMenu: () => this.setState({ permMenu: null }),
      permMenuOptions: !pm ? [] : (pm.allowInherit ? [{ key: INHERIT, label: "Same as default" }] : []).concat(ROLES).map(r => {
        const sel = r.key === s.perms[pm.scope][pm.key];
        return {
          label: r.label,
          onPick: () => this._setPerm(pm.scope, pm.key, r.key),
          bg: sel ? "color-mix(in srgb, var(--accent,#FF5672) 12%, transparent)" : "transparent",
          dotBg: sel ? "var(--accent,#FF5672)" : "transparent",
          dotLine: sel ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.16))",
          tick: sel ? "var(--on-accent,#2E0512)" : "transparent",
          ink: sel ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)",
          weight: sel ? "var(--weight-semibold)" : "var(--weight-regular)",
        };
      }),

      permsChanged: permsChanged > 0,
      permsSummary: permsChanged + (permsChanged === 1 ? " permission differs from the defaults" : " permissions differ from the defaults"),
      onPermsReset: () => this.setState({ perms: DEFAULT_PERMS(), threadsOverride: false, permMenu: null }),

      isPlaceholder: !!section && tab !== "Gates" && tab !== "Rules" && tab !== "Permissions",
      sectionTitle: section ? section.title : "",
      sectionBody: section ? section.body : "",
      hasSectionChips: tab === "Gates" || tab === "Rules",
      sectionChips: tab === "Gates"
        ? [
            this._chip("Lifetime diamond membership", CHECK),
            this._chip("Neuron holder", CHECK),
            this._chip("Unique person", CHECK),
            this._chip("Evaluation interval set", CLOCK, "muted"),
          ]
        : tab === "Rules" ? [this._chip("Rules added", ALERT, "muted")] : [],

      avatarGradient: GRADIENTS[s.color] ?? GRADIENTS.teal,
      avatarImage: s.avatarUrl ? "url(" + s.avatarUrl + ") center/cover no-repeat" : "none",
      avatarRef: this._avatarInput,
      hasPickedPhoto: !!s.avatarUrl,
      onPickAvatar: () => { if (this._avatarInput.current) this._avatarInput.current.click(); },
      onAvatarFile: e => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (s.avatarUrl) URL.revokeObjectURL(s.avatarUrl);
        this.setState({ avatarUrl: URL.createObjectURL(f) });
      },
      onClearAvatar: () => {
        if (s.avatarUrl) URL.revokeObjectURL(s.avatarUrl);
        this.setState({ avatarUrl: null });
      },
      colorChoices: Object.keys(GRADIENTS).map(key => ({
        label: key,
        gradient: GRADIENTS[key],
        ring: key === s.color
          ? "0 0 0 2px var(--surface-1,#0e0e12), 0 0 0 4px var(--accent,#FF5672)"
          : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14))",
        onSelect: () => this.setState({ color: key }),
      })),
      coverLine: (COVERS[s.cover] ?? COVERS.plum).line,
      coverValue: s.coverUrl ? "url(" + s.coverUrl + ") center/cover no-repeat" : "var(--cover-" + (COVERS[s.cover] ? s.cover : "plum") + ")",
      coverChoices: Object.keys(COVERS).map(key => ({
        label: key,
        value: "var(--cover-" + key + ")",
        // the swatch wears the border colour it will apply to the cover
        line: COVERS[key].line,
        ring: key === s.cover
          ? "0 0 0 2px var(--surface-1,#0e0e12), 0 0 0 4px var(--accent,#FF5672)"
          : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14))",
        onSelect: () => this.setState({ cover: key, coverUrl: null }),
      })),

      name: s.name,
      about: s.about,
      nameMax: NAME_MAX,
      aboutMax: ABOUT_MAX,
      nameLeft: String(NAME_MAX - s.name.length),
      nameLeftInk: NAME_MAX - s.name.length <= 5 ? "var(--status-warning,#FFB03D)" : "var(--ink-4,#7C7C8C)",
      nameHint: isChan ? (nameOk ? "Lowercase, no spaces. Spaces become dashes." : "#channel name is required *") : nameOk ? (isComm ? "Shown in the nav rail and in Explore" : "The name members see in their chat list") : (isComm ? "Community name is required *" : "Group name is required *"),
      nameHintInk: nameBad ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",
      nameLine: nameBad ? "var(--status-danger,#F5493D)" : "var(--line-2,rgba(255,255,255,.08))",
      onName: e => this.setState({ name: isChan ? slugName(e.target.value) : e.target.value, nameTouched: true }),
      onAbout: e => this.setState({ about: e.target.value }),

      switches: (isEmb ? [
        { locked: false, disabled: false, title: "Public channel", hint: "Channels are private by default and limited to people you invite. Public channels need a unique name, and " + commName + " members are added automatically.", on: s.publicOn, onChange: v => this.setState({ publicOn: v, previewOn: v ? s.previewOn : false }), divider: "var(--line-1,rgba(255,255,255,.07))", showDuration: false },
        { locked: false, disabled: !s.publicOn, title: "Non-members can preview messages", hint: s.publicOn ? "People who haven’t joined can read the channel before joining." : "Only available for public channels.", on: s.publicOn && s.previewOn, onChange: v => { if (s.publicOn) this.setState({ previewOn: v }); }, divider: "transparent", showDuration: false },
      ] : isChan ? [
        { locked: false, disabled: false, title: "Public channel", hint: "Channels are private by default and limited to people you invite. Public channels need a unique name, and " + commName + " members are added automatically.", on: s.publicOn, onChange: v => this.setState({ publicOn: v }), divider: "var(--line-1,rgba(255,255,255,.07))", showDuration: false },
        { locked: false, disabled: s.publicOn, title: "Visible chat history", hint: s.publicOn ? "Always on for public channels." : "New joiners see the full history when on, and only messages sent after they joined when off.", on: s.historyOn || s.publicOn, onChange: v => { if (!s.publicOn) this.setState({ historyOn: v }); }, divider: "var(--line-1,rgba(255,255,255,.07))", showDuration: false },
        { locked: false, disabled: false, title: "Disappearing messages", hint: s.disappearOn ? "Messages older than " + s.after + " are deleted automatically." : "Messages are kept until someone deletes them.", on: s.disappearOn, onChange: v => this.setState({ disappearOn: v }), divider: "transparent", showDuration: s.disappearOn },
      ] : isComm ? [
        { locked: false, disabled: false, title: "Public community", hint: "Private by default — only invited people can join. Public communities appear in Explore and anyone can join. Channels inside can still be private.", on: s.publicOn, onChange: v => this.setState({ advancedOpen: v || this.state.advancedOpen, publicOn: v }), divider: "var(--line-1,rgba(255,255,255,.07))", showDuration: false },
        { locked: false, disabled: false, title: "Visible chat history", hint: "The default for new channels: new joiners see the full history when on.", on: s.historyOn, onChange: v => this.setState({ historyOn: v }), divider: "transparent", showDuration: false },
      ] : [
        { title: "Public group", hint: "Private by default — only invited people can join. Public groups can be found and joined by anyone.", on: s.publicOn && isDiamond, locked: !isDiamond, disabled: !isDiamond, onChange: v => { if (isDiamond) this.setState({ advancedOpen: v || this.state.advancedOpen, publicOn: v }); }, divider: "var(--line-1,rgba(255,255,255,.07))", showDuration: false },
        { locked: false, disabled: false, title: "Visible chat history", hint: "New joiners see the full history when on, and only messages sent after they joined when off.", on: s.historyOn, onChange: v => this.setState({ historyOn: v }), divider: "var(--line-1,rgba(255,255,255,.07))", showDuration: false },
        { locked: false, disabled: false, title: "Disappearing messages", hint: s.disappearOn ? "Messages older than " + s.after + " are deleted automatically." : "Messages are kept until someone deletes them.", on: s.disappearOn, onChange: v => this.setState({ disappearOn: v }), divider: "transparent", showDuration: s.disappearOn },
      ]).map(x => ({ ...x, timed: x.title === "Disappearing messages", plain: x.title !== "Disappearing messages", offHint: "Messages are kept until someone deletes them." })),
      showTimeout: s.disappearOn,
      after: s.after,
      onAfter: label => this.setState({ after: label }),

      searchMask: SEARCH,
      checkMask: CHECK,
      query: s.query,
      hasQuery: s.query.trim().length > 0,
      onQuery: e => this.setState({ query: e.target.value }),
      onClearQuery: () => this.setState({ query: "" }),
      memberModeLabels: ["Add from community", "Invite people"],
      memberModeCounts: [s.picked.length || null, s.invited.length || null],
      memberModeIndex: s.memberMode,
      noDots: [],
      onMemberMode: i => this.setState({ memberMode: i, query: "" }),
      memberModeHint: inviting ? "Anyone on OpenChat. They join once they accept the invite." : "People you pick join straight away. Only " + commName + " members can be added.",
      memberSearchPlaceholder: inviting ? "Search people by name or @handle" : isChan ? "Search " + commName + " members" : "Search people by name or @handle",
      hasPicked: active.length > 0,
      picked: active.map(h => {
        const u = modePool.find(p => p.handle === h) || { handle: h, color: "violet" };
        return { handle: u.handle, gradient: GRADIENTS[u.color] ?? GRADIENTS.violet, onToggle: () => toggle(h) };
      }),
      nonePickedText: isChan
        ? (inviting ? "Nobody invited yet — you can send invites once the channel exists." : "Nobody added yet — you can create the channel empty and add people later.")
        : "Nobody yet — you can create the group empty and invite people once it exists.",
      invitedLabel: (isChan && !inviting ? "ADDED · " : "INVITED · ") + active.length,
      nonePicked: active.length === 0,
      onClearAll: () => this.setState({ [listKey]: [] }),
      listLabel: q ? "SEARCH RESULTS" : isChan && !inviting ? commName.toUpperCase() + " MEMBERS" : "FREQUENTLY CONTACTED",
      noResults: !!q && results.length === 0,
      people: (q ? results : isChan && !inviting ? pool : modePool.filter(p => FREQUENT.indexOf(p.handle) !== -1)).map(row),
      // one running summary of the whole dialog, so no section hides its own state
      showFooterNote: !!(nameOk || nameBad || s.picked.length || s.gateCount || s.rulesOn || permsChanged),
      footerNote: [
        nameOk ? "Name set" : nameBad ? "Name needed" : null,
        isEmb ? (urlOk ? "URL set" : urlBad ? "URL needed" : null) : null,
        isComm ? s.channels.length + (s.channels.length === 1 ? " channel" : " channels") : null,
        s.picked.length ? s.picked.length + (isChan ? (s.picked.length === 1 ? " member" : " members") : (s.picked.length === 1 ? " invite" : " invites")) : null,
        isChan && s.invited.length ? s.invited.length + (s.invited.length === 1 ? " invite" : " invites") : null,
        s.gateCount ? s.gateCount + (s.gateCount === 1 ? " gate" : " gates") : null,
        s.rulesOn ? (s.rulesText.trim() ? "Rules on" : "Rules needed") : null,
        permsChanged ? "Permissions edited" : null,
      ].filter(Boolean).join(" • "),
      footerInk: nameBad || rulesBad || urlBad ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",

      createBg: nameOk && (!isEmb || urlOk) ? "var(--accent,#FF5672)" : "var(--overlay-1,rgba(255,255,255,.05))",
      createInk: nameOk && (!isEmb || urlOk) ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      createCursor: nameOk && (!isEmb || urlOk) ? "pointer" : "not-allowed",
      onCancel: () => this._close(this.props.onCancel),
      onCreate: () => {
        // pressing Create without a name sends the user back to the field that needs it
        if (!nameOk || (isEmb && !urlOk)) { this.setState({ nameTouched: true, urlTouched: isEmb, submitted: true, tab: 0 }); return; }
        // same for rules switched on but left blank
        if (!rulesOk && K.keys.indexOf("Rules") >= 0) { this.setState({ submitted: true, tab: K.keys.indexOf("Rules") }); return; }
        this._close(() => {
          if (this.props.onCreate) this.props.onCreate({
            name: s.name.trim(), about: s.about, color: s.color, coverKey: s.cover, avatar: s.avatarUrl,
            kind, embedded: isEmb, language: isComm ? s.lang : null, coverUrl: s.coverUrl, channels: isComm ? s.channels.slice() : [], url: s.url.trim(), previewForNonMembers: isEmb && s.publicOn && s.previewOn,
            isPublic: s.publicOn, visibleHistory: s.historyOn || (isChan && s.publicOn),
            disappearAfter: s.disappearOn ? s.after : null,
            members: s.picked.slice(),
            invites: isChan ? s.invited.slice() : [],
            gates: s.gates || { count: 0 },
            rules: s.rulesOn ? { enabled: true, text: s.rulesText.trim() } : { enabled: false, text: "" },
            permissions: { general: { ...s.perms.general }, messages: { ...s.perms.messages }, threads: s.threadsOverride ? { ...s.perms.threads } : null },
          });
        });
      },
    };
  }
}

export default Component;

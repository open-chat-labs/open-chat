// Logic for GroupPanel.svelte — carried over from lib/GroupPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const MEMBERS_MASK = "var(--icon-users) center/contain no-repeat";
const BACK_MASK = "var(--icon-back) center/contain no-repeat";

// cover choices are muted grounds, one per accent family, so the avatar stays the focus
const COVERS = {
  plum: { dark: "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)", light: "repeating-linear-gradient(115deg,#E9E3F0 0 10px,#DED6E8 10px 20px)" },
  teal: { dark: "linear-gradient(120deg,#0f3330,#143049)", light: "linear-gradient(120deg,#D8EFE8,#DCE9F4)" },
  violet: { dark: "linear-gradient(120deg,#271a3c,#3b1e39)", light: "linear-gradient(120deg,#E3DAF5,#F1DCEC)" },
  amber: { dark: "linear-gradient(120deg,#3a2716,#42301b)", light: "linear-gradient(120deg,#F7E7CE,#F2E3D2)" },
  slate: { dark: "linear-gradient(120deg,#1a1c22,#24272f)", light: "linear-gradient(120deg,#E7E7EC,#DEDEE6)" },
};

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
};

const MEMBERS = [
  { title: "Jane Smith", handle: "@jane_smith", tag: "OWNER", color: "violet" },
  { title: "John Smith", handle: "@john_smith", tag: "YOU", color: "blue" },
  { title: "Alice Anderson", handle: "@alice_anderson", tag: "ADMIN", color: "rose" },
  { title: "Lucy Linden", handle: "@lucy_linden", tag: "ADMIN", color: "teal" },
  { title: "Ryan Rogers", handle: "@ryan_rogers", tag: "", color: "amber" },
  { title: "Christina Cameron", handle: "@christina_cameron", tag: "", color: "plum" },
  { title: "Marcus Webb", handle: "@marcus_webb", tag: "", color: "slate" },
  { title: "Priya Raman", handle: "@priya_raman", tag: "", color: "teal" },
];

const BOTS = [
  { variant: "bot", title: "LlamaBot", subtitle: "Sends prompts to the Llama 3 LLM and posts the reply in the thread.", color: "slate" },
  { variant: "bot", title: "WelcomeBot", subtitle: "Greets new members with a custom message when they join.", color: "plum" },
];

const WEBHOOKS = [
  { variant: "webhook", title: "ci_builds", subtitle: "", color: "blue", url: "https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/155810f3b90cb851aa633fc4aa435482" },
  { variant: "webhook", title: "monitoring_alerts", subtitle: "", color: "plum", url: "https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/8d2c47ae91b05f7361ce0b4482da19f7" },
];

const RECOMMENDED = [
  { variant: "bot", title: "ReminderBot", subtitle: "Sends one-off and recurring reminder messages.", color: "slate" },
  { variant: "bot", title: "YoutubeBot", subtitle: "Subscribe to a YouTube channel to get updates about new video releases.", color: "rose" },
  { variant: "bot", title: "DiscordBot", subtitle: "Proxy messages from your Discord community into OpenChat.", color: "blue" },
  { variant: "bot", title: "AdventureBot", subtitle: "Play a selection of classic text-based adventures in chat.", color: "amber" },
  { variant: "bot", title: "ModerationBot", subtitle: "Performs automated moderation using rules you configure.", color: "teal" },
];

const PERM_ROLES = [
  { key: "member", label: "Members", tint: "#5FA8FF" },
  { key: "moderator", label: "Moderator", tint: "#2EE6A8" },
  { key: "admin", label: "Admin", tint: "#FFB03D" },
  { key: "owner", label: "Owner", tint: "#FF5672" },
  { key: "nobody", label: "Nobody", tint: "#6E6E7C" },
];
const PERM_GENERAL = [
  { key: "roles", label: "Change member roles", short: "Change roles", def: "owner" },
  { key: "edit", label: "Edit group info", short: "Edit group info", def: "admin" },
  { key: "invite", label: "Invite users", short: "Invite users", def: "member" },
  { key: "remove", label: "Remove / block members", short: "Remove members", def: "moderator" },
  { key: "delete", label: "Delete messages", short: "Delete messages", def: "moderator" },
  { key: "pin", label: "Pin messages", short: "Pin messages", def: "moderator" },
  { key: "react", label: "React to messages", short: "React", def: "member" },
  { key: "everyone", label: "Mention all members (@everyone)", short: "Mention @everyone", def: "admin" },
  { key: "calls", label: "Start video calls", short: "Start calls", def: "member" },
];
const PERM_CONTENT = [
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
const PERM_INHERIT = "inherit";
const permRoleIdx = k => PERM_ROLES.findIndex(r => r.key === k);
// the shape the create-group modal emits; used when the panel gets no permissions prop
const PERM_FALLBACK = () => {
  const o = { general: {}, messages: { default: "member" }, threads: null };
  PERM_GENERAL.forEach(p => (o.general[p.key] = p.def));
  PERM_CONTENT.forEach(c => (o.messages[c.key] = PERM_INHERIT));
  return o;
};
const CLOCK_MASK = "var(--icon-clock) center/contain no-repeat";
const GATE_ICONS = {
  diamond: "var(--icon-diamond) center/contain no-repeat",
  person: "var(--icon-person) center/contain no-repeat",
  token: "var(--icon-token) center/contain no-repeat",
  payment: "var(--icon-payment) center/contain no-repeat",
  balance: "var(--icon-balance) center/contain no-repeat",
  neuron: "var(--icon-neuron) center/contain no-repeat",
  credential: "var(--icon-credential) center/contain no-repeat",
  chit: "var(--icon-chit) center/contain no-repeat",
  lock: "var(--icon-lock) center/contain no-repeat",
};

const GATE_TYPES = {
  lifetime: { label: "Lifetime diamond membership", icon: "diamond", tint: "#7FC0FF" },
  diamond: { label: "Diamond membership", icon: "diamond", tint: "#7FC0FF" },
  unique: { label: "Unique person", icon: "person", tint: "#5CE9BC" },
  credential: { label: "Verified credential", icon: "credential", tint: "#5CE9BC" },
  balance: { label: "Minimum token balance", icon: "balance", tint: "#FFB03D" },
  chit: { label: "Minimum CHIT earned", icon: "chit", tint: "#FFB03D" },
  payment: { label: "Payment", icon: "payment", tint: "#FF8298" },
  neuron: { label: "Neuron holder", icon: "neuron", tint: "#FF8298" },
  locked: { label: "Locked", icon: "lock", tint: "#9A9AA8" },
};

// the builder stores an asset plus up to two numeric fields per rule; this turns
// that back into the one-line value the read view shows
const gateValue = r => {
  // wording follows the chips in lib/AccessGates.dc.html TYPES: amount-bearing
  // types read "min 100 CHAT" / "10 USDT", neuron reads asset first
  if (r.type === "balance") return r.asset && r.a ? "min " + r.a + " " + r.asset : (r.a ? "min " + r.a : r.asset || "");
  if (r.type === "payment") return r.asset && r.a ? r.a + " " + r.asset : (r.a || r.asset || "");
  if (r.type === "chit") return r.a ? r.a + " CHIT" : "";
  if (r.type === "neuron") {
    const bits = [];
    if (r.asset) bits.push(r.asset);
    if (r.a) bits.push(r.a + "d dissolve delay");
    if (r.b) bits.push(r.b + " staked");
    return bits.join(" · ");
  }
  return r.asset || "";
};

// builder-shaped, so the read view and the editor open from the same object
const GATE_FIXTURE = () => ({
  rules: [
    { id: "g1", type: "lifetime" },
    { id: "g2", type: "unique" },
    { id: "g3", type: "balance", asset: "CHAT", a: "100" },
    { id: "g4", type: "neuron", asset: "OpenChat", a: "90" },
  ],
  joiner: "All",
  intervalOn: true,
  every: "90 days",
});

const RULES_FIXTURE = () => ({ enabled: true, text: RULES.map(r => "• " + r).join("\n") });


const RULES = [
  "Do not impersonate others in a deceptive or misleading manner.",
  "Do not intentionally share false or misleading information.",
  "Keep messages relevant to the group.",
];

// scoped mute: "Always" stays available, but it is a choice rather than the default
const QUICK_MASKS = {
  bell: "var(--icon-bell) center/contain no-repeat",
  bellOff: "var(--icon-bell-off) center/contain no-repeat",
  heart: "var(--icon-heart) center/contain no-repeat",
  at: "var(--icon-at) center/contain no-repeat",
  atOff: "var(--icon-at-off) center/contain no-repeat",
  caret: "var(--icon-chevron-down) center/contain no-repeat",
};

const MUTE_SPANS = [
  { key: "8h", label: "For 8 hours", tile: "Muted · 8h" },
  { key: "1w", label: "For 1 week", tile: "Muted · 1w" },
  { key: "always", label: "Until I turn it back on", tile: "Muted" },
];

const HEART_FILLED = "var(--icon-heart-filled) center/contain no-repeat";
const HEART_MASK = "var(--icon-heart) center/contain no-repeat";

const MENU_ITEMS = [
  { label: "Favourite", action: "favourite", mask: HEART_MASK },
  { label: "Group settings", action: "settings", mask: "var(--icon-gear) center/contain no-repeat" },
  { label: "Group stats", view: "stats", mask: "var(--icon-poll) center/contain no-repeat" },
  { variant: "separator", label: "", action: "sep-bots" },
  { label: "Add a bot", action: "addbot", mask: "var(--icon-bot) center/contain no-repeat" },
  { label: "Create a webhook", action: "webhook", mask: "var(--icon-hook) center/contain no-repeat" },
  { variant: "separator", label: "", action: "sep-after-bots" },
  { label: "Convert to community", action: "convert", mask: "var(--icon-community) center/contain no-repeat" },
  { label: "Import to community", action: "import", mask: "var(--icon-import) center/contain no-repeat" },
  { label: "Leave group", variant: "danger", action: "leave", mask: "var(--icon-leave) center/contain no-repeat" },
  { label: "Delete group", variant: "danger", action: "delete", mask: "var(--icon-trash) center/contain no-repeat" },
];

const EDIT_MASK = "var(--icon-edit) center/contain no-repeat";

const USER_GROUPS = [
  { title: "Developers", subtitle: "4 members", color: "blue" },
  { title: "Designers", subtitle: "2 members", color: "plum" },
];
const CHEV_MASK = "var(--icon-chevron-right) center/contain no-repeat";
const SCOPE_MENU_EXTRA = [
  { variant: "separator", label: "", action: "sep-channels" },
  { label: "New channel", action: "newchannel", mask: "var(--icon-plus) center/contain no-repeat" },
  { label: "Add embedded channel", action: "embed", mask: "var(--icon-embed) center/contain no-repeat" },
  { label: "New user group", action: "newusergroup", mask: "var(--icon-invite) center/contain no-repeat" },
];
const SUBVIEWS = {
  usergroups: "User groups",
  usergroup: "User group",
  members: "Members",
  bots: "Bots & webhooks",
  botsOnly: "Bots",
  permissions: "Permissions",
  gates: "Access gates",
  rules: "Group rules",
  stats: "Group stats",
  pinned: "Pinned messages",
};

// per-instance key so a second mount (library specimen, community panel) cannot
// overwrite the running app's sub-view; "" opts out of persistence entirely
const readStored = key => {
  if (!key) return "main";
  try {
    const v = localStorage.getItem(key);
    return (v && (v === "main" || SUBVIEWS[v])) ? v : "main";
  } catch (e) { return "main"; }
};

const MEMBER_TABS = ["Members", "Lapsed", "Blocked"];

const LAPSED = [
  { title: "Tom Hayes", handle: "@tom_hayes", tag: "LAPSED", color: "amber" },
  { title: "Nadia Rahman", handle: "@nadia_r", tag: "LAPSED", color: "teal" },
  { title: "Otto Lindqvist", handle: "@otto_l", tag: "LAPSED", color: "violet" },
];

const BLOCKED = [
  { title: "Vic Palmer", handle: "@vic_palmer", tag: "BLOCKED", color: "blue" },
  { title: "Rex Duvall", handle: "@rex_duvall", tag: "BLOCKED", color: "amber" },
];

const MEMBER_LIST_TITLES = ["Current", "Lapsed", "Blocked"];


const MEMBER_NOTES = [
  "",
  "When a member of your group no longer satisfies the access gates set in the group settings, they become a lapsed member!",
  "Users which have been blocked from accessing this group.",
];

class Component extends DCLogic {
  _awayRef = React.createRef();
  componentWillUnmount() { document.removeEventListener("pointerdown", this._awayFn, true); }
  _bindAway() {
    // in-panel backdrops only cover this panel; clicks elsewhere on the page close menus here
    this._awayFn = e => {
      const el = this._awayRef.current;
      if (!el || el.contains(e.target)) return;
      if (this.state.menu || this.state.muteMenu || this.state.ugMenu) this.setState({ menu: false, muteMenu: null, ugMenu: null });
    };
    document.addEventListener("pointerdown", this._awayFn, true);
  }
  _aboutRef = React.createRef();
  _measureAbout() {
    const el = this._aboutRef.current;
    if (!el || this.state.aboutOpen) return;
    const long = el.scrollHeight - el.clientHeight > 2;
    if (long !== !!this.state.aboutLong) this.setState({ aboutLong: long });
  }
  componentDidMount() {
    this._bindAway();
    this._measureAbout();
    // a request can arrive with the mount (e.g. switching from channel to community details)
    const req = this.props.viewRequest;
    if (req) { const target = String(req).split("#")[0]; if (SUBVIEWS[target]) this._go(target); else if (target === "settings") this._openSettings(); }
  }
  constructor(props) {
    super(props);
    const key = props.storageKey === undefined ? "oc.groupPanel.view" : props.storageKey;
    this.state = { view: readStored(key), menu: false, memberTab: 0 };
  }

  _storeKey() {
    return this.props.storageKey === undefined ? "oc.groupPanel.view" : this.props.storageKey;
  }

  // 3a: the quick panel is built around who's here now, your settings, and a little context
  _quickVals(c) {
    if (!c.quick) return { channelIn: "channel in", mainPadBottom: "var(--space-32)", avatarSize: "72px", avatarLift: "-34px", avatarGap: "0px", identityPadBottom: "var(--space-16)", showFavHeart: !!(this.props.isFavourite ?? this.state.fav), notQuick: true, showQuickByline: false, showFullByline: c.scope !== "channel", hasBotsSlim: false, onlineRows: [], botStack: [] };
    const muted = this.props.mutedUntil !== undefined ? !!this.props.mutedUntil : !!this.state.mutedUntil;
    const fav = this.props.isFavourite ?? !!this.state.fav;
    const everyoneMuted = this.props.muteEveryone !== undefined ? !!this.props.muteEveryone : !!this.state.muteAll;
    // activity fixture until presence is wired: the first few people are typing / active
    const ACT = ["typing", "now", "2m", "6m"];
    const others = c.members.filter(m => m.tag !== "YOU");
    const total = Number(this.props.memberTotal ?? c.memberTotal ?? others.length) || others.length;
    const onlineN = this.props.onlineCount ?? Math.min(Math.max(others.length - 2, 0), Math.max(Math.round(total / 4), 1));
    const shown = others.slice(0, Math.min(24, Math.max(onlineN, 0)));
    const recent = onlineN === 0 ? others.slice(0, 3) : [];
    const rows = (shown.length ? shown : recent).map((m, i) => Object.assign({}, m, {
      online: onlineN > 0, activity: onlineN > 0 ? (ACT[i] || "") : ["1h", "3h", "1d"][i] || "",
      onOpen: c.openUser(m) }));
    const isPublic = !!this.props.isPublic;
    const access = c.scope === "channel" ? "" : (isPublic ? "Public " : "Private ") + c.noun.toLowerCase() + " · ";
    const on = "var(--accent-bright,#FF8298)";
    return {
      notQuick: false,
      // the online list fills down to the panel edge, so only the body's own padding remains
      mainPadBottom: "0px",
      showFavHeart: false,
      avatarSize: "104px", avatarLift: "-52px", avatarGap: "var(--space-6)", identityPadBottom: "var(--space-26)",
      showQuickByline: c.scope !== "channel", showFullByline: false,
      quickByline: access + "created by",
      // channels state their access the same way groups do, ahead of the community link
      channelIn: (isPublic ? "Public" : "Private") + " channel in",
      onlineTitle: onlineN > 0 ? "Online now" : "Members",
      onlineCountLabel: onlineN > 0 ? "· " + onlineN : "",
      onlineOf: onlineN > 0 ? "of " + total.toLocaleString("en-US") : "",
      onlineRows: rows, noneOnline: onlineN === 0,
      hasMoreOnline: onlineN > shown.length,
      moreOnlineLabel: "+ " + (onlineN - shown.length).toLocaleString("en-US") + " more online",
      viewAllMembersLabel: "View all " + total.toLocaleString("en-US"),
      hasBotsSlim: c.bots.filter(b => b.variant !== "webhook").length > 0,
      botStack: c.bots.filter(b => b.variant !== "webhook").slice(0, 3).map(b => ({ gradient: GRADIENTS[b.color] || GRADIENTS.violet })),
      botNames: c.bots.filter(b => b.variant !== "webhook").slice(0, 3).map(b => b.title).join(", "),
      mutePillLabel: muted ? "Muted" : "Mute",
      muteTitle: muted ? "Unmute notifications" : "Mute notifications",
      mutePillMask: muted ? QUICK_MASKS.bellOff : QUICK_MASKS.bell,
      mutePillBg: muted ? "var(--accent-soft,rgba(255,86,114,.1))" : "transparent",
      mutePillLine: muted ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
      mutePillInk: muted ? on : "var(--ink-2,#C9C9D4)",
      caretMask: QUICK_MASKS.caret,
      canFavPill: !!this.props.onToggleFavourite,
      favPillLabel: fav ? "Favourited" : "Favourite",
      favPillMask: QUICK_MASKS.heart,
      favPillBg: fav ? "var(--accent-soft,rgba(255,86,114,.1))" : "transparent",
      favPillLine: fav ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
      favPillInk: fav ? on : "var(--ink-2,#C9C9D4)",
      // @everyone is its own toggle: it silences mass mentions, not notifications
      everyoneOn: everyoneMuted,
      everyoneTitle: everyoneMuted ? "@everyone mentions are muted. Click to allow them" : "Mute @everyone mentions",
      everyoneMask: everyoneMuted ? QUICK_MASKS.atOff : QUICK_MASKS.at,
      everyoneBg: everyoneMuted ? "var(--accent-soft,rgba(255,86,114,.1))" : "transparent",
      everyoneLine: everyoneMuted ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
      everyoneInk: everyoneMuted ? on : "var(--ink-2,#C9C9D4)",
      onEveryonePill: () => { this.setState({ muteAll: !everyoneMuted }); if (this.props.onMuteEveryoneChange) this.props.onMuteEveryoneChange(!everyoneMuted); },
      onFavPill: () => { if (this.props.onToggleFavourite) this.props.onToggleFavourite(); },
    };
  }

  _openSettings() {
    if (this.props.onDialog && this._settingsPayload) this.props.onDialog("settings", this._settingsPayload(), "group");
  }

  _go(view) {
    // the quick panel never drills in; deeper views live in the host's manage dialog
    // pinned is reading, not managing, so it opens inside the quick panel
    if (this.props.quick && view !== "main" && view !== "pinned") { this.setState({ menu: false }); if (this.props.onManage) this.props.onManage(view); return; }
    this.setState({ view, menu: false });
    if (this.props.onViewChange) this.props.onViewChange(view);
    const key = this._storeKey();
    if (key) { try { localStorage.setItem(key, view); } catch (e) {} }
  }

  componentDidUpdate(prev) {
    if (prev.about !== this.props.about && this.state.aboutOpen) this.setState({ aboutOpen: false });
    this._measureAbout();
    const req = this.props.viewRequest;
    if (req && req !== prev.viewRequest) {
      const target = String(req).split("#")[0];
      if (target === "main" || SUBVIEWS[target]) this._go(target);
      else if (target === "settings") this._openSettings();
    }
  }

  renderVals() { const __v = this._vals(); __v.membersLoading = !!this.props.membersLoading; __v.membersShown = __v.membersLoading ? [] : __v.onlineRows; return __v; }
  _vals() {
    const view = this.props.quick && this.state.view !== "pinned" ? "main" : this.state.view;
    const canModerate = this.props.canModerate ?? true;
    const memberTabIdx = canModerate ? (this.state.memberTab ?? 0) : 0;
    const scope = this.props.scope ?? "group";
    const embedded = !!this.props.embedded, quick = !!this.props.quick;
    const noun = scope === "community" ? "Community" : scope === "channel" ? "Channel" : "Group";
    const ugAll = this.props.userGroups ?? USER_GROUPS.map((g, i) => ({ key: "ug" + i, title: g.title, color: g.color, members: [] }));
    const ugQ = this.state.ugQuery ?? "", ugMQ = this.state.ugMemberQuery ?? "";
    const ugShown = ugAll.filter(g => !ugQ.trim() || g.title.toLowerCase().indexOf(ugQ.trim().toLowerCase()) >= 0);
    const ugCur = ugAll.find(g => g.key === this.state.ugKey) || null;
    const ugOpen = g => () => this.setState({ ugKey: g.key, ugMemberQuery: "", ugMenu: null }, () => this._go("usergroup"));
    const ugRow = g => ({ title: g.title, color: g.color || "slate", subtitle: g.members.length === 1 ? "1 member" : g.members.length + " members", open: ugOpen(g) });
    const ugDialog = (dialogMode, key) => { if (this.props.onDialog) this.props.onDialog("usergroup", { dialogMode, key }); };
    const ugMembersShown = ugCur ? ugCur.members.filter(m => !ugMQ.trim() || (m.name + " " + m.handle).toLowerCase().indexOf(ugMQ.trim().toLowerCase()) >= 0)
      .map(m => Object.assign({}, m, { open: () => { if (this.props.onDialog) this.props.onDialog("user", { title: m.name, handle: m.handle, color: m.color }); } })) : [];
    const perms = this.props.permissions ?? PERM_FALLBACK();
    const infoValue = {
      name: this.props.title ?? "",
      about: this.props.about ?? "",
      color: this.props.color ?? "teal",
      coverKey: this.props.coverKey ?? "plum",
      avatar: this.props.avatar ?? "",
    };
    const gateState = this.props.gateState ?? GATE_FIXTURE();
    const gateList = (gateState.rules || []).map(r => ({ type: r.type, value: gateValue(r) }));
    // rules arrive as free text; the subview splits it into numbered lines
    const rulesValue = this.props.rules ?? RULES_FIXTURE();
    const ruleLines = rulesValue.enabled
      ? String(rulesValue.text || "").split("\n").map(l => l.replace(/^[•\-\s]+/, "").trim()).filter(Boolean)
      : [];
    const threadExceptions = perms.threads
      ? PERM_CONTENT.filter(c => perms.threads[c.key] !== PERM_INHERIT).length
      : 0;
    // an explicitly passed empty list is a real answer — never fall back to fixtures
    const members = this.props.members != null ? this.props.members : MEMBERS;
    const lapsed = this.props.lapsed != null ? this.props.lapsed : LAPSED;
    const blockedGone = (this.state.unblocked || []).concat(this.state.removedBlocked || []);
    const blocked = (this.props.blocked != null ? this.props.blocked : BLOCKED).filter(m => blockedGone.indexOf(m.handle) === -1);
    const gateCount = this.props.gateCount ?? gateList.length;
    const ruleCount = ruleLines.length;
    const youFirst = list => {
      const i = list.findIndex(m => m.tag === "YOU");
      return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
    };
    const roles = this.state.roles || {}, gone = this.state.removedMembers || [];
    const withRole = list => list.filter(m => gone.indexOf(m.handle) === -1).map(m => roles[m.handle] != null ? Object.assign({}, m, { tag: roles[m.handle] }) : m);
    const MEMBER_SETS = [youFirst(withRole(members)), youFirst(withRole(lapsed)), youFirst(blocked)];
    const baseBots = this.props.bots != null ? this.props.bots : BOTS;
    // saving permissions on an already-installed bot reports it again — keep one row per bot
    const removedBots = this.props.removedBots ?? [];
    const installedBots = baseBots.concat((this.props.extraBots ?? []).filter(e => !baseBots.some(b => b.title === e.title))).filter(b => removedBots.indexOf(b.title) === -1);
    const baseHooks = this.props.webhooks != null ? this.props.webhooks : WEBHOOKS;
    const hooks = baseHooks.concat((this.props.extraWebhooks ?? []).filter(e => !baseHooks.some(h => h.title === e.title)));
    // people who can't manage bots only see what's installed: no webhooks, no recommendations
    const canManageBots = this.props.canManageBots ?? true;
    // botsPart: the manage dialog shows bots and webhooks as separate sections
    const botsPart = this.props.botsPart || "";
    const allowHooks = (this.props.scope ?? "group") !== "community" && canManageBots && botsPart !== "bots";
    const showBotLists = botsPart !== "webhooks";
    const bots = allowHooks ? installedBots.concat(hooks) : installedBots;
    const botQuery = this.state.botQuery ?? "";
    const q = botQuery.trim().toLowerCase();
    const matches = x => !q || (x.title + " " + (x.subtitle || "")).toLowerCase().indexOf(q) >= 0;
    const openUser = m => () => { if (this.props.onDialog) this.props.onDialog("user", { title: m.title, handle: m.handle, color: m.color, isSelf: m.tag === "YOU" }); };
    const openBot = (b, installed) => () => { if (this.props.onDialog) this.props.onDialog("bot", { name: b.title, description: b.subtitle, color: b.color, installed }); };
    const urlOf = h => (this.props.webhookUrls && this.props.webhookUrls[h.title]) || h.url;
    const openHook = h => () => { if (this.props.onDialog) this.props.onDialog("webhook", { dialogMode: "edit", name: h.title, color: h.color, url: urlOf(h), avatarUrl: h.image }); };
    const shownBots = installedBots.filter(matches).map(b => Object.assign({}, b, { onOpen: openBot(b, true) }));
    const shownHooks = (allowHooks ? hooks : []).filter(matches).map(h => Object.assign({}, h, { onOpen: openHook(h) }));
    const shownRecommended = RECOMMENDED
      .filter(r => !installedBots.some(b => b.title === r.title))
      .filter(matches)
      .map(b => Object.assign({}, b, { onOpen: openBot(b, false) }));
    const memberTotal = this.props.memberTotal ?? (this.props.members && this.props.members.length) ?? 18;
    const disappearOn = this.props.disappearOn ?? true;
    const disappearAfter = this.props.disappearAfter || "12 hours";
    // host-controlled when given, so the kebab menu and these tiles share one state
    const mutedUntil = this.props.mutedUntil !== undefined ? this.props.mutedUntil : (this.state.mutedUntil ?? null);
    const muted = !!mutedUntil;
    const muteSpan = MUTE_SPANS.find(o => o.key === mutedUntil);
    const muteLabel = muted ? (muteSpan && muteSpan.tile ? muteSpan.tile : "Muted") : "Mute";
    const muteAll = this.props.muteEveryone !== undefined ? !!this.props.muteEveryone : (this.state.muteAll ?? false);
    const settingsPayload = () => ({
      info: infoValue,
      settings: settingsValue,
      gates: gateState,
      rules: rulesValue,
      permissions: perms,
    });
    this._settingsPayload = settingsPayload;
    const settingsValue = {
      isPublic: this.props.isPublic ?? false,
      history: this.props.visibleHistory ?? true,
      disappearOn,
      after: disappearAfter,
    };

    // role split reads at a glance; the raw total lives in "View all"
    const owners = members.filter(m => m.tag === "OWNER").length || 1;
    const admins = members.filter(m => m.tag === "ADMIN").length;
    const rest = Math.max(memberTotal - owners - admins, 0);
    const roleSummary = owners + " owner · " + admins + " admins · " + rest + " members";

    // the most-asked question first ("can members invite?"), then how far the set
    // has been tuned — a description of the feature told the reader nothing
    const permChanged = PERM_GENERAL.filter(x => perms.general[x.key] !== x.def).length
      + PERM_CONTENT.filter(c => perms.messages[c.key] !== PERM_INHERIT).length
      + (perms.messages.default !== "member" ? 1 : 0)
      + (perms.threads ? 1 : 0);
    const inviteRole = PERM_ROLES.find(r => r.key === perms.general.invite);
    const permHint = (perms.general.invite === "member"
      ? "Members can invite"
      : perms.general.invite === "nobody"
        ? "Nobody can invite"
        : (inviteRole ? inviteRole.label : "Admin") + " can invite")
      + " · " + (permChanged ? permChanged + " changed from defaults" : "defaults everywhere");

    const subviewMeta = "";

    const isFav = !!this.props.isFavourite;
    const coverMode = (this.props.mode ?? "dark") === "light" ? "light" : "dark";
    // the fixture description only stands in when the host passes nothing at all
    const aboutText = this.props.about !== undefined
      ? this.props.about
      : "Where product and design argue about spacing, then ship anyway. Notes, decisions and the occasional voice note at midnight.";

    return {
      awayRef: this._awayRef,
      // an uploaded cover image wins over the swatch
      cover: this.props.coverUrl ? "url(" + this.props.coverUrl + ") center/cover no-repeat" : this.props.coverKey
        ? "var(--cover-" + (COVERS[this.props.coverKey] ? this.props.coverKey : "plum") + ")"
        : (this.props.cover || "var(--cover-plum)"),
      coverActions: ["close"],
      // quick panel: kebab + cog (info for non-managers) instead of invite/share, which move into the body
      coverTrailActions: quick ? [this.props.manageIcon || "manage", "more"] : ["invite", "share", "more"],
      coverHandlers: Object.assign({}, this.props.coverHandlers ?? {}, {
        more: () => this.setState({ menu: !this.state.menu }),
        manage: () => { if (this.props.onManage) this.props.onManage("main"); },
        info: () => { if (this.props.onManage) this.props.onManage("main"); },
        invite: () => { if (this.props.onDialog) this.props.onDialog("invite", null, "people"); },
        share: () => { if (this.props.onDialog) this.props.onDialog("invite", null, "share"); },
      }),
      avatarGradient: GRADIENTS[this.props.color ?? "teal"] ?? GRADIENTS.teal,
      title: (scope === "channel" ? "#" : "") + (this.props.title ?? "The Awesome Group"),
      avatarRadius: scope === "channel" ? "50%" : "24px",
      isChannelScope: scope === "channel",
      notChannelScope: scope !== "channel",
      isCommunityScope: scope === "community",
      // the quick panel states access in the byline, so the card is only for the full panel
      showAccessCard: !quick && (scope === "community" || scope === "channel"),
      // the quick panel puts the community in a chip on the byline instead
      showCommunityCard: !quick && scope === "channel",
      accessTitle: (this.props.isPublic ? "Public " : "Private ") + (scope === "channel" ? "channel" : "community"),
      accessBody: scope === "channel"
        ? (this.props.isPublic ? "Anyone in " + (this.props.communityName ?? "the community") + " can find and join it." : "Only people added or invited can join, even though the community may be public.")
        : (this.props.isPublic ? "Anyone can find and join. Individual channels can still be private." : "Only people you invite can join, and it won’t appear in search."),
      accessMask: this.props.isPublic
        ? "var(--icon-globe) center/contain no-repeat"
        : "var(--icon-lock) center/contain no-repeat",
      bylineNoun: noun.toLowerCase(),
      communityName: this.props.communityName ?? "OpenChat",
      communityGradient: GRADIENTS[this.props.communityColor ?? "amber"] ?? GRADIENTS.amber,
      openCommunity: e => { if (e && e.preventDefault) e.preventDefault(); if (this.props.onOpenCommunity) this.props.onOpenCommunity(); },
      chevMask: CHEV_MASK,
      membersLabel: scope === "group" ? "MEMBERS" : noun.toUpperCase() + " MEMBERS",
      userGroupPreview: ugAll.slice(0, 2).map(ugRow),
      userGroupTotal: ugAll.length,
      userGroupRows: ugShown.map(g => Object.assign(ugRow(g), {
        menuOpen: this.state.ugMenu === g.key,
        toggleMenu: e => { if (e && e.stopPropagation) e.stopPropagation(); this.setState(x => ({ ugMenu: x.ugMenu === g.key ? null : g.key })); },
        menuItems: [
          { label: "Edit", mask: EDIT_MASK, onSelect: () => { this.setState({ ugMenu: null }); ugDialog("edit", g.key); } },
          { label: "Delete", mask: "var(--icon-trash) center/contain no-repeat", variant: "danger", onSelect: () => { this.setState({ ugMenu: null }); ugDialog("delete", g.key); } },
        ],
      })),
      closeUgMenu: () => this.setState({ ugMenu: null }),
      noUgMatches: ugShown.length === 0,
      ugEmptyText: ugAll.length ? "No user groups match “" + ugQ + "”" : "No user groups yet. Create one with +.",
      ugQuery: ugQ, onUgQuery: e => this.setState({ ugQuery: e.target.value }), clearUgQuery: () => this.setState({ ugQuery: "" }),
      newUserGroup: () => ugDialog("create", null),
      editUserGroup: () => ugCur && ugDialog("edit", ugCur.key),
      isUserGroupView: view === "usergroup" && !!ugCur,
      ugMemberTotal: ugCur ? ugCur.members.length : 0,
      ugMention: ugCur ? "@" + ugCur.title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") : "",
      ugMembers: ugMembersShown,
      noUgMemberMatches: !!ugCur && ugMembersShown.length === 0 && !!ugMQ,
      ugMemberQuery: ugMQ, onUgMemberQuery: e => this.setState({ ugMemberQuery: e.target.value }), clearUgMemberQuery: () => this.setState({ ugMemberQuery: "" }),
      goUserGroups: e => { if (e && e.preventDefault) e.preventDefault(); this._go("usergroups"); },
      isUserGroupsView: view === "usergroups" || (view === "usergroup" && !ugCur),
      ownerHandle: this.props.ownerHandle ?? "@jane_smith",
      membersMask: MEMBERS_MASK,
      backMask: BACK_MASK,
      roleSummary,
      memberTotal,
      about: aboutText || "No description yet",
      aboutInk: aboutText ? "var(--ink-2,#C9C9D4)" : "var(--ink-4,#7C7C8C)",
      aboutRef: this._aboutRef,
      aboutClamp: this.state.aboutOpen ? "unset" : quick ? "2" : "4",
      aboutCanToggle: !!this.state.aboutLong,
      aboutToggleLabel: this.state.aboutOpen ? (quick ? "Less" : "Show less") : (quick ? "More" : "Show more"),
      toggleAbout: () => this.setState(x => ({ aboutOpen: !x.aboutOpen })),

      isMain: view === "main",
      isSubview: view !== "main",
      subviewTitle: view === "bots" && botsPart === "webhooks" ? "Webhooks" : view === "usergroup" && ugCur ? ugCur.title : view === "members" && scope !== "group" ? noun + " members" : (view === "bots" && !allowHooks ? SUBVIEWS.botsOnly : SUBVIEWS[view] ?? "").replace(/^Group\b/, noun),
      subviewMeta,
      hasSubviewMeta: !!subviewMeta,
      subviewSub: view === "usergroup" && ugCur ? "User group in " + (this.props.title ?? "") : view === "members" && scope === "channel" ? "#" + (this.props.title ?? "") + " in " + (this.props.communityName ?? "") : "",
      hasSubviewSub: (view === "usergroup" && !!ugCur) || (view === "members" && scope === "channel"),
      goBack: () => this._go(view === "usergroup" ? "usergroups" : "main"),

      editMask: EDIT_MASK,
      isMembersView: view === "members",
      memberTabs: MEMBER_TABS,
      // lapsed and blocked lists are moderation tools; regular members only see current members
      showMemberTabs: canModerate,
      memberSearchPad: canModerate ? "0" : "var(--space-6)",
      memberDots: lapsed.length ? [1] : [],
      memberTab: memberTabIdx,
      memberSearchPlaceholder: "Search " + MEMBER_TABS[memberTabIdx].toLowerCase(),
      memberList: MEMBER_SETS[memberTabIdx].map((m, mi, all) => {
        const blockedRow = (memberTabIdx) === 2;
        const key = "m:" + m.handle;
        // role ladder: member → moderator → admin → owner; your own row has no menu
        const LADDER = ["", "MODERATOR", "ADMIN", "OWNER"];
        const viewerIsOwner = String(this.props.viewerRole || "Owner").toUpperCase() === "OWNER";
        const ownersOther = MEMBER_SETS[0].filter(x => x.tag === "OWNER").length;
        const NAMES = { "": "member", MODERATOR: "moderator", ADMIN: "admin", OWNER: "owner" };
        const rank = LADDER.indexOf(m.tag === "LAPSED" ? "" : (m.tag || ""));
        // regular members can't change roles or remove anyone, so their rows have no menu
        // moderators can remove regular members but can't change roles or act on other staff
        const canRoles = this.props.canChangeRoles ?? true;
        // owners are only managed by owners; an owner can step down only once someone else is an owner
        const isSelf = m.tag === "YOU";
        const hasMenu = blockedRow ? canModerate
          : isSelf ? viewerIsOwner
          : rank === 3 ? viewerIsOwner
          : canModerate && rank >= 0 && (canRoles || rank === 0);
        const setRole = r => isSelf
          ? this.setState({ ugMenu: null, selfRole: r })
          : this.setState(x => ({ ugMenu: null, roles: Object.assign({}, x.roles || {}, { [m.handle]: r }) }));
        const current = isSelf ? (this.state.selfRole ?? String(this.props.viewerRole || "Owner").toUpperCase().replace("MEMBER", "")) : (LADDER[rank] ?? "");
        const soleOwner = isSelf && current === "OWNER" && ownersOther === 0;
        const roleItems = blockedRow || !canRoles ? [] : LADDER.slice().reverse().filter(r => r !== "OWNER" || viewerIsOwner).map(r => ({
          label: NAMES[r].charAt(0).toUpperCase() + NAMES[r].slice(1),
          checkMask: r === current ? "var(--icon-check) center/contain no-repeat" : "",
          onSelect: () => {
            if (r === current) return this.setState({ ugMenu: null });
            if (r === "OWNER") return this.setState({ ugMenu: "owner:" + m.handle });
            setRole(r);
          },
        })).concat([{ variant: "separator", label: "" }]);
        const selfTag = isSelf ? ({ OWNER: "OWNER", ADMIN: "ADMIN", MODERATOR: "MODERATOR" })[this.state.selfRole ?? String(this.props.viewerRole || "Owner").toUpperCase()] || "" : null;
        // current members show presence like the side panel: online people first, with activity
        const others = all.filter(x => x.tag !== "YOU");
        const oi = others.indexOf(m);
        const tot = Number(memberTotal) || others.length;
        const onN = memberTabIdx === 0 ? Math.min(Math.max(others.length - 2, 0), Math.max(Math.round(tot / 4), 1)) : 0;
        const isOn = !isSelf && oi >= 0 && oi < onN;
        return Object.assign({}, m, {
          tag: isSelf ? selfTag : m.tag,
          isYou: isSelf,
          online: isOn || (isSelf && memberTabIdx === 0),
          activity: isOn ? (["typing", "now", "2m", "6m"][oi] || "") : "",
          onOpen: openUser(m),
          hasMenu,
          menuOpen: hasMenu && this.state.ugMenu === key,
          soleAsk: this.state.ugMenu === "sole:" + m.handle,
          menuHeading: blockedRow || !canRoles ? "" : isSelf ? "YOUR ROLE" : "ROLE",
          ownerAsk: this.state.ugMenu === "owner:" + m.handle,
          confirmOwner: () => setRole("OWNER"),
          toggleMenu: hasMenu ? (e => { if (e && e.stopPropagation) e.stopPropagation(); const k = soleOwner ? "sole:" + m.handle : key; this.setState(x => ({ ugMenu: x.ugMenu === k ? null : k })); }) : undefined,
          menuItems: isSelf ? roleItems.filter(it => it.variant !== "separator") : !blockedRow ? roleItems.concat([
            { label: "Remove member", mask: "var(--icon-user-minus) center/contain no-repeat", variant: "danger", onSelect: () => this.setState(x => ({ ugMenu: null, removedMembers: (x.removedMembers || []).concat([m.handle]) })) },
          ]) : [
            { label: "Unblock", mask: "var(--icon-circle-check) center/contain no-repeat", onSelect: () => this.setState(x => ({ ugMenu: null, unblocked: (x.unblocked || []).concat([m.handle]) })) },
            { label: "Remove", mask: "var(--icon-user-minus) center/contain no-repeat", variant: "danger", onSelect: () => this.setState(x => ({ ugMenu: null, removedBlocked: (x.removedBlocked || []).concat([m.handle]) })) },
          ],
        });
      }),
      memberListTitle: MEMBER_LIST_TITLES[memberTabIdx] + " members · " + [memberTotal, lapsed.length, blocked.length][memberTabIdx],
      memberNote: MEMBER_NOTES[memberTabIdx],
      hasMemberNote: !!MEMBER_NOTES[memberTabIdx],
      setMemberTab: i => this.setState({ memberTab: i }),
      nounLower: noun.toLowerCase(),
      showCommMembersBanner: scope === "channel" && (memberTabIdx) === 0,
      openCommMembers: () => { if (this.props.onOpenCommunity) this.props.onOpenCommunity("members"); },
      isBotsView: view === "bots",
      isPermissionsView: view === "permissions",
      plusMask: "var(--icon-plus) center/contain no-repeat",
      // each role lists what IT adds; the trailing chip carries the inheritance,
      // so no fraction can imply a senior role is missing something
      roleDigest: PERM_ROLES.filter(r => r.key !== "nobody").map((r, ri) => {
        const own = PERM_GENERAL.filter(p => perms.general[p.key] === r.key).map(p => p.short)
          .concat(PERM_CONTENT.filter(c => {
            const eff = perms.messages[c.key] === PERM_INHERIT ? perms.messages.default : perms.messages[c.key];
            return eff === r.key;
          }).map(c => c.label));
        return {
          label: r.label.toUpperCase(),
          tint: r.tint,
          caps: own.map(label => ({
            label,
            wash: "color-mix(in srgb, " + r.tint + " 12%, transparent)",
            line: "color-mix(in srgb, " + r.tint + " 30%, transparent)",
          })),
          none: own.length === 0 && ri === 0,
          inherits: ri > 0,
          inheritsLabel: ri > 0 ? "Everything " + PERM_ROLES[ri - 1].label.replace(/s$/, "").toLowerCase() + " can do" : "",
        };
      }),
      // anything set to Nobody belongs to no role, so it gets its own line
      disabledPerms: PERM_GENERAL.filter(p => perms.general[p.key] === "nobody").map(p => ({ label: p.short }))
        .concat(PERM_CONTENT.filter(c => {
          const eff = perms.messages[c.key] === PERM_INHERIT ? perms.messages.default : perms.messages[c.key];
          return eff === "nobody";
        }).map(c => ({ label: c.label }))),
      hasDisabledPerms: PERM_GENERAL.some(p => perms.general[p.key] === "nobody")
        || PERM_CONTENT.some(c => (perms.messages[c.key] === PERM_INHERIT ? perms.messages.default : perms.messages[c.key]) === "nobody"),
      threadPermLine: perms.threads
        ? (threadExceptions ? threadExceptions + (threadExceptions === 1 ? " exception" : " exceptions") + " set for threads" : "Threads use their own set.")
        : "Threads follow the message permissions.",
      isFav,
      heartFilled: HEART_FILLED,
      isGatesView: view === "gates",
      clockMask: CLOCK_MASK,
      hasGates: gateList.length > 0,
      noGates: gateList.length === 0,
      gateJoinerLabel: (gateState.joiner ?? "All") === "All" ? "ALL OF THESE" : "ANY ONE OF THESE",
      recheckLine: gateState.intervalOn === false
        ? "Members are checked when they join, and not re-checked after that."
        : "Members are re-checked every " + (gateState.every ?? "90 days") + ". Anyone who no longer qualifies is moved to Lapsed.",
      gateCards: gateList.map(g => {
        const t = GATE_TYPES[g.type] || GATE_TYPES.locked;
        return {
          label: g.label ?? t.label,
          detail: g.value ?? "",
          hasDetail: !!g.value,
          mask: GATE_ICONS[t.icon] || GATE_ICONS.person,
          tint: t.tint,
          wash: "color-mix(in srgb, " + t.tint + " 14%, transparent)",
        };
      }),
      isDiamond: this.props.isDiamond ?? true,
      isRulesView: view === "rules",
      hasRules: ruleLines.length > 0,
      noRules: ruleLines.length === 0,
      rules: ruleLines.map((text, i) => ({ n: (i + 1) + ".", text })),
      isStatsView: view === "stats",
      isPinnedView: view === "pinned",
      ...(() => {
        const pins = this.props.pinned || [];
        const days = [];
        pins.forEach(p => { let d = days.find(x => x.date === p.date); if (!d) days.push(d = { date: p.date, items: [] });
          d.items.push(Object.assign({}, p, { messages: [{ text: p.text || "", code: p.code || "", time: p.time }] })); });
        return { pinnedGroups: days, noPinned: pins.length === 0, pinnedCount: String(pins.length), showPinnedRow: false };
      })(),
      goPinned: () => this._go("pinned"),
      pinMask: "var(--icon-pin) center/contain no-repeat",
      pinChevMask: "var(--icon-chevron-right) center/contain no-repeat",

      goMembers: () => this._go("members"),
      goBots: () => this._go("bots"),
      // kept for hosts that surface their own invite affordance
      onInvite: () => { if (this.props.onDialog) this.props.onDialog("invite", null, "people"); },
      // notification prefs are instant-apply toggles, so they sit with the other
      // live actions rather than behind a form
      tileColumns: scope === "community" ? 2 : 3,
      tiles: [
        ...(scope === "community" ? [] : ["video"]),
        { icon: "mute", label: scope === "community" && !muted ? "Mute all channels" : muteLabel, on: muted },
        { icon: "everyone", label: muteAll ? "@everyone muted" : "Mute @everyone", on: muteAll },
      ],
      tileHandlers: Object.assign({}, this.props.tileHandlers ?? {}, {
        // muting is reversible, so no confirmation — but it asks for how long,
        // which makes an accidental tap cost hours rather than forever
        mute: e => {
          if (!muted) {
            const tile = e && e.currentTarget;
            const root = tile && tile.closest('[data-panel-root]');
            if (tile && root) {
              const r = tile.getBoundingClientRect(), b = root.getBoundingClientRect();
              this.setState({ muteMenu: { top: (r.bottom - b.top + 6) + "px", left: Math.max(16, Math.min(r.left - b.left, b.width - 232)) + "px" } });
            } else {
              this.setState({ muteMenu: { top: "212px", left: "16px" } });
            }
            return;
          }
          this.setState({ mutedUntil: null });
          if (this.props.onMuteChange) this.props.onMuteChange(null);
        },
        everyone: () => { this.setState({ muteAll: !muteAll }); if (this.props.onMuteEveryoneChange) this.props.onMuteEveryoneChange(!muteAll); },
      }),
      // the pill always opens the menu: durations, @everyone, and Unmute when muted
      onMutePill: e => {
        const el = e && e.currentTarget, root = el && el.closest('[data-panel-root]');
        if (el && root) { const r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
          this.setState({ muteMenu: { top: (r.bottom - b.top + 6) + "px", left: Math.max(16, Math.min(r.left - b.left, b.width - 232)) + "px" } }); }
      },
      muteMenuOpen: !!this.state.muteMenu,
      muteMenuTop: (this.state.muteMenu || {}).top || "0px",
      muteMenuLeft: (this.state.muteMenu || {}).left || "0px",
      closeMuteMenu: () => this.setState({ muteMenu: null }),
      onMainScroll: () => { if (this.state.muteMenu) this.setState({ muteMenu: null }); },
      muteOptions: (muted && quick ? [{ label: "Unmute notifications", onSelect: () => { this.setState({ muteMenu: null, mutedUntil: null }); if (this.props.onMuteChange) this.props.onMuteChange(null); } }, { variant: "separator", label: "" }] : [])
        .concat(muted && quick ? [] : MUTE_SPANS.map(o => ({
        label: o.label,
        onSelect: () => {
          this.setState({ muteMenu: null, mutedUntil: o.key });
          if (this.props.onMuteChange) this.props.onMuteChange(o.key);
        },
      }))),

      members,
      memberPreview: members.slice(0, bots.length ? 3 : 5).map(m => Object.assign({}, m, { onOpen: openUser(m) })),
      bots,
      installedBots: shownBots,
      webhooks: shownHooks,
      allowWebhooks: allowHooks,
      // in the manage dialog's Webhooks section the create action lives in the header, like New channel
      showHeaderRegister: embedded && botsPart === "webhooks" && allowHooks && view === "bots",
      showListRegister: !(embedded && botsPart === "webhooks"),
      noWebhooksYet: embedded && botsPart === "webhooks" && hooks.length === 0 && !q,
      registerWebhookLink: e => { if (e && e.preventDefault) e.preventDefault(); if (this.props.onDialog) this.props.onDialog("webhook", { dialogMode: "register" }); },
      botsSectionLabel: allowHooks ? "BOTS & WEBHOOKS" : "BOTS",
      botsSearchPlaceholder: !showBotLists ? "Search webhooks" : allowHooks ? "Search bots and webhooks" : "Search bots",
      recommended: shownRecommended,
      hasInstalledBots: shownBots.length > 0 && showBotLists,
      hasRecommended: shownRecommended.length > 0 && canManageBots && showBotLists,
      installedLabel: "INSTALLED BOTS · " + installedBots.length,
      webhooksLabel: "WEBHOOKS · " + hooks.length,
      recommendedLabel: "RECOMMENDED BOTS · " + shownRecommended.length,
      noBotMatches: !!q && (!showBotLists || shownBots.length === 0) && (!allowHooks || shownHooks.length === 0) && (!canManageBots || !showBotLists || shownRecommended.length === 0),
      noBotsInstalled: !canManageBots && !q && shownBots.length === 0,
      botQuery,
      onBotQuery: e => this.setState({ botQuery: e.target.value }),
      clearBotQuery: () => this.setState({ botQuery: "" }),
      registerWebhook: () => { if (this.props.onDialog) this.props.onDialog("webhook", { dialogMode: "register" }); },
      hookMask: "var(--icon-hook) center/contain no-repeat",
      botPreview: bots.slice(0, 2).map(b => Object.assign({}, b, {
        onOpen: b.variant === "webhook" ? openHook(b) : openBot(b, true),
      })),
      botTotal: bots.length,
      hasBots: bots.length > 0 && !embedded && !quick,
      rootRadius: embedded ? "0" : "var(--radius-2xl)",
      showMemberPreview: !embedded && !quick,
      showUserGroupPreview: scope === "community" && !embedded && !quick,
      showNavRows: !embedded && !quick,
      isQuick: quick,
      showInviteCard: quick && (this.props.canInvite ?? true),
      ...this._quickVals({ quick, members, bots, memberTotal, openUser, scope, noun }),
      inviteLinkText: this.props.inviteLink || ("oc.app/" + (scope === "channel" ? "c/" : "g/") + String(this.props.title || "group").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
      copyLabel: this.state.linkCopied ? "Copied" : "Copy",
      copyInk: this.state.linkCopied ? "var(--status-online,#2EE6A8)" : "var(--accent,#FF5672)",
      copyInviteLink: () => {
        const t = this.props.inviteLink || ("oc.app/" + (scope === "channel" ? "c/" : "g/") + String(this.props.title || "group").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        try { navigator.clipboard && navigator.clipboard.writeText("https://" + t); } catch (e) {}
        this.setState({ linkCopied: true }); clearTimeout(this._copyT); this._copyT = setTimeout(() => this.setState({ linkCopied: false }), 1600);
      },
      goInvitePeople: () => { if (this.props.onDialog) this.props.onDialog("invite", null, "people"); },
      linkMask: "var(--icon-link) center/contain no-repeat",
      invitePeopleMask: "var(--icon-invite) center/contain no-repeat",
      isEmbedded: embedded,
      // narrow windows open the pinned list on its own: close only, nothing to go back to
      showBack: (!embedded || view === "usergroup") && !(this.props.pinnedOnly && view === "pinned"),
      showSubClose: embedded || (!!this.props.pinnedOnly && view === "pinned"),
      onSubClose: () => { if (embedded) { if (this.props.onClose) this.props.onClose(); return; } this._go("main"); if (this.props.onClose) this.props.onClose(); },
      onEmbeddedClose: () => { if (this.props.onClose) this.props.onClose(); },
      manageLabel: this.props.manageLabel ?? "Manage " + noun.toLowerCase(),
      manageMask: "var(--icon-manage) center/contain no-repeat",
      onManagePress: () => { if (this.props.onManage) this.props.onManage("main"); },
      noBots: bots.length === 0,
      botMask: "var(--icon-bot) center/contain no-repeat",


      navRows: [
        { label: "Permissions", hint: permHint, value: "", highlight: false, onPress: () => this._go("permissions") },
        { label: "Access gates", hint: scope === "channel" && !gateCount ? "Community gates apply · none set for this channel" : gateCount ? gateCount + " gates · " + (gateState.intervalOn === false ? "checked once at join" : "re-checked every " + (gateState.every ?? "90 days")) : "No gates — anyone invited can join", value: "", highlight: false, onPress: () => this._go("gates") },
        { label: noun + " rules", hint: ruleCount ? ruleCount + " rules for members" : "No rules set yet", value: "", highlight: false, onPress: () => this._go("rules") },
      ],

      hasSubviewEdit: view === "permissions" || view === "gates" || view === "rules",
      // the sidebar is for reading; editing happens in a focused modal the HOST
      // renders — a container-type ancestor here would trap position:fixed
      onSubviewEdit: () => {
        if (!this.props.onDialog) return;
        // deep-link: the read view's edit button lands on its own tab
        if (view === "permissions" || view === "rules" || view === "gates") {
          this.props.onDialog("settings", settingsPayload(), view);
        }
      },
      hasSubviewShare: view === "members" && !embedded,
      goShare: () => { if (this.props.onDialog) this.props.onDialog("invite", null, "share"); },
      goAddMembers: () => { if (this.props.onDialog) this.props.onDialog("invite", null, "people"); },

      gateInterval: this.props.gateInterval ?? "90 days",
      statSlices: this.props.statSlices ?? [],
      statExtras: this.props.statExtras ?? [],

      menuOpen: this.state.menu,
      closeMenu: () => this.setState({ menu: false }),

      menuItems: this.props.menuOverride ? this.props.menuOverride.map(it => Object.assign({}, it, it.onSelect ? { onSelect: () => { this.setState({ menu: false }); it.onSelect(); } } : {})) : MENU_ITEMS
        .filter(it => scope === "group" || (it.action !== "convert" && it.action !== "import" && it.action !== "sep-after-bots"))
        .filter(it => scope !== "community" || (it.action !== "favourite" && it.action !== "webhook"))
        .reduce((acc, it) => acc.concat(scope === "community" && it.view === "stats" ? [it].concat(SCOPE_MENU_EXTRA) : [it]), [])
        .map(it => ({
        ...it,
        label: it.action === "favourite" ? (isFav ? "Remove from favourites" : "Add to favourites") : (it.action === "newusergroup" ? it.label : String(it.label).replace(/\bgroup\b/i, m => m[0] === "G" ? noun : noun.toLowerCase())),
        onSelect: it.view ? () => this._go(it.view)
          : it.action === "info" || it.action === "settings"
            ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog("settings", settingsPayload(), "group"); }
          : it.action === "favourite" ? () => { this.setState({ menu: false }); if (this.props.onToggleFavourite) this.props.onToggleFavourite(); }
          : it.action === "addbot" ? () => { this.setState({ menu: false }); this._go("bots"); }
          : it.action === "webhook" ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog("webhook", { dialogMode: "register" }); }
          : it.action === "convert" ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog("convert"); }
          : it.action === "delete" ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog("delete"); }
          : it.action === "import" ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog("import"); }
          : it.action === "newusergroup" ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog("usergroup", { dialogMode: "create", key: null }); }
          : it.action === "newchannel" || it.action === "embed" ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog(it.action); }
          : it.action === "leave" ? () => { this.setState({ menu: false }); if (this.props.onDialog) this.props.onDialog("leave"); }
          : () => this.setState({ menu: false }),
      })),
    };
  }
}

export default Component;

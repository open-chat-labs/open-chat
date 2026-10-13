// Logic for GroupSettingsDialog.svelte — carried over from lib/GroupSettingsDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const TABS = ["Group", "Gates", "Rules", "Permissions"];
const TAB_KEYS = ["group", "gates", "rules", "permissions"];
const NAME_MAX = 40;
const ABOUT_MAX = 500;
const RULES_MAX = 1000;

const GRADIENTS = {
  teal: { label: "Teal", value: "linear-gradient(140deg,#2EE6A8,#1FB6FF)" },
  violet: { label: "Violet", value: "linear-gradient(140deg,#ff5f9e,#6a2bff)" },
  amber: { label: "Amber", value: "linear-gradient(140deg,#ffb03d,#ff4d4d)" },
  blue: { label: "Blue", value: "linear-gradient(140deg,#5FA8FF,#8C6BFF)" },
};

const COVERS = {
  plum: { label: "Plum", dark: "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)", light: "repeating-linear-gradient(115deg,#E9E3F0 0 10px,#DED6E8 10px 20px)" },
  teal: { label: "Teal", dark: "linear-gradient(120deg,#0f3330,#143049)", light: "linear-gradient(120deg,#D8EFE8,#DCE9F4)" },
  violet: { label: "Violet", dark: "linear-gradient(120deg,#271a3c,#3b1e39)", light: "linear-gradient(120deg,#E3DAF5,#F1DCEC)" },
  amber: { label: "Amber", dark: "linear-gradient(120deg,#3a2716,#42301b)", light: "linear-gradient(120deg,#F7E7CE,#F2E3D2)" },
  slate: { label: "Slate", dark: "linear-gradient(120deg,#1a1c22,#24272f)", light: "linear-gradient(120deg,#E7E7EC,#DEDEE6)" },
};

const ABOUT_ICONS = {
  history: "var(--icon-history) center/contain no-repeat",
  hidden: "var(--icon-hidden) center/contain no-repeat",
  timer: "var(--icon-timer) center/contain no-repeat",
  lock: "var(--icon-lock) center/contain no-repeat",
  globe: "var(--icon-globe) center/contain no-repeat",
  rules: "var(--icon-rules) center/contain no-repeat",
  bell: "var(--icon-bell) center/contain no-repeat",
  bellOff: "var(--icon-bell-off) center/contain no-repeat",
  heart: "var(--icon-heart) center/contain no-repeat",
  chev: "var(--icon-chevron-right) center/contain no-repeat",
};

const RULE_TEMPLATES = [
  { key: "standard", label: "Community standard", desc: "Respect, no impersonation, stay on topic", rules: ["Do not impersonate others in a deceptive or misleading manner", "Do not intentionally share false or misleading information", "Keep messages relevant to the group"] },
  { key: "trading", label: "Trading group", desc: "No financial advice, no pump talk", rules: ["No financial advice — do your own research", "No coordinated pumping or shilling", "Disclose any position you hold in a token you post about"] },
  { key: "support", label: "Support group", desc: "Privacy and no self-promotion", rules: ["Do not share other members' private details", "No promotion or recruiting", "Assume good faith — disagree without insults"] },
  { key: "civil", label: "Keep it civil", desc: "Harassment and slur policy", rules: ["No harassment, slurs, or hate speech", "No sexually explicit content", "Take heated arguments to DMs"] },
  { key: "project", label: "Project team", desc: "Stay on task, decisions in writing", rules: ["Keep discussion to the work in hand", "Write decisions down so nobody has to scroll for them", "Use threads for side conversations"] },
  { key: "announce", label: "Announcements", desc: "Few posters, replies in threads", rules: ["Only owners and admins post to the main channel", "Reply in a thread rather than the channel", "No promotion of other groups or products"] },
];

const ROLES = [
  { key: "member", label: "Members" },
  { key: "moderator", label: "Moderator" },
  { key: "admin", label: "Admin" },
  { key: "owner", label: "Owner" },
  { key: "nobody", label: "Nobody" },
];
const VALUE_LABEL = { member: "Everyone", moderator: "Moderator +", admin: "Admin +", owner: "Owner only", nobody: "Nobody" };
const GENERAL = [
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
const PERM_GROUPS = ["Members", "Moderation"];
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
const roleIdx = k => ROLES.findIndex(r => r.key === k);

const DEFAULT_PERMS = () => {
  const o = { general: {}, messages: { default: "member" }, threads: { default: "member" } };
  GENERAL.forEach(p => (o.general[p.key] = p.def));
  CONTENT.forEach(c => { o.messages[c.key] = INHERIT; o.threads[c.key] = INHERIT; });
  return o;
};

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const v = props.value || {};
    const info = v.info || {};
    const set = v.settings || {};
    const rules = v.rules || {};
    const base = DEFAULT_PERMS();
    const perms = v.permissions || null;
    const draft = {
      name: info.name || "",
      about: info.about || "",
      color: info.color || "teal",
      coverKey: info.coverKey || "plum",
      coverUrl: info.coverUrl || null,
      avatar: info.avatar || "",
      isPublic: !!set.isPublic,
      history: set.history !== undefined ? !!set.history : true,
      disappearOn: !!set.disappearOn,
      after: set.after || "12 hours",
      gates: v.gates || null,
      rulesOn: rules.enabled !== undefined ? !!rules.enabled : !!(rules.text || "").trim(),
      rulesText: rules.text || "",
      perms: {
        general: { ...base.general, ...((perms && perms.general) || {}) },
        messages: { ...base.messages, ...((perms && perms.messages) || {}) },
        threads: { ...base.threads, ...((perms && perms.threads) || {}) },
      },
      threadsOverride: !!(perms && perms.threads),
    };
    const startTab = TAB_KEYS.indexOf(props.initialTab ?? "group");
    this.state = {
      ...draft,
      tab: startTab === -1 ? 0 : startTab,
      permSub: 0,
      permMenu: null,
      rulesPreset: null,
      touched: false,
      submitted: false,
      initial: JSON.stringify(draft),
    };
    this._avatar = React.createRef();
    this._coverInput = React.createRef();
  }

  _aboutVals(s, on) {
    if (!on) return { aboutActions: [], aboutFacts: [] };
    const noun = this.props.noun || "group";
    const muted = s.aboutMuted ?? !!this.props.isMuted;
    const fav = s.aboutFav ?? !!this.props.isFavourite;
    const act = (label, mask, active, onPress) => ({ label, mask, onPress,
      bg: active ? "var(--accent-soft,rgba(255,86,114,.1))" : "transparent",
      line: active ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
      ink: active ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)" });
    const actions = [act(muted ? "Muted" : "Mute", muted ? ABOUT_ICONS.bellOff : ABOUT_ICONS.bell, muted, () => {
      this.setState({ aboutMuted: !muted });
      if (this.props.onMuteChange) this.props.onMuteChange(muted ? null : "forever");
    })];
    if (this.props.onToggleFavourite) actions.push(act(fav ? "Favourited" : "Favourite", ABOUT_ICONS.heart, fav, () => {
      this.setState({ aboutFav: !fav });
      this.props.onToggleFavourite();
    }));
    const ruleCount = (s.rulesText || "").split("\n").map(l => l.trim()).filter(Boolean).length;
    const plain = (text, mask) => ({ text, mask, isLink: false, role: undefined, cursor: "default", hoverBg: "transparent", onPress: undefined });
    const facts = [
      s.history ? plain("New members can see chat history", ABOUT_ICONS.history) : plain("New members only see messages from when they join", ABOUT_ICONS.hidden),
      ...(s.disappearOn ? [plain("Messages disappear after " + s.after, ABOUT_ICONS.timer)] : []),
      s.isPublic ? plain("Public: anyone can find and join this " + noun, ABOUT_ICONS.globe) : plain("Private: people join by invite only", ABOUT_ICONS.lock),
      ...(ruleCount ? [{ text: ruleCount + (ruleCount === 1 ? " rule" : " rules") + (s.rulesOn ? " · new members must accept them" : ""), mask: ABOUT_ICONS.rules, isLink: true, role: "button",
        cursor: "pointer", hoverBg: "var(--overlay-1,rgba(255,255,255,.05))", onPress: () => this.props.onOpenRules && this.props.onOpenRules() }] : []),
    ].map((f, i) => ({ ...f, divider: i ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "0" }));
    return {
      aboutMeta: this.props.aboutMeta || "",
      roleLabel: this.props.roleLabel || "", hasRoleLabel: !!this.props.roleLabel,
      hasAbout: !!(s.about || "").trim(),
      nounLower: noun,
      aboutActions: actions, aboutFacts: facts,
      chevMask: ABOUT_ICONS.chev,
    };
  }

  componentDidUpdate() {
    // the host guards unsaved edits when the user leaves this form
    if (this.props.onDirtyChange && this._reportedDirty !== this._dirtyNow) { this._reportedDirty = this._dirtyNow; this.props.onDirtyChange(!!this._dirtyNow); }
    const m = this.state.permMenu, el = this._permPanel;
    if (!m || m.measured || !el) return;
    const H = el.offsetHeight, PAD = 12;
    const flip = window.innerHeight - m.anchorBottom - PAD < H && m.anchorTop - PAD >= H;
    const top = flip ? m.anchorTop - 6 - H : Math.min(m.anchorBottom + 6, window.innerHeight - PAD - H);
    this.setState({ permMenu: { ...m, measured: true, top: Math.max(PAD, top) + "px" } });
  }

  componentWillUnmount() {
    const started = (this.props.value || {}).info || {};
    if (this.state.avatar && this.state.avatar !== started.avatar) URL.revokeObjectURL(this.state.avatar);
  }

  _openPermMenu(scope, key, el, allowInherit) {
    const r = el.getBoundingClientRect(), W = 238, PAD = 12;
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

  _permsChanged() {
    const v = this.state.perms;
    let n = GENERAL.filter(p => v.general[p.key] !== p.def).length;
    if (v.messages.default !== "member") n++;
    n += CONTENT.filter(c => v.messages[c.key] !== INHERIT).length;
    if (this.state.threadsOverride) {
      n++;
      if (v.threads.default !== "member") n++;
      n += CONTENT.filter(c => v.threads[c.key] !== INHERIT).length;
    }
    return n;
  }

  _snapshot() {
    const s = this.state;
    return {
      name: s.name, about: s.about, color: s.color, coverKey: s.coverKey, coverUrl: s.coverUrl, avatar: s.avatar,
      isPublic: s.isPublic, history: s.history, disappearOn: s.disappearOn, after: s.after,
      gates: s.gates, rulesOn: s.rulesOn, rulesText: s.rulesText,
      perms: s.perms, threadsOverride: s.threadsOverride,
    };
  }

  renderVals() {
    const s = this.state;
    const mode = (this.props.mode ?? "dark") === "light" ? "light" : "dark";
    const nameOk = s.name.trim().length > 0;
    const rulesBad = s.rulesOn && !s.rulesText.trim();
    const dirty = JSON.stringify(this._snapshot()) !== s.initial;
    this._dirtyNow = dirty;
    const permsChanged = this._permsChanged();
    const gateCount = s.gates && Array.isArray(s.gates.rules) ? s.gates.rules.length : 0;
    const ruleLines = s.rulesOn
      ? s.rulesText.split("\n").map(l => l.replace(/^[•\-\s]+/, "").trim()).filter(Boolean).length
      : 0;
    const scope = s.permSub === 2 ? "threads" : "messages";
    const pm = s.permMenu;
    const ring = on => on
      ? "0 0 0 2px var(--surface-1,#0e0e12), 0 0 0 4px var(--accent,#FF5672)"
      : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.14))";
    const msgExceptions = CONTENT.filter(c => s.perms.messages[c.key] !== INHERIT).length;
    const thrExceptions = CONTENT.filter(c => s.perms.threads[c.key] !== INHERIT).length;

    const embedded = !!this.props.embedded;
    const readOnly = embedded && !!this.props.readOnly;
    // embedded: the host's nav picks the section, so the tab strip is hidden
    const tabIdx = embedded ? Math.max(0, TAB_KEYS.indexOf(this.props.section || "group")) : s.tab;
    const isCommunityNoun = (this.props.noun ?? "group") === "community";
    return {
      none: [],
      // embedded: the Overview page of the Manage dialog; its other tabs are their own nav items there
      isEmbedded: embedded, notEmbedded: !embedded,
      rootPos: embedded ? "absolute" : "fixed",
      rootPad: embedded ? "0" : "var(--space-22)",
      cardMax: embedded ? "none" : "780px",
      cardH: embedded ? "100%" : "min(740px,100%)",
      cardRadius: embedded ? "0" : "var(--radius-xl)",
      cardShadow: embedded ? "none" : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 30px 70px rgba(0,0,0,.45)",
      onClose: () => { if (this.props.onClose) this.props.onClose(); else if (this.props.onCancel) this.props.onCancel(); },
      isDiamond: this.props.isDiamond ?? true,
      groupName: ((this.props.value || {}).info || {}).name || "This group",
      gearMask: "var(--icon-gear) center/contain no-repeat",
      closeMask: "var(--icon-close) center/contain no-repeat",
      cameraMask: "var(--icon-camera) center/contain no-repeat",
      chevronMask: "var(--icon-chevron-down) center/contain no-repeat",
      checkMask: "var(--icon-check) center/contain no-repeat",

      tabLabels: TABS,
      tabCounts: [null, gateCount || null, ruleLines || null, permsChanged || null],
      tabDots: [
        !nameOk && s.submitted ? 0 : null,
        null,
        rulesBad && s.submitted ? 2 : null,
        null,
      ].filter(i => i !== null),
      tab: s.tab,
      onTab: i => this.setState({ tab: i, permMenu: null }),
      // view-only Overview is an About page, not a disabled form
      isAboutView: tabIdx === 0 && readOnly,
      isGroupTab: tabIdx === 0 && !readOnly,
      isGatesTab: tabIdx === 1,
      isRulesTab: tabIdx === 2,
      isPermsTab: tabIdx === 3,
      embeddedTitle: [readOnly ? "About" : "Overview", "Access gates", "Rules", "Permissions"][tabIdx],
      ...this._aboutVals(s, readOnly && tabIdx === 0),
      readOnly: readOnly && tabIdx !== 0,
      gatesReadOnly: readOnly,
      // owners only: structural moves that used to sit in the kebab menu
      hasOwnerMoves: tabIdx === 0 && !readOnly && (this.props.ownerMoves || []).length > 0,
      ownerMoves: (this.props.ownerMoves || []).map((x, i) => ({ ...x, divider: i ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "0" })),
      ...(tabIdx === 0 && readOnly ? {} : { chevMask: ABOUT_ICONS.chev }),
      // no edit permission: switches become plain On/Off status
      canEdit: !readOnly,
      rulesStatus: s.rulesOn ? "On" : "Off",
      threadsStatus: s.threadsOverride ? "On" : "Off",
      inertAttr: readOnly && tabIdx !== 0 ? "" : undefined,
      showFooter: !readOnly,
      onBodyScroll: () => { if (this.state.permMenu) this.setState({ permMenu: null }); },

      // --- Group tab: identity plus the group-wide switches, as at creation
      // communities can use their own cover image, as at creation; picking a swatch clears it
      coverValue: s.coverUrl ? "url(" + s.coverUrl + ") center/cover no-repeat" : "var(--cover-" + (COVERS[s.coverKey] ? s.coverKey : "plum") + ")",
      coverHeight: isCommunityNoun ? "150px" : "112px",
      canUploadCover: isCommunityNoun,
      coverRef: this._coverInput,
      coverUploadLabel: s.coverUrl ? "Change cover" : "Upload cover",
      onPickCover: () => { if (this._coverInput.current) this._coverInput.current.click(); },
      onCoverFile: e => { const f = e.target.files && e.target.files[0]; if (!f) return; this.setState({ coverUrl: URL.createObjectURL(f) }); e.target.value = ""; },
      coverChoices: Object.keys(COVERS).map(k => ({
        label: COVERS[k].label,
        value: "var(--cover-" + k + ")",
        ring: ring(k === s.coverKey),
        onSelect: () => this.setState({ coverKey: k, coverUrl: null }),
      })),
      colorChoices: Object.keys(GRADIENTS).map(k => ({
        label: GRADIENTS[k].label,
        gradient: GRADIENTS[k].value,
        ring: ring(k === s.color),
        onSelect: () => this.setState({ color: k }),
      })),
      avatarGradient: (GRADIENTS[s.color] || GRADIENTS.teal).value,
      avatarImage: s.avatar ? "url(" + s.avatar + ") center/cover no-repeat" : "none",
      hasPickedPhoto: !!s.avatar,
      avatarRef: this._avatar,
      onPickAvatar: () => { if (this._avatar.current) this._avatar.current.click(); },
      onAvatarFile: e => {
        const f = e.target.files && e.target.files[0];
        if (f) this.setState({ avatar: URL.createObjectURL(f) });
      },
      onClearAvatar: () => this.setState({ avatar: "" }),
      name: s.name,
      nameMax: NAME_MAX,
      onName: e => this.setState({ name: e.target.value, touched: true }),
      nameLeft: String(NAME_MAX - s.name.length),
      nameLeftInk: NAME_MAX - s.name.length <= 5 ? "var(--status-warning,#FFB03D)" : "var(--ink-4,#7C7C8C)",
      nameBad: !nameOk && (s.touched || s.submitted),
      nameLine: !nameOk && (s.touched || s.submitted) ? "var(--status-danger,#F5493D)" : "var(--line-2,rgba(255,255,255,.1))",
      about: s.about,
      // view-only: no character counters, and an empty description is left out
      aboutMax: readOnly ? undefined : ABOUT_MAX,
      showAbout: !readOnly || !!(s.about || "").trim(),
      onAbout: e => this.setState({ about: e.target.value }),
      switches: [
        {
          title: "Public group",
          hint: s.isPublic ? "Anyone can find this group and join it." : "Private — only invited people can join. Public groups can be found and joined by anyone.",
          on: s.isPublic,
          onChange: v => this.setState({ isPublic: v }),
          divider: "var(--line-1,rgba(255,255,255,.07))",
          showDuration: false,
        },
        {
          title: "Visible chat history",
          hint: "New joiners see the full history when on, and only messages sent after they joined when off.",
          on: s.history,
          onChange: v => this.setState({ history: v }),
          divider: "var(--line-1,rgba(255,255,255,.07))",
          showDuration: false,
        },
        {
          title: "Disappearing messages",
          hint: s.disappearOn ? "Messages older than " + s.after + " are deleted automatically." : "Messages are kept until someone deletes them.",
          on: s.disappearOn,
          onChange: v => this.setState({ disappearOn: v }),
          divider: "transparent",
          showDuration: s.disappearOn,
        },
      ].map(x => ({ ...x, timed: x.title === "Disappearing messages", plain: x.title !== "Disappearing messages", offHint: "Messages are kept until someone deletes them.", status: x.on ? "On" : "Off" })),
      after: s.after,
      onAfter: label => this.setState({ after: label }),

      // --- Gates tab
      // the draft, not the prop: the builder unmounts on tab switch and must come
      // back showing the edits, which are also what Save writes
      gates: s.gates,
      onGatesChange: g => this.setState({ gates: g }),

      // --- Rules tab
      rulesOn: s.rulesOn,
      onRulesOn: v => this.setState({ rulesOn: v }),
      rulesMax: RULES_MAX,
      rulesText: s.rulesText,
      onRulesText: e => this.setState({ rulesText: e.target.value }),
      hasRulesText: s.rulesText.length > 0 && !readOnly,
      onClearRules: () => this.setState({ rulesText: "", rulesPreset: null }),
      rulesError: rulesBad && s.submitted,
      ruleTemplates: RULE_TEMPLATES.map(t => {
        const sel = s.rulesPreset === t.key;
        return {
          label: t.label,
          desc: t.desc,
          bg: sel ? "color-mix(in srgb, var(--accent,#FF5672) 10%, transparent)" : "var(--overlay-1,rgba(255,255,255,.04))",
          line: sel ? "color-mix(in srgb, var(--accent,#FF5672) 45%, transparent)" : "var(--line-1,rgba(255,255,255,.07))",
          ink: sel ? "var(--accent-bright,#FF8298)" : "var(--ink,#E4E4EC)",
          onSelect: () => this.setState({ rulesPreset: t.key, rulesText: t.rules.map(r => "• " + r).join("\n") }),
        };
      }),

      // --- Permissions tab
      permSub: s.permSub,
      onPermSub: i => this.setState({ permSub: i, permMenu: null }),
      permSubLabels: ["General", "Messages", "Threads"],
      permSubCounts: [
        GENERAL.filter(x => s.perms.general[x.key] !== x.def).length || null,
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
      permsChanged: permsChanged > 0,
      permsSummary: permsChanged + (permsChanged === 1 ? " permission differs from the defaults" : " permissions differ from the defaults"),
      onPermsReset: () => this.setState({ perms: DEFAULT_PERMS(), threadsOverride: false, permMenu: null }),
      permGroups: s.permSub === 0
        ? PERM_GROUPS.map(g => {
            const items = GENERAL.filter(x => x.group === g);
            return {
              label: g.toUpperCase(),
              hasLabel: true,
              items: items.map((x, i) => {
                const cur = s.perms.general[x.key];
                const off = cur === "nobody";
                return {
                  label: x.label,
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
        : [{ label: "", hasLabel: false, items: [this._masterRow(scope)].concat(CONTENT.map((c, i) => this._contentRow(scope, c, i, CONTENT.length - 1))) }],

      permMenuOpen: !!pm,
      permMenuTop: pm ? pm.top : "0px",
      permMenuLeft: pm ? pm.left : "0px",
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

      // --- footer: one commit for the whole group
      showNote: (s.submitted && (!nameOk || rulesBad)) || dirty,
      note: s.submitted && !nameOk ? "Name needed" : s.submitted && rulesBad ? "Rules needed" : "Unsaved changes",
      noteInk: s.submitted && (!nameOk || rulesBad) ? "var(--status-danger,#F5493D)" : "var(--ink-4,#7C7C8C)",
      saveBg: dirty ? "var(--accent,#FF5672)" : "var(--overlay-1,rgba(255,255,255,.05))",
      saveInk: dirty ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      saveCursor: dirty ? "pointer" : "not-allowed",
      onCancel: () => { if (this.props.onCancel) this.props.onCancel(); },
      showCancel: !embedded || dirty,
      cancelLabel: embedded ? "Discard changes" : "Cancel",
      onCancelPress: () => {
        if (embedded) { this.setState({ ...JSON.parse(s.initial), submitted: false, touched: false }); return; }
        if (this.props.onCancel) this.props.onCancel();
      },
      onSave: () => {
        if (!dirty) return;
        // a blocked save jumps to the tab that needs attention
        if (!nameOk) { this.setState({ submitted: true, tab: 0 }); return; }
        if (rulesBad) { this.setState({ submitted: true, tab: 2 }); return; }
        // embedded stays open after saving, so the saved draft becomes the new baseline
        if (embedded) this.setState({ initial: JSON.stringify(this._snapshot()), submitted: false });
        if (!this.props.onSave) return;
        this.props.onSave({
          info: { name: s.name.trim(), about: s.about, color: s.color, coverKey: s.coverKey, coverUrl: s.coverUrl, avatar: s.avatar },
          settings: { isPublic: s.isPublic, history: s.history, disappearOn: s.disappearOn, after: s.after },
          gates: s.gates,
          rules: { enabled: s.rulesOn, text: s.rulesOn ? s.rulesText.trim() : "" },
          permissions: {
            general: { ...s.perms.general },
            messages: { ...s.perms.messages },
            threads: s.threadsOverride ? { ...s.perms.threads } : null,
          },
        });
      },
    };
  }
}

export default Component;

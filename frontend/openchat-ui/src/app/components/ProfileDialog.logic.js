// Logic for ProfileDialog.svelte — carried over from lib/ProfileDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  close: "var(--icon-close) center/contain no-repeat",
  edit: "var(--icon-edit) center/contain no-repeat",
  share: "var(--icon-share) center/contain no-repeat",
  verified: "var(--icon-verified) center/contain no-repeat",
  chevRight: "var(--icon-chevron-right) center/contain no-repeat",
  zap: "var(--icon-zap) center/contain no-repeat",
  copy: "var(--icon-copy) center/contain no-repeat",
  check: "var(--icon-check) center/contain no-repeat",
  up: "var(--icon-chevron-up) center/contain no-repeat",
  down: "var(--icon-chevron-down) center/contain no-repeat",
  chevLeft: "var(--icon-back) center/contain no-repeat",
  shield: "var(--icon-shield) center/contain no-repeat",
  trophy: "var(--icon-trophy) center/contain no-repeat",
  device: "var(--icon-device) center/contain no-repeat",
  key: "var(--icon-key) center/contain no-repeat",
  search: "var(--icon-search) center/contain no-repeat",
  passkey: "var(--icon-passkey) center/contain no-repeat",
  ii: "var(--icon-ii) center/contain no-repeat",
  mail: "var(--icon-mail) center/contain no-repeat",
  unlink: "var(--icon-unlink) center/contain no-repeat",
  clock: "var(--icon-clock) center/contain no-repeat",
  lock: "var(--icon-lock) center/contain no-repeat",
  plus: "var(--icon-plus) center/contain no-repeat",
  play: "var(--icon-play) center/contain no-repeat",
  stop: "var(--icon-stop) center/contain no-repeat",
  flag: "var(--icon-flag) center/contain no-repeat",
  logout: "var(--icon-leave) center/contain no-repeat",
  user: "var(--icon-user) center/contain no-repeat",
  stats: "var(--icon-poll) center/contain no-repeat",
  chats: "var(--icon-chat) center/contain no-repeat",
  users: "var(--icon-users) center/contain no-repeat",
  eye: "var(--icon-eye) center/contain no-repeat",
  refresh: "var(--icon-refresh) center/contain no-repeat",
  bot: "var(--icon-bot) center/contain no-repeat",
  heart: "var(--icon-heart) center/contain no-repeat",
  wallet: "var(--icon-wallet) center/contain no-repeat",
  download: "var(--icon-download) center/contain no-repeat",
  gem: "var(--icon-gem) center/contain no-repeat",
  info: "var(--icon-info) center/contain no-repeat",
  external: "var(--icon-external) center/contain no-repeat",
  map: "var(--icon-map) center/contain no-repeat",
  file: "var(--icon-file) center/contain no-repeat",
  layers: "var(--icon-layers) center/contain no-repeat",
  news: "var(--icon-news) center/contain no-repeat",
  sparkle: "var(--icon-sparkle) center/contain no-repeat",
  trash: "var(--icon-trash) center/contain no-repeat",
};

const MIX_COLORS = ["#5B8CFF", "#B06BFF", "#FFB03D", "#2EE6A8", "#6E6E7C"];

const NAV = [
  { label: "ACCOUNT", items: [["profile", "Profile", M.user], ["stats", "Your stats", M.stats], ["chit", "CHIT", M.zap, "chit"], ["diamond", "Diamond", M.gem, "diamond"]] },
  { label: "SETTINGS", items: [["chats", "Chats & calls", M.chats], ["communities", "Communities", M.users], ["signin", "Sign-in providers", M.key], ["appearance", "Appearance", M.eye]] },
  { label: "ADVANCED", items: [["storage", "Storage & cache", M.refresh], ["bots", "Bot configuration", M.bot], ["device", "Link new device", M.device], ["delete", "Delete account", M.trash, "danger"]]  },
  { label: "OPENCHAT", items: [["invite", "Invite friends", M.share], ["about", "About", M.info]] },
];
const TITLES = {}; NAV.forEach(g => g.items.forEach(i => { TITLES[i[0]] = i[1]; }));

const FIELDS = [
  { key: "name", label: "Display name", max: 25, placeholder: "Add a display name", hint: "Optional · shown instead of your username" },
  { key: "handle", label: "Username", max: 20, mono: true, hint: "Letters, numbers and underscores" },
  { key: "about", label: "About", max: 2000, area: true, placeholder: "Tell people about yourself", hint: "Optional" },
];

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";
const COVER_DARK = "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)";
const COVER_LIGHT = "repeating-linear-gradient(115deg,#E9E3F0 0 10px,#DED6E8 10px 20px)";

const GRADS = {
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)", violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)", blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  plum: "linear-gradient(140deg,#B06BFF,#6A2BFF)", rose: "linear-gradient(140deg,#FF6B8B,#C13584)",
  slate: "linear-gradient(140deg,#8E9BB3,#5A6478)",
};
const COMMUNITIES = [
  { name: "OpenChat Devs", color: "teal" }, { name: "Design Guild", color: "violet" },
  { name: "Pixel Art Club", color: "amber" }, { name: "ICP Builders", color: "blue" },
  { name: "Crypto Chat", color: "plum" }, { name: "Night Owls", color: "rose" },
  { name: "Weekend Runners", color: "slate" },
];
const DEFAULT_COMMUNITY_NAMES = { "Design Guild": "James · Product", "ICP Builders": "jsmith.icp", "Night Owls": "Jimmy" };

const FONT_SIZES = [
  { key: "small", label: "Small", glyph: "11px", scale: 0.92 },
  { key: "default", label: "Default", glyph: "13px", scale: 1 },
  { key: "large", label: "Large", glyph: "15px", scale: 1.1 },
  { key: "larger", label: "Larger", glyph: "17px", scale: 1.2 },
];

const SIGNIN_METHODS = [
  { type: "passkey", id: "l45dg-bz7s…-ob25p-cae", title: "Passkey in 1Password", short: "1Password passkey", used: "In use now", current: true },
  { type: "passkey", id: "vpzuo-ist3…-aal7i-rqe", title: "Passkey in 1Password", used: "Last used 3 weeks ago" },
  { type: "passkey", id: "c5qvb-shzm…-3ye3o-7qe", title: "Passkey in NordPass", used: "Last used in March" },
  { type: "ii", id: "62mzz-hssh…-xvcvl-rqe", title: "Internet Identity", used: "Last used 2 days ago" },
  { type: "email", id: "james.smith@proton.me", title: "james.smith@proton.me", used: "Last used in June" },
];

const CHAT_GROUPS = [
  { label: "CHATS", rows: [
    ["enterSends", "Enter key sends message", "Use Shift + Enter for a new line."],
    ["doubleClick", "Double-click to reply or edit", "Double-click someone else’s message to reply, or your own to edit it."],
    ["notifications", "Notifications", "Get notified about new messages while OpenChat is in the background."],
    ["lowBandwidth", "Low bandwidth", "Uses less data when your connection is poor. Media loads on demand."],
    ["hideBlocked", "Hide messages from blocked users", "Removes their messages from group and community chats too. You may lose some conversation context."],
  ] },
  { label: "VIDEO CALLS", rows: [
    ["cameraOn", "Start with camera on", "Your camera is live as soon as you join a call."],
    ["micOn", "Start with microphone on", "You join calls unmuted."],
    ["activeSpeaker", "Start in speaker view", "Calls open with whoever is talking shown large, instead of a grid."],
  ] },
  { label: "RESTRICTED CONTENT", rows: [
    ["offensive", "Offensive", "Show communities and groups marked as offensive."],
    ["adult", "Adult", "Show communities and groups flagged as adult content."],
    ["underReview", "Under review", "Show communities and groups that are currently under review."],
  ] },
];
const CHAT_DEFAULTS = { enterSends: true, doubleClick: true, notifications: true, lowBandwidth: false, hideBlocked: false, cameraOn: false, micOn: true, activeSpeaker: false, offensive: false, adult: true, underReview: false, ringtone: "pleasant" };
// Rough envelope per tone so each waveform reads differently
const WAVES = {
  boring: x => 0.35 + 0.1 * Math.sin(x * 40),
  pleasant: x => 0.3 + 0.55 * Math.pow(Math.sin(x * Math.PI), 1.5) * (0.75 + 0.25 * Math.sin(x * 23)),
  boomboom: x => (Math.sin(x * Math.PI * 4) > 0.2 ? 0.9 : 0.2) * (0.8 + 0.2 * Math.sin(x * 51)),
  twostep: x => ((Math.floor(x * 8) % 2) ? 0.35 : 0.8) * (0.7 + 0.3 * Math.abs(Math.sin(x * 37))),
  siren: x => 0.25 + 0.7 * Math.abs(Math.sin(x * Math.PI * 2)),
};
const RINGTONES = [["boring", "Boring"], ["pleasant", "Pleasant"], ["boomboom", "Boom boom"], ["twostep", "Two step flava"], ["siren", "Siren"]];

// Demo clock + synthetic claim history back to the join month
const TODAY = Date.UTC(2026, 8, 23), DAY = 864e5;
const JOINED = { y: 2021, m: 10 };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const tier = d => d >= 365 ? 600 : d >= 100 ? 500 : d >= 30 ? 400 : d >= 14 ? 300 : d >= 7 ? 200 : d >= 3 ? 150 : 100;
const key = t => new Date(t).toISOString().slice(0, 10);
function buildHistory(runLength, insuredDays) {
  const map = {};
  const runStart = TODAY - runLength * DAY;
  let t = Date.UTC(JOINED.y, JOINED.m, 1), run = 0, seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  while (t < runStart - DAY) {
    if (rnd() < 0.1) run = 0; else { run++; map[key(t)] = { amount: tier(run), day: run, min: 300 + Math.floor(rnd() * 960) }; }
    t += DAY;
  }
  for (let i = 0; i < runLength; i++) {
    const tt = runStart + i * DAY, k = key(tt);
    const min = 300 + ((i * 137 + 61) % 960);
    map[k] = insuredDays.includes(k) ? { insured: true, day: i + 1 } : { amount: tier(i + 1), day: i + 1, min };
  }
  return map;
}

const SI_TYPES = {
  passkey: { label: "PASSKEYS", icon: M.passkey, noun: "Passkey", addLabel: "Add a passkey", addTitle: "Add a passkey", empty: "No other passkeys yet." },
  ii: { label: "INTERNET IDENTITY", icon: M.ii, noun: "Internet Identity", addLabel: "Link an Internet Identity", addTitle: "Link an Internet Identity", empty: "No Internet Identity linked." },
  email: { label: "EMAIL", icon: M.mail, noun: "Email", addLabel: "Add an email", addTitle: "Add an email", empty: "No email linked." },
};

class Component extends DCLogic {
  state = { closing: false, section: null, editing: null, draft: "", saved: {}, copied: false, monthOffset: 0, hoverDay: null, chat: {}, playing: null, commNames: {}, commQuery: "", siRemoved: [], siAdded: [], siAdding: null, siToast: null };

  _communities(defaultName) {
    const st = this.state, p = this.props;
    const list = p.communities ?? COMMUNITIES;
    const names = Object.assign({}, p.communityNames ?? DEFAULT_COMMUNITY_NAMES, st.commNames);
    const q = (st.commQuery || "").trim().toLowerCase();
    const shown = q ? list.filter(c => c.name.toLowerCase().includes(q)) : list;
    const commit = (name, value) => {
      const next = Object.assign({}, st.commNames, { [name]: value });
      this.setState({ commNames: next, editing: null, draft: "" });
      if (p.onCommunityName) p.onCommunityName(name, value || null);
    };
    return {
      defaultName,
      commFilterShown: list.length > 10,
      commQuery: st.commQuery || "",
      onCommQuery: e => this.setState({ commQuery: e.target.value }),
      commEmpty: shown.length === 0,
      communities: shown.map((c, i) => {
        const custom = names[c.name] || "";
        const key = "comm:" + c.name, editing = st.editing === key;
        return {
          name: c.name, grad: GRADS[c.color] || GRADS.slate,
          divider: i ? "block" : "none",
          idle: !editing, editing, hasCustom: !!custom,
          shown: custom || defaultName,
          tag: custom ? "" : "default",
          font: custom ? "var(--weight-semibold) 13.5px/1.2 var(--font-sans)" : "var(--weight-medium) 13px/1.2 var(--font-sans)",
          ink: custom ? "var(--ink,#ECECF1)" : "var(--ink-4,#6E6E7C)",
          draft: editing ? st.draft : "",
          hint: "Leave empty to use " + defaultName,
          ref: editing ? this.fieldRef : undefined,
          onEdit: () => this.setState({ editing: key, draft: custom }),
          onInput: e => this.setState({ draft: e.target.value }),
          onKey: e => {
            if (e.key === "Escape") { e.stopPropagation(); this.setState({ editing: null, draft: "" }); }
            else if (e.key === "Enter") { e.preventDefault(); commit(c.name, this.state.draft.trim()); }
          },
          onCancel: () => this.setState({ editing: null, draft: "" }),
          onSave: () => commit(c.name, this.state.draft.trim()),
          onReset: () => commit(c.name, ""),
        };
      }),
    };
  }

  _toast(text, undo) {
    clearTimeout(this._st);
    this.setState({ siToast: { text, undo } });
    this._st = setTimeout(() => this.setState({ siToast: null }), 5000);
  }

  _signin() {
    const st = this.state, p = this.props;
    const all = (p.signinMethods ?? SIGNIN_METHODS).concat(st.siAdded).filter(x => !st.siRemoved.includes(x.id));
    const current = all.find(x => x.current) || all[0];
    const a = st.siAdding; // { type, step, email, code, sent }
    const finish = method => {
      this.setState(s => ({ siAdded: s.siAdded.concat([method]), siAdding: null }));
      this._toast(SI_TYPES[method.type].noun + " linked");
    };
    const update = patch => this.setState(s => ({ siAdding: Object.assign({}, s.siAdding, patch) }));
    const emailOk = a && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email || "");
    const codeOk = a && /^\d{6}$/.test(a.code || "");
    const confirmStep = label => ({ label: "Confirm with your " + current.short, state: a && a.step === "confirm" ? (a.waiting ? "wait" : "now") : "todo", action: "Confirm",
      onAction: () => { update({ waiting: true }); clearTimeout(this._sw); this._sw = setTimeout(() => finish(Object.assign({ current: false }, label)), 900); } });
    let checklist = [];
    if (a && a.type !== "email") {
      const nm = a.type === "passkey" ? "Create a passkey" : "Sign in with Internet Identity";
      const newId = a.type === "passkey" ? { type: "passkey", id: "k" + Date.now().toString(36).slice(-4) + "-new…-" + "lnk1d-cai", title: "Passkey on this device", short: "passkey on this device" }
        : { type: "ii", id: "7hq2m-ab3x…-ne9kd-cai", title: "Internet Identity", short: "Internet Identity" };
      checklist = [
        { label: nm, state: a.step === "new" ? (a.waiting ? "wait" : "now") : "done", action: a.type === "passkey" ? "Create" : "Sign in",
          onAction: () => { update({ waiting: true }); clearTimeout(this._sw); this._sw = setTimeout(() => update({ step: "confirm", waiting: false }), 900); } },
        a.step === "new" ? { label: "Confirm with your " + current.short, state: "todo" } : confirmStep(newId),
      ];
    } else if (a && a.step === "confirm") {
      checklist = [
        { label: "Verify " + a.email, state: "done" },
        confirmStep({ type: "email", id: a.email, title: a.email, short: "email" }),
      ];
    }
    checklist = checklist.map(c => ({ ...c,
      bg: c.state === "done" ? "var(--status-online,#2EE6A8)" : "transparent",
      ring: c.state === "done" ? "none" : c.state === "todo" ? "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.24))" : "inset 0 0 0 1.5px var(--accent,#FF5672)",
      checkDisplay: c.state === "done" ? "block" : "none",
      font: c.state === "now" || c.state === "wait" ? "var(--weight-semibold) 12.5px/1.3 var(--font-sans)" : "var(--weight-medium) 12.5px/1.3 var(--font-sans)",
      ink: c.state === "done" || c.state === "todo" ? "var(--ink-3,#8A8A99)" : "var(--ink,#ECECF1)",
      hasAction: c.state === "now" && !!c.onAction, waiting: c.state === "wait",
    }));
    const si = !a ? {} : {
      title: SI_TYPES[a.type].addTitle,
      isEmail: a.type === "email" && a.step === "email",
      isCode: a.type === "email" && a.step === "code",
      isChecklist: a.type !== "email" || a.step === "confirm",
      email: a.email || "", code: a.code || "",
      hint: a.email && !emailOk ? "Enter a full email address" : "We’ll email a one-time code, then ask you to confirm with your " + current.short + ".",
      hintInk: a.email && !emailOk ? "var(--status-danger,#F5493D)" : "var(--ink-4,#6E6E7C)",
      primaryOpacity: (a.step === "email" && !emailOk) || (a.step === "code" && !codeOk) ? 0.4 : 1,
      primaryPointer: (a.step === "email" && !emailOk) || (a.step === "code" && !codeOk) ? "none" : "auto",
      ref: a.step === "email" || a.step === "code" ? this.fieldRef : undefined,
      onEmail: e => update({ email: e.target.value }),
      onEmailKey: e => { if (e.key === "Enter" && emailOk) update({ step: "code" }); if (e.key === "Escape") { e.stopPropagation(); this.setState({ siAdding: null }); } },
      onSend: () => update({ step: "code" }),
      onCode: e => update({ code: e.target.value.replace(/\D/g, "").slice(0, 6) }),
      onCodeKey: e => { if (e.key === "Enter" && codeOk) update({ step: "confirm" }); if (e.key === "Escape") { e.stopPropagation(); this.setState({ siAdding: null }); } },
      onVerify: () => update({ step: "confirm" }),
      onCancel: () => { clearTimeout(this._sw); this.setState({ siAdding: null }); },
      checklist,
    };
    const groups = ["passkey", "ii", "email"].map(type => {
      const T = SI_TYPES[type];
      const items = all.filter(x => x.type === type && x !== current).map(x => ({
        title: x.title + (type === "email" ? "" : " · " + x.id.slice(0, 5)),
        sub: x.used || "Just linked",
        onUnlink: () => {
          this.setState(s => ({ siRemoved: s.siRemoved.concat([x.id]) }));
          this._toast(x.title + " unlinked", () => this.setState(s => ({ siRemoved: s.siRemoved.filter(id => id !== x.id), siToast: null })));
        },
      }));
      const adding = !!a && a.type === type;
      return { label: T.label, icon: T.icon, items, empty: !items.length && !adding, emptyText: T.empty,
        addLabel: T.addLabel, addIdle: !adding, adding,
        onAdd: () => { clearTimeout(this._sw); this.setState({ siAdding: { type, step: type === "email" ? "email" : "new", email: "", code: "" } }); } };
    });
    return {
      siCurrent: { title: current.title, id: current.id, icon: SI_TYPES[current.type].icon },
      siGroups: groups, si,
      siToastShown: !!st.siToast, siToast: st.siToast ? st.siToast.text : "",
      siCanUndo: !!(st.siToast && st.siToast.undo),
      siUndo: () => { clearTimeout(this._st); if (st.siToast && st.siToast.undo) st.siToast.undo(); },
    };
  }

  _appearance() {
    const p = this.props;
    const theme = p.themePref ?? "dark", accent = p.accentPref ?? (p.accent ?? "pink"), size = p.fontSize ?? "default";
    const set = patch => { if (p.onAppearance) p.onAppearance(patch); };
    const PREV = {
      dark: { bg: "#0e0e12", recv: "#22222c", bar: "#191921" },
      light: { bg: "#FFFFFF", recv: "#EFEDE8", bar: "#E7E5E0" },
      system: { bg: "linear-gradient(115deg,#0e0e12 0 50%,#FFFFFF 50% 100%)", recv: "rgba(128,128,140,.45)", bar: "linear-gradient(115deg,#191921 0 50%,#E7E5E0 50% 100%)" },
    };
    const on = "inset 0 0 0 1.5px var(--accent,#FF5672)", off = "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))";
    return {
      apThemes: [["system", "System"], ["dark", "Dark"], ["light", "Light"]].map(([k, label]) => ({
        label, ...PREV[k], ring: theme === k ? on : off,
        radioRing: theme === k ? "inset 0 0 0 1.5px var(--accent,#FF5672)" : "inset 0 0 0 1.5px var(--line-3,rgba(255,255,255,.24))",
        dot: theme === k ? 1 : 0, pick: () => set({ theme: k }),
      })),
      apAccents: [["pink", "Pink", "#FF5672"], ["blue", "Blue", "#3D9BFF"], ["orange", "Orange", "#FF8A3D"], ["green", "Green", "#2EE6A8"]].map(([k, label, color]) => ({
        label, color, ring: accent === k ? on : off, dot: accent === k ? 1 : 0, pick: () => set({ accent: k }),
      })),
      apSizes: FONT_SIZES.map(f => ({
        label: f.label, glyph: f.glyph,
        bg: size === f.key ? "var(--overlay-2,rgba(255,255,255,.09))" : "transparent",
        ink: size === f.key ? "var(--ink,#ECECF1)" : "var(--ink-3,#8A8A99)",
        pick: () => set({ font: f.key }),
      })),
      apSample: this.props.onAppearance ? "13.5px" : Math.round(13.5 * (FONT_SIZES.find(f => f.key === size) || FONT_SIZES[1]).scale * 10) / 10 + "px",
    };
  }

  _chatVals() {
    const vals = Object.assign({}, CHAT_DEFAULTS, this.props.chatSettings, this.state.chat);
    const set = (k, v) => {
      this.setState({ chat: Object.assign({}, this.state.chat, { [k]: v }) });
      if (this.props.onChatSettings) this.props.onChatSettings(Object.assign({}, vals, { [k]: v }));
    };
    const groups = this._chatGroups(vals);
    const playing = this.state.playing;
    return {
      chatGroupsTop: groups.slice(0, 2),
      chatGroupsBottom: groups.slice(2),
      ringtones: RINGTONES.map(([k, label], i) => {
        const on = vals.ringtone === k, isPlaying = playing === k;
        const shape = WAVES[k];
        const bars = Array.from({ length: 28 }, (_, j) => {
          const v = shape(j / 27);
          return { h: Math.max(3, Math.round(v * 20)) + "px", ink: isPlaying ? "var(--accent,#FF5672)" : on ? "var(--ink-3,#8A8A99)" : "var(--line-3,rgba(255,255,255,.24))" };
        });
        return {
          label, bars, divider: i ? "block" : "none",
          bg: on ? "var(--overlay-1,rgba(255,255,255,.05))" : "transparent",
          checkOpacity: on ? 1 : 0,
          weight: on ? 600 : 500,
          playMask: isPlaying ? M.stop : M.play,
          playInk: isPlaying ? "var(--accent,#FF5672)" : "var(--ink-3,#8A8A99)",
          playTitle: isPlaying ? "Stop preview" : "Preview " + label,
          pick: () => set("ringtone", k),
          preview: e => {
            e.stopPropagation(); clearTimeout(this._p);
            if (isPlaying) { this.setState({ playing: null }); return; }
            this.setState({ playing: k });
            this._p = setTimeout(() => this.setState({ playing: null }), 2500);
          },
        };
      }),
    };
  }

  _chatGroups(vals) {
    return CHAT_GROUPS.map(g => ({
      label: g.label,
      rows: g.rows.map(([k, title, hint], i) => ({
        title, hint, on: !!vals[k], divider: i ? "block" : "none",
        onChange: v => {
          this.setState({ chat: Object.assign({}, this.state.chat, { [k]: v }) });
          if (this.props.onChatSettings) this.props.onChatSettings(Object.assign({}, vals, { [k]: v }));
        },
      })),
    }));
  }

  _chit(section) {
    const p = this.props, st = this.state;
    const enabled = p.chitEnabled ?? true;
    const claimable = p.claimable ?? true;
    const streak = p.streak ?? 57;
    const runLength = claimable ? streak : streak - 1;
    const hist = buildHistory(runLength, ["2026-09-07"]);
    const todayAmount = tier(runLength + 1);
    if (!claimable) hist[key(TODAY)] = { amount: todayAmount, day: runLength + 1, min: p.claimMinute ?? 560 };
    const now = new Date(TODAY);
    const total = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const minTotal = JOINED.y * 12 + JOINED.m;
    const view = Math.max(minTotal, total - st.monthOffset);
    const y = Math.floor(view / 12), mo = view % 12;
    const first = new Date(Date.UTC(y, mo, 1)), lead = first.getUTCDay();
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const cells = [];
    let chit = 0, claimed = 0, insured = 0;
    const utcView = p.chitUtc ?? false, OFFSET = p.utcOffsetMinutes ?? 120;
    const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
    const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hoverAt = st.hoverDay;
    const blank = { pop: false, popLines: [], popAlign: "", label: "", amount: "", iconDisplay: "none", ring: "none", opacity: 1, title: "", bg: "transparent", ink: "var(--ink-4,#6E6E7C)", amountInk: "var(--status-chit,#FF9F45)", cursor: "default", onPress: undefined };
    for (let i = 0; i < lead; i++) cells.push(blank);
    for (let d = 1; d <= dim; d++) {
      const t = Date.UTC(y, mo, d), rec = hist[key(t)], label = String(d), date = d + " " + MONTHS[mo].slice(0, 3);
      const col = (lead + d - 1) % 7;
      const withPop = (cell, head, lines) => ({ ...cell, title: "",
        pop: hoverAt === d, popHead: head, popLines: lines,
        popAlign: col === 0 ? "inset-inline-start:0" : col === 6 ? "inset-inline-end:0" : "inset-inline-start:50%;transform:translateX(-50%)",
        onEnter: () => this.setState({ hoverDay: d }), onLeave: () => this.setState(s => s.hoverDay === d ? { hoverDay: null } : null) });
      const fullDate = WD[new Date(t).getUTCDay()] + " " + d + " " + MONTHS[mo];
      if (t === TODAY && claimable) {
        cells.push({ ...blank, label, ink: "var(--ink,#ECECF1)", amount: "Claim", ring: "inset 0 0 0 1.5px var(--status-chit,#FF9F45)", cursor: "pointer", title: "Claim today’s CHIT",
          onPress: () => this._close(p.onChit) });
      } else if (t > TODAY) {
        cells.push({ ...blank, label, ink: "var(--ink-3,#8A8A99)", opacity: 0.5 });
      } else if (rec && rec.insured) {
        insured++;
        cells.push(withPop({ ...blank, label, ink: "var(--ink,#ECECF1)", bg: "color-mix(in srgb,var(--status-online,#2EE6A8) 12%,transparent)", amountInk: "var(--status-online,#2EE6A8)", iconDisplay: "block" }, fullDate,
          [{ text: "Missed · covered by insurance", ink: "var(--status-online,#2EE6A8)" }, { text: "Streak kept at day " + rec.day, ink: "var(--ink-3,#8A8A99)" }]));
      } else if (rec) {
        chit += rec.amount; claimed++;
        const time = utcView ? hhmm(rec.min) + " UTC" : hhmm(rec.min + OFFSET) + " local time";
        cells.push(withPop({ ...blank, label, ink: "var(--ink,#ECECF1)", bg: "var(--status-chit-soft,rgba(255,159,69,.14))", amount: String(rec.amount) }, fullDate,
          [{ text: "Claimed at " + time, ink: "var(--ink,#ECECF1)" }, { text: "+" + rec.amount + " CHIT · day " + rec.day + " of streak", ink: "var(--status-chit,#FF9F45)" }]));
      } else {
        cells.push({ ...blank, label, ink: "var(--ink-3,#8A8A99)", title: date + " · not claimed" });
      }
    }
    while (cells.length % 7) cells.push(blank);
    const utc = p.chitUtc ?? false;
    const setPref = patch => { if (p.onChitSettings) p.onChitSettings(patch); };
    const kids = [
      { title: "Notify me of achievements", hint: "A small celebration each time you complete one.", on: p.chitNotify ?? true, onChange: v => setPref({ notify: v }) },
      { title: "Hide CHIT icon after claiming", hint: "Keeps the nav rail tidy once today’s CHIT is in. It comes back when the next claim opens.", on: p.chitHideAfterClaim ?? false, onChange: v => setPref({ hideAfterClaim: v }) },
    ].map((k, i) => ({ ...k, divider: i ? "block" : "none" }));
    const pz = !(p.puzzleShown ?? true) ? "off" : (p.puzzleRemind ?? false) ? "remind" : "show";
    const PZ = [["off", "Hidden", "eye-off"], ["show", "Show", "eye"], ["remind", "Show + remind", "bell"]];
    const puzzleOpts = PZ.map(([k, label, icon]) => { const on = pz === k; return { label, onStr: String(on), mask: "var(--icon-" + icon + ") center/contain no-repeat",
      bg: on ? "var(--overlay-3,rgba(255,255,255,.12))" : "transparent", ink: on ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)",
      pick: () => setPref({ puzzle: k !== "off", puzzleRemind: k === "remind" }) }; });
    const puzzleHint = pz === "off" ? "The puzzle card is removed from the CHIT modal." : pz === "show" ? "Shown in the CHIT modal. No dot on the CHIT icon." : "A dot on the CHIT icon when a new puzzle is out.";
    return {
      chitEnabled: enabled, chitDisabled: !enabled,
      setChitEnabled: v => setPref({ enabled: v }),
      chitKids: kids, puzzleOpts, puzzleHint,
      earnLeft: (p.achievementsLeft ?? 12) + " achievements left",
      onEarn: () => this._close(p.onEarn),
      monthLabel: MONTHS[mo] + " " + y,
      monthChit: chit.toLocaleString("en-US") + " CHIT",
      monthClaimed: claimed + " claimed",
      monthInsured: insured + " insured",
      insuredInk: insured ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#8A8A99)",
      prevOpacity: view > minTotal ? 1 : 0.35, prevPointer: view > minTotal ? "auto" : "none",
      nextOpacity: view < total ? 1 : 0.35, nextPointer: view < total ? "auto" : "none",
      prevMonth: () => this.setState(s => ({ monthOffset: Math.min(total - minTotal, s.monthOffset + 1) })),
      nextMonth: () => this.setState(s => ({ monthOffset: Math.max(0, s.monthOffset - 1) })),
      tzOptions: [["Local", false], ["UTC", true]].map(([label, v]) => ({
        label, bg: utc === v ? "var(--overlay-2,rgba(255,255,255,.09))" : "transparent",
        ink: utc === v ? "var(--ink,#ECECF1)" : "var(--ink-3,#8A8A99)",
        pick: () => setPref({ utc: v }),
      })),
      weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      calDays: cells,
    };
  }
  fieldRef = React.createRef();

  componentDidMount() {
    this._onKey = e => {
      if ((e.key === "Enter" || e.key === " ") && e.target && e.target.getAttribute && e.target.getAttribute("role") === "button") { e.preventDefault(); e.target.click(); return; }
      if (e.key !== "Escape" || this.state.editing) return;
      if (this.state.loOpen) { if (!this.state.loBusy) this.setState({ loOpen: false }); return; }
      if (this.state.delOpen) { if (!this.state.delBusy) this.setState({ delOpen: false, delStep: 0 }); return; }
      this._close(this.props.onClose);
    };
    window.addEventListener("keydown", this._onKey);
  }
  componentWillUnmount() { window.removeEventListener("keydown", this._onKey); clearTimeout(this._t); clearTimeout(this._c); clearTimeout(this._st); clearTimeout(this._sw); clearTimeout(this._p); clearInterval(this._lt); clearTimeout(this._lc); clearTimeout(this._db); clearTimeout(this._lo); clearTimeout(this._ic); clearTimeout(this._qt); }
  componentDidUpdate(_, prev) {
    if (this.state.editing && this.state.editing !== prev.editing && this.fieldRef.current) {
      const el = this.fieldRef.current; el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch (_) {}
    }
  }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  _values() {
    const p = this.props, s = this.state.saved;
    return {
      name: s.name ?? p.name ?? "James Smith",
      handle: s.handle ?? p.handle ?? "james_smith",
      about: s.about ?? p.about ?? "Product designer. Building onboarding flows, mostly. Coffee first, replies second.",
    };
  }

  _validate(key, v) {
    if (key === "handle") {
      if (v.length < 3) return "At least 3 characters";
      if (!/^[A-Za-z0-9_]+$/.test(v)) return "Only letters, numbers and underscores";
    }
    return null;
  }

  _save() {
    const { editing, draft } = this.state;
    if (!editing || this._validate(editing, draft)) return;
    const v = editing === "about" ? draft : draft.trim();
    const saved = Object.assign({}, this.state.saved, { [editing]: v });
    this.setState({ saved, editing: null, draft: "" });
    if (this.props.onSave) this.props.onSave(Object.assign(this._values(), { [editing]: v }));
  }

  _stats() {
    const p = this.props;
    const fmt = n => Number(n).toLocaleString("en-US");
    const mix = p.messageMix ?? [
      { label: "Text", count: 1286 }, { label: "Images", count: 56 }, { label: "Files", count: 25 },
      { label: "GIFs", count: 21 }, { label: "Polls, video, audio & crypto", count: 34 },
    ];
    const total = mix.reduce((s, x) => s + x.count, 0) || 1;
    const top = Math.max(1, ...mix.map(x => x.count));
    const now = p.onlineMinutes ?? 2942, prev = p.onlineMinutesPrev ?? 3965;
    const pct = prev ? Math.round(((now - prev) / prev) * 1000) / 10 : 0;
    const up = pct >= 0;
    const reported = p.reported ?? 5;
    // neutral until it becomes a signal worth flagging
    const tone = reported >= 25 ? "var(--status-danger,#F5493D)" : reported >= 10 ? "var(--status-warning,#FFB03D)" : null;
    return {
      onlineNow: fmt(now), onlinePrev: fmt(prev),
      onlineDelta: (up ? "+" : "") + pct + "%",
      onlineInk: up ? "var(--status-online,#2EE6A8)" : "var(--status-danger,#F5493D)",
      onlineWash: up ? "color-mix(in srgb, var(--status-online,#2EE6A8) 14%, transparent)" : "color-mix(in srgb, var(--status-danger,#F5493D) 14%, transparent)",
      onlineMask: up ? M.up : M.down,
      msgTotal: fmt(total),
      statMix: mix.map((x, i) => ({
        label: x.label, count: fmt(x.count),
        pct: Math.round((x.count / total) * 100) + "%",
        rel: ((x.count / top) * 100).toFixed(2) + "%",
        color: x.color || MIX_COLORS[i % MIX_COLORS.length],
      })),
      statExtras: p.engagement ?? [
        { count: "462", label: "Reactions" }, { count: "75", label: "Replies" },
        { count: "11", label: "Poll votes" }, { count: "5", label: "Deleted" },
      ],
      reported: fmt(reported),
      reportInk: tone ?? "var(--ink-3,#9A9AA8)",
      reportCountInk: tone ?? "var(--ink,#ECECF1)",
      reportNote: tone
        ? "Reported or removed often enough that communities may notice"
        : "Reported by others or removed by moderators",
    };
  }

  _newLink() {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join("");
    const ttl = this.props.linkCodeTtl ?? 180;
    clearInterval(this._lt);
    this.setState({ lcHidden: false, lcCode: code, lcEnd: Date.now() + ttl * 1000, lcLeft: ttl, lcCopied: false });
    this._lt = setInterval(() => {
      const left = Math.max(0, Math.ceil((this.state.lcEnd - Date.now()) / 1000));
      this.setState({ lcLeft: left });
      if (!left) { clearInterval(this._lt); this.setState({ lcCode: null, lcHidden: false }); }
    }, 250);
  }
  _link() {
    const st = this.state, left = st.lcLeft ?? 0, ttl = this.props.linkCodeTtl ?? 180;
    const has = !!st.lcCode, expired = has && left === 0;
    const mmss = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
    const warn = left <= 30;
    const code = st.lcCode ?? "";
    return {
      lcSteps: ["Open the OpenChat app on your new device", "Choose “Link an existing account”", "Enter the code shown here"]
        .map((text, i) => ({ n: i + 1, text, divider: i ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "none" })),
      lcIdle: !has || expired, lcLive: has && !expired,
      lcBlur: st.lcHidden ? "blur(9px)" : "none", lcSelect: st.lcHidden ? "none" : "all", lcHideLabel: st.lcHidden ? "Show code" : "Hide code",
      onToggleHide: () => this.setState(x => ({ lcHidden: !x.lcHidden })),
      lcCodeText: code.slice(0, 3) + " " + code.slice(3),
      lcPct: Math.max(0, Math.min(100, (left / ttl) * 100)).toFixed(1) + "%",
      lcBar: warn ? "var(--status-chit,#FF9F45)" : "var(--accent,#FF5672)",
      lcInk: warn ? "var(--status-chit,#FF9F45)" : "var(--ink-3,#8A8A99)",
      lcStatus: "Expires in " + mmss,
      lcCopyLabel: st.lcCopied ? "Copied" : "Copy code",
      lcCopyMask: st.lcCopied ? M.check : M.copy,
      lcCopyInk: st.lcCopied ? "var(--status-online,#2EE6A8)" : "var(--ink-2,#B9B9C6)",
      onShowLink: () => this._newLink(),
      onCopyLink: () => {
        try { navigator.clipboard && navigator.clipboard.writeText(code); } catch (_) {}
        clearTimeout(this._lc); this.setState({ lcCopied: true });
        this._lc = setTimeout(() => this.setState({ lcCopied: false }), 1400);
      },
    };
  }

  _delete(streak, balance) {
    const p = this.props, st = this.state, i = st.delStep ?? 0, busy = !!st.delBusy;
    const earned = p.chitEarned ?? 539400, handle = this._values().handle;
    const typed = st.delTyped ?? "", match = typed.trim().replace(/^@/, "").toLowerCase() === handle.toLowerCase();
    const H = "var(--ink,#ECECF1)", D = "var(--status-danger,#F5493D)", A = "var(--accent,#FF5672)";
    const seg = c => ({ t: c[0], ink: c[1] ? H : "inherit", w: c[1] ? "var(--weight-semibold)" : "inherit" });
    const keep = { primaryBg: A, primaryInk: "var(--on-accent,#fff)", secondaryMask: M.chevRight, hasIcon: true, iconInk: H };
    const STEPS = [
      { ...keep, icon: M.chats, title: "You’re leaving everyone on read?",
        body: [["All your chats, photos and contacts will "], ["vanish for good", 1], [". No backups, no take-backs — maybe keep the conversation going?"]],
        primary: "Okay, I’ll stay", primaryMask: M.heart, secondary: "Continue anyway" },
      { ...keep, icon: M.wallet, title: "Your wallet goes with it",
        body: [["Your crypto wallet lives here too. Deleting your account deletes it, so "], ["move your funds out first", 1], [" — or just don’t break up with us."]],
        primary: "I’m staying for my wallet", primaryMask: M.wallet, secondary: "Still want to continue" },
      { ...keep, hasIcon: false, isChit: true, title: "Think of your CHIT!",
        body: [["You’ll lose "], [balance.toLocaleString("en-US") + " CHIT", 1], [" and your "], [streak + "-day streak", 1], [". That’s a lot of days to throw away — we could even throw in a few more CHIT…?"]],
        primary: "I love a good bribe, I’ll stay", primaryMask: M.zap, secondary: "Keep going" },
      { hasIcon: true, icon: M.trash, iconInk: D, isFinal: true, title: "This is it. No take-backs.",
        body: [["Your account, chats, wallet and CHIT will be "], ["gone for good", 1], [". You’ll be asked to sign in again to confirm."]],
        primary: busy ? "Re-authenticating…" : "Re-authenticate & delete", primaryMask: busy ? M.refresh : M.trash,
        primaryBg: D, primaryInk: "#fff", secondary: "Nah, I’m kidding, I’ll stay", secondaryMask: M.heart },
    ];
    const step = STEPS[i];
    step.body = step.body.map(seg);
    const locked = step.isFinal && (!match || busy);
    step.primaryCursor = locked ? "default" : "pointer"; step.primaryOpacity = step.isFinal && !match ? 0.4 : 1;
    step.secondaryCursor = busy ? "default" : "pointer"; step.secondaryOpacity = busy ? 0.5 : 1;
    const stayNow = () => { clearTimeout(this._db); this.setState({ delOpen: false, delStep: 0, delBusy: false, delTyped: "" }); };
    return {
      delOpen: !!st.delOpen, delStep: step, delCanBack: i > 0 && !busy,
      delStepLabel: "Step " + (i + 1) + " of 4",
      delDots: STEPS.map((_, k) => ({ bg: k <= i ? (k === 3 ? D : H) : "var(--overlay-2,rgba(255,255,255,.1))" })),
      delStreak: streak, delBalance: balance.toLocaleString("en-US"), delNextMile: (() => { const n = [14, 30, 100, 365].find(v => v > streak); return n ? (n - streak) + " days to your " + n + "-day milestone" : "Every milestone reached"; })(), delEarned: earned.toLocaleString("en-US"),
      delHandle: "@" + handle, delTyped: typed,
      delInputRing: match ? D : "var(--line-2,rgba(255,255,255,.12))",
      onDelType: e => this.setState({ delTyped: e.target.value }),
      delLoss: [
        { mask: M.chats, title: "Chats, photos and contacts", sub: "Every conversation and file you’ve shared" },
        { mask: M.wallet, title: "Your crypto wallet", sub: "Move your funds out before you delete" },
        { mask: M.zap, title: balance.toLocaleString("en-US") + " CHIT and your " + streak + "-day streak", sub: "Earned CHIT can’t be recovered" },
      ].map((l, k) => ({ ...l, divider: k ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "none" })),
      onDelOpen: () => this.setState({ delOpen: true, delStep: 0, delBusy: false, delTyped: "" }),
      onDelBack: () => this.setState({ delStep: Math.max(0, i - 1) }),
      onDelStay: () => { if (!busy) stayNow(); },
      onDelPrimary: () => {
        if (i < 3) { if (i === 2 && p.onChitBribe) p.onChitBribe(); stayNow(); return; }
        if (locked) return;
        this.setState({ delBusy: true });
        this._db = setTimeout(() => { stayNow(); this._close(p.onDeleteAccount ?? p.onClose); }, 1400);
      },
      onDelSecondary: () => { if (busy) return; if (i < 3) this.setState({ delStep: i + 1 }); else stayNow(); },
    };
  }

  _invite() {
    const p = this.props, st = this.state;
    const link = p.inviteLink ?? "https://oc.app/?ref=" + (p.userId ?? "5sj6i-pqaaa-aaaaf-a3cmq-cai");
    if (st.section === "invite" && this._qrFor !== link) {
      if (window.qrcode) {
        const q = window.qrcode(0, "M"); q.addData(link); q.make();
        const n = q.getModuleCount(); let d = "";
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += "M" + x + " " + y + "h1v1h-1z";
        this._qr = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges"><path d="' + d + '" fill="#000"/></svg>');
        this._qrFor = link;
      } else { clearTimeout(this._qt); this._qt = setTimeout(() => this.forceUpdate(), 300); }
    }
    const copied = !!st.invCopied;
    return {
      invLink: link, invQr: this._qr ?? "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      invCopyLabel: copied ? "Copied" : "Copy",
      invCopyMask: copied ? M.check : M.copy,
      invCopyInk: copied ? "var(--status-online,#2EE6A8)" : "var(--ink-2,#B9B9C6)",
      invRewards: [
        { mask: M.gem ?? M.zap, label: "Becomes a Diamond member", amount: "5,000" },
        { mask: M.gem ?? M.zap, label: "Gets lifetime Diamond", amount: "15,000" },
      ].map((w, k) => ({ ...w, divider: k ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "none" })),
      onInvCopy: () => {
        try { navigator.clipboard && navigator.clipboard.writeText(link); } catch (_) {}
        clearTimeout(this._ic); this.setState({ invCopied: true });
        this._ic = setTimeout(() => this.setState({ invCopied: false }), 1400);
      },
      onInvShare: () => {
        if (navigator.share) navigator.share({ title: "Join me on OpenChat", url: link }).catch(() => {});
        else if (p.onShareApp) p.onShareApp(link);
      },
    };
  }

  _botRows() {
    const p = this.props, copied = this.state.botCopied;
    const rows = [
      ["host", "IC host URL", p.icHost ?? "https://icp-api.io"],
      ["storage", "OpenStorage index canister", p.storageIndex ?? "rturd-qaaaa-aaaaf-aabaq-cai"],
      ["key", "OpenChat public key", p.publicKey ?? "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEquEHzJr9605Oy796e4z7LKow46DVNUnDOQWavi86vEhRAAfdbVh/Lgmxfi44LPb6S0wnCRm9kI/XdK1DYw2Eaw==\n-----END PUBLIC KEY-----"],
    ];
    return rows.map(([k, label, value], i) => {
      const on = copied === k;
      return {
        label, value, ws: k === "key" ? "pre-wrap" : "normal",
        divider: i === 0 ? "none" : "1px solid var(--line-1,rgba(255,255,255,.07))",
        mask: on ? M.check : M.copy,
        ink: on ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#8A8A99)",
        title: on ? "Copied" : "Copy " + label,
        onCopy: () => {
          try { navigator.clipboard && navigator.clipboard.writeText(value); } catch (_) {}
          clearTimeout(this._bc); this.setState({ botCopied: k });
          this._bc = setTimeout(() => this.setState({ botCopied: null }), 1400);
        },
      };
    });
  }

  _storage(diamond) {
    const p = this.props, cc = this.state.cache ?? "idle";
    const cap = diamond ? 1024 : 100;
    const used = Math.min(cap, p.storageUsedMB ?? (diamond ? 412.6 : 83.4));
    const ratio = used / cap;
    const mb = v => v >= 1000 ? (v / 1024).toFixed(2).replace(/\.?0+$/, "") + " GB" : (Math.round(v * 10) / 10) + " MB";
    const tone = ratio >= 0.95 ? "var(--status-danger,#F5493D)" : ratio >= 0.8 ? "var(--status-chit,#FF9F45)" : null;
    return {
      stUsed: mb(used), stCap: diamond ? "1 GB" : "100 MB", stFree: mb(cap - used),
      stPct: Math.round(ratio * 100) + "%",
      stBar: tone ?? "var(--accent,#FF5672)", stPctInk: tone ?? "var(--ink-3,#8A8A99)",
      stUpsell: !diamond,
      ccLabel: cc === "busy" ? "Clearing…" : cc === "done" ? "Cleared" : "Clear cache",
      ccMask: cc === "done" ? M.check : M.refresh,
      ccInk: cc === "done" ? "var(--status-online,#2EE6A8)" : "var(--ink,#ECECF1)",
      ccBg: "transparent", ccCursor: cc === "idle" ? "pointer" : "default",
      ccSpin: cc === "busy" ? "oc-spin 0.8s linear infinite" : "none",
      rpTitle: cc === "done" ? "Did that fix it?" : "Still having problems?",
      onClearCache: () => {
        if (cc !== "idle") return;
        this.setState({ cache: "busy" });
        clearTimeout(this._cc);
        this._cc = setTimeout(() => { this.setState({ cache: "done" }); if (p.onClearCache) p.onClearCache(); }, 1200);
      },
      onReport: () => { if (p.onReportIssue) p.onReportIssue(); },
    };
  }

  renderVals() {
    const p = this.props, st = this.state;
    const mode = p.mode ?? "dark";
    const section = st.section ?? p.section ?? "profile";
    const vals = this._values();
    const diamond = p.isDiamond ?? false, verified = p.isVerified ?? false;
    const streak = p.streak ?? 57, balance = p.balance ?? 102000, claimable = p.claimable ?? true;
    const openChit = () => this._close(p.onChit);

    const chitOn = p.chitEnabled ?? true;
    const nav = NAV.map(g => ({
      label: g.label,
      items: g.items.filter(i => i[0] !== "chit" || chitOn || section === "chit").map(([key, title, mask, tone]) => {
        const on = key === section;
        return {
          title, mask,
          meta: tone === "chit" && chitOn ? streak + "d" : tone === "diamond" ? (diamond ? "Member" : "Upgrade") : "",
          metaInk: tone === "diamond" ? (diamond ? "var(--ink-4,#7C7C8C)" : "var(--accent,#FF5672)") : "var(--status-chit,#FF9F45)",
          bg: on ? "var(--overlay-2,rgba(255,255,255,.09))" : "transparent",
          ink: tone === "danger" ? "var(--status-danger,#F5493D)" : tone === "diamond" ? "var(--accent,#FF5672)" : tone === "chit" ? "var(--status-chit,#FF9F45)" : on ? "var(--ink,#ECECF1)" : "var(--ink-3,#8A8A99)",
          labelInk: tone === "danger" ? "var(--status-danger,#F5493D)" : on ? "var(--ink,#ECECF1)" : "var(--ink-2,#B9B9C6)",
          weight: on ? 600 : 500,
          onPress: key === "diamond" ? () => this._close(p.onDiamond) : key === "logout" ? () => this.setState({ loOpen: true, loBusy: false }) :  () => this.setState({ section: key, editing: null }),
        };
      }),
    }));

    const fields = FIELDS.map((f, i) => {
      const editing = st.editing === f.key;
      const value = vals[f.key];
      const err = editing ? this._validate(f.key, st.draft) : null;
      const empty = !value;
      return {
        label: f.label, max: f.max, placeholder: f.placeholder ?? "",
        mono: !!f.mono, isArea: !!f.area, isLine: !f.area,
        idle: !editing, editing,
        divider: i === 0 ? "none" : "1px solid var(--line-1,rgba(255,255,255,.07))",
        display: empty ? (f.placeholder ?? "") : f.mono ? "@" + value : value,
        ink: empty ? "var(--ink-4,#6E6E7C)" : f.area ? "var(--ink-2,#B9B9C6)" : "var(--ink,#ECECF1)",
        font: f.mono ? "var(--weight-medium) 12.5px/1 var(--font-mono)" : "var(--weight-medium) 13px/1.35 var(--font-sans)",
        draft: editing ? st.draft : "",
        count: f.area && editing ? st.draft.length + " / " + f.max : "",
        ring: err ? "inset 0 0 0 1.5px var(--status-danger,#F5493D)" : "inset 0 0 0 1.5px var(--accent,#FF5672)",
        hint: err || f.hint,
        hintInk: err ? "var(--status-danger,#F5493D)" : "var(--ink-4,#6E6E7C)",
        saveOpacity: err ? 0.4 : 1,
        savePointer: err ? "none" : "auto",
        ref: editing ? this.fieldRef : undefined,
        onEdit: () => this.setState({ editing: f.key, draft: value }),
        onInput: e => this.setState({ draft: e.target.value }),
        onKey: e => {
          if (e.key === "Escape") { e.stopPropagation(); this.setState({ editing: null, draft: "" }); }
          else if (e.key === "Enter" && (!f.area || e.metaKey || e.ctrlKey)) { e.preventDefault(); this._save(); }
        },
        onCancel: () => this.setState({ editing: null, draft: "" }),
        onSave: () => this._save(),
      };
    });

    const userId = p.userId ?? "5sj6i-pqaaa-aaaaf-a3cmq-cai";
    return {
      mode, m: M, nav,
      name: vals.name || vals.handle, handle: vals.handle,
      avatar: p.avatar || "linear-gradient(140deg,#ff5f9e,#6a2bff)",
      cover: p.cover || "var(--cover-pattern)",
      isVerified: verified, showVerify: !verified,
      isDiamond: diamond, showDiamond: !diamond,
      showChitTag: (p.chitEnabled ?? true) !== false,
      chitTag: balance >= 1e6 ? +(balance / 1e6).toFixed(1) + "M" : balance >= 1e3 ? +(balance / 1e3).toFixed(1) + "K" : String(balance),
      chitTagTitle: balance.toLocaleString("en-US") + " CHIT",
      onChitTag: () => this.setState({ section: "chit" }),
      isProfile: section === "profile", isStats: section === "stats", isChit: section === "chit",
      isChats: section === "chats",
      isCommunities: section === "communities",
      isSignin: section === "signin",
      isAppearance: section === "appearance",
      isStorage: section === "storage", isBots: section === "bots", isDevice: section === "device", isDelete: section === "delete", isAbout: section === "about", isInvite: section === "invite",
      isOther: !["profile", "stats", "chit", "chats", "communities", "signin", "appearance", "storage", "bots", "device", "delete", "about", "invite"].includes(section),
      platform: p.platform ?? "Web",
      aboutInk: section === "about" ? "var(--ink,#ECECF1)" : "var(--ink-4,#6E6E7C)",
      aboutBg: section === "about" ? "var(--overlay-2,rgba(255,255,255,.08))" : "transparent",
      onAbout: () => this.setState({ section: "about", editing: null }),
      aboutGroups: (() => {
        const L = { architecture: ["Architecture", M.layers], blog: ["Blog", M.news], faq: ["FAQ", M.info], features: ["Features", M.sparkle], guidelines: ["Guidelines", M.shield], metrics: ["Metrics", M.stats], roadmap: ["Roadmap", M.map], whitepaper: ["Whitepaper", M.file] };
        const rows = ks => ks.map((k, i) => ({ href: "https://oc.app/" + k, label: L[k][0], mask: L[k][1], divider: i ? "1px solid var(--line-1,rgba(255,255,255,.07))" : "none" }));
        return [
          { label: "THE PRODUCT", rows: rows(["features", "roadmap", "metrics"]) },
          { label: "HOW IT WORKS", rows: rows(["architecture", "whitepaper", "faq"]) },
          { label: "COMMUNITY", rows: rows(["blog", "guidelines"]) },
        ];
      })(),
      ...this._delete(streak, balance),
      ...this._link(),
      botRows: this._botRows(),
      ...this._storage(diamond),
      ...this._appearance(),
      ...this._signin(),
      ...this._communities(vals.name || vals.handle),
      ...this._chatVals(),
      ...this._chit(section),
      ...this._stats(),
      sectionTitle: TITLES[section] ?? "Profile",
      streakLabel: streak + "-day streak",
      balanceLabel: balance.toLocaleString("en-US") + " CHIT",
      chitHint: claimable ? "Claim today" : "Claimed today",
      fields,
      memberSince: p.memberSince ?? "1 Nov 2021",
      userId,
      copyMask: st.copied ? M.check : M.copy,
      copyInk: st.copied ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#8A8A99)",
      copyTitle: st.copied ? "Copied" : "Copy user ID",
      onCopy: () => {
        try { navigator.clipboard && navigator.clipboard.writeText(userId); } catch (_) {}
        clearTimeout(this._c); this.setState({ copied: true });
        this._c = setTimeout(() => this.setState({ copied: false }), 1400);
      },
      onChit: openChit,
      onCoverEdit: () => { if (p.onCoverEdit) p.onCoverEdit(diamond); },
      onPhotoEdit: () => { if (p.onPhotoEdit) p.onPhotoEdit(); },
      onVerify: () => { if (p.onVerify) p.onVerify(); },
      onDiamond: () => this._close(p.onDiamond),
      onShare: () => { if (p.onShare) p.onShare(); },
      onLogout: () => this.setState({ loOpen: true, loBusy: false }),
      loOpen: !!st.loOpen,
      loProvider: p.signInProvider ?? "your passkey",
      loLabel: st.loBusy ? "Logging out…" : "Log out",
      loMask: st.loBusy ? M.refresh : (M.logout ?? M.chevRight),
      loSpin: st.loBusy ? "oc-spin 0.8s linear infinite" : "none",
      loCursor: st.loBusy ? "default" : "pointer", loCancelOpacity: st.loBusy ? 0.5 : 1,
      onLoCancel: () => { if (!st.loBusy) this.setState({ loOpen: false }); },
      onLoConfirm: () => {
        if (st.loBusy) return;
        this.setState({ loBusy: true });
        this._lo = setTimeout(() => { this.setState({ loOpen: false, loBusy: false }); this._close(p.onLogout ?? p.onClose); }, 900);
      },
      onCancel: () => this._close(p.onClose),
      version: p.version ?? "2.0.2054",
      onShareApp: () => this.setState({ section: "invite", editing: null }),
      ...this._invite(),
      subVeil: IN_VEIL, subCard: IN_CARD,
      veilAnim: st.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: st.closing ? OUT_CARD : IN_CARD,
    };
  }
}

export default Component;

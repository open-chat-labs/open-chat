// Logic for InviteDialog.svelte — carried over from lib/InviteDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  slate: "linear-gradient(140deg,#8E9BB3,#5A6478)",
  plum: "linear-gradient(140deg,#b06bff,#6a2bff)",
};

const PEOPLE = [
  { name: "Emma Kovacs", handle: "@emma_kovacs", color: "plum" },
  { name: "Sam Okafor", handle: "@sam_okafor", color: "blue" },
  { name: "Robert Lang", handle: "@robert_lang", color: "slate" },
  { name: "Alice Anderson", handle: "@alice_anderson", color: "violet", frequent: true },
  { name: "Lucy Linden", handle: "@lucy_linden", color: "teal", frequent: true },
  { name: "Priya Raman", handle: "@priya_raman", color: "amber", frequent: true },
  { name: "Danielle Moreau", handle: "@danielle_m", color: "blue", frequent: true },
  { name: "Jonah Weiss", handle: "@jonah_weiss", color: "violet", frequent: true },
  { name: "Nadia Rahman", handle: "@nadia_r", color: "teal" },
  { name: "Otto Lindqvist", handle: "@otto_l", color: "blue" },
  { name: "Marcus Webb", handle: "@marcus_webb", color: "amber" },
  { name: "Sofia Castellanos", handle: "@sofia_c", color: "violet" },
  { name: "Ravi Menon", handle: "@ravi_menon", color: "teal" },
];

const PENDING = [
  { title: "Tom Beckett", handle: "@tom_beckett", color: "blue" },
  { title: "Ines Duarte", handle: "@ines_duarte", color: "plum" },
  { title: "Karl Osei", handle: "@karl_osei", color: "slate" },
];

const SAMPLE_CHATS = [
  { name: "Lucy Linden", kind: "Direct chat", grad: "linear-gradient(140deg,#2EE6A8,#1FB6FF)" },
  { name: "Design Guild", kind: "Group · 112 members", grad: "linear-gradient(140deg,#b06bff,#5b2a86)", radius: "11px" },
  { name: "Matt Rivers", kind: "Direct chat", grad: "linear-gradient(140deg,#ffb03d,#ff4d4d)" },
];
class Component extends DCLogic {
  componentDidUpdate(prev) {
    if (this.props.onDirtyChange && this._reportedDirty !== this._dirtyNow) { this._reportedDirty = this._dirtyNow; this.props.onDirtyChange(!!this._dirtyNow); }
    // embedded: the host can re-point the open page at another tab
    if (this.props.embedded && prev.initialTab !== this.props.initialTab && this.props.initialTab) {
      const keys = this.props.canAdd ? ["add", "invite", "share"] : ["invite", "share"];
      const w = this.props.initialTab;
      const k = w === "share" ? "share" : w === "invite" ? "invite" : this.props.canAdd ? "add" : "invite";
      this.setState({ tab: Math.max(0, keys.indexOf(k)) });
    }
  }

  constructor(props) {
    super(props);
    const keys = props.canAdd ? ["add", "invite", "share"] : ["invite", "share"];
    const want = props.initialTab ?? "people";
    const k = want === "share" ? "share" : want === "invite" ? "invite" : props.canAdd ? "add" : "invite";
    this.state = {
      tab: Math.max(0, keys.indexOf(k)),
      addQuery: "", addPicked: [],
      query: "",
      picked: [],
      shareOn: props.shareOn ?? true,
    };
  }

  _toggleAdd(handle) {
    this.setState(st => ({
      addPicked: st.addPicked.indexOf(handle) === -1 ? st.addPicked.concat([handle]) : st.addPicked.filter(h => h !== handle),
    }));
  }

  _toggle(handle) {
    this.setState(st => ({
      picked: st.picked.indexOf(handle) === -1 ? st.picked.concat([handle]) : st.picked.filter(h => h !== handle),
    }));
  }

  renderVals() {
    const s = this.state;
    const q = s.query.trim().toLowerCase();
    const closeMask = "var(--icon-close) center/contain no-repeat";
    const checkMask = "var(--icon-check) center/contain no-repeat";
    const plusMask = "var(--icon-plus) center/contain no-repeat";
    const keys = this.props.canAdd ? ["add", "invite", "share"] : ["invite", "share"];
    const key = keys[s.tab] || keys[0];
    const members = this.props.communityMembers || [];
    const inCh = this.props.inChannel || [];
    const aq = s.addQuery.trim().toLowerCase();
    const addPool = (aq ? members.filter(p => (p.name + " " + p.handle).toLowerCase().indexOf(aq) !== -1) : members).slice(0, 30);
    const outside = aq ? PEOPLE.find(p => !members.some(m => m.handle === p.handle) && (p.name + " " + p.handle).toLowerCase().indexOf(aq) !== -1) : null;
    const communityName = this.props.communityName ?? "the community";
    const chanName = this.props.groupName ?? "#channel";
    const pool = q
      ? PEOPLE.filter(p => (p.name + " " + p.handle).toLowerCase().indexOf(q) !== -1)
      : PEOPLE.filter(p => p.frequent);

    const embedded = !!this.props.embedded;
    this._dirtyNow = s.picked.length > 0 || s.addPicked.length > 0;
    return {
      copyLink: () => { try { navigator.clipboard && navigator.clipboard.writeText("https://" + (this.props.shareLink ?? "")); } catch (e) {} this.setState({ linkCopied: true }); clearTimeout(this._lc); this._lc = setTimeout(() => this.setState({ linkCopied: false }), 1600); },
      copyTitle: this.state.linkCopied ? "Copied" : "Copy link",
      copyNowMask: this.state.linkCopied ? "var(--icon-check) center/contain no-repeat" : "var(--icon-copy) center/contain no-repeat",
      copyInk: this.state.linkCopied ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#9A9AA8)",
      pickerOpen: !!this.state.picker, openPicker: () => this.setState({ picker: true }), closePicker: () => this.setState({ picker: false }),
      pickerItem: { title: "Invite link", sub: this.props.shareLink ?? "", icon: "link" },
      pickerChats: this.props.chats || SAMPLE_CHATS,
      onPickerSend: x => { const id = Date.now(); this.setState({ picker: false, sentToast: { id, text: "Invite link sent to " + x.chat } }); clearTimeout(this._st); this._st = setTimeout(() => this.setState(st => st.sentToast && st.sentToast.id === id ? { sentToast: null } : null), 4000); if (this.props.onShareToChat) this.props.onShareToChat(x); },
      hasSentToast: !!this.state.sentToast, sentToast: this.state.sentToast ? this.state.sentToast.text : "", sentToastKey: this.state.sentToast ? String(this.state.sentToast.id) : "",
      closeSentToast: () => this.setState({ sentToast: null }),
      // embedded: the Invite page of the Manage dialog
      notEmbedded: !embedded, isEmbedded: embedded,
      // without invite permission the page is view-only: no send / add footer
      // embedded Share link has no action, so no footer bar either
      showFooter: (this.props.canInvite ?? true) && !(embedded && key === "share"),
      rootPos: embedded ? "absolute" : "fixed",
      rootPad: embedded ? "0" : "var(--space-22)",
      cardMax: embedded ? "none" : "640px",
      cardH: embedded ? "100%" : "min(700px,100%)",
      cardRadius: embedded ? "0" : "var(--radius-xl)",
      cardShadow: embedded ? "none" : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 30px 70px rgba(0,0,0,.45)",
      none: [],
      groupName: this.props.groupName ?? "This group",
      addUserMask: "var(--icon-invite) center/contain no-repeat",
      closeMask,
      warnMask: "var(--icon-warning) center/contain no-repeat",
      copyMask: "var(--icon-copy) center/contain no-repeat",

      tabLabels: keys.map(k => k === "add" ? "Add from community" : k === "invite" ? "Invite people" : "Share link"),
      tabCounts: keys.map(k => k === "add" ? (s.addPicked.length || null) : k === "invite" ? (s.picked.length || null) : null),
      tab: s.tab,
      onTab: i => this.setState({ tab: i }),
      isAddTab: key === "add",
      isPeopleTab: key === "invite",
      isShareTab: key === "share",
      dialogTitle: this.props.canAdd ? "Add or invite people" : "Invite people",
      communityName,
      plusMask,
      addPlaceholder: "Search " + communityName + " members",
      addQuery: s.addQuery,
      onAddQuery: e => this.setState({ addQuery: e.target.value }),
      onClearAddQuery: () => this.setState({ addQuery: "" }),
      addListLabel: aq ? "SEARCH RESULTS" : communityName.toUpperCase() + " MEMBERS",
      hasAddPicked: s.addPicked.length > 0,
      addPickedLabel: "SELECTED · " + s.addPicked.length,
      onClearAddAll: () => this.setState({ addPicked: [] }),
      addPicked: s.addPicked.map(h => {
        const u = members.find(p => p.handle === h) || { handle: h, color: "violet" };
        return { handle: u.handle, gradient: GRADIENTS[u.color] || GRADIENTS.slate, onToggle: () => this._toggleAdd(h) };
      }),
      addPeople: addPool.map(u => {
        const inChannel = inCh.indexOf(u.handle) !== -1;
        const sel = s.addPicked.indexOf(u.handle) !== -1;
        return {
          name: u.name, handle: u.handle, gradient: GRADIENTS[u.color] || GRADIENTS.slate,
          color: u.color || "slate", sel, badge: inChannel ? "IN CHANNEL" : "",
          inChannel, canPick: !inChannel,
          onToggle: () => { if (!inChannel) this._toggleAdd(u.handle); },
          cursor: inChannel ? "default" : "pointer", opacity: inChannel ? 0.55 : 1,
          hoverBg: inChannel ? "transparent" : "var(--overlay-1,rgba(255,255,255,.05))",
          rowBg: sel ? "color-mix(in srgb, var(--accent,#FF5672) 8%, transparent)" : "transparent",
          addBg: sel ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.07))",
          addLine: sel ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
          addInk: sel ? "var(--on-accent,#2E0512)" : "var(--ink-3,#9A9AA8)",
          addMask: sel ? checkMask : plusMask,
        };
      }),
      addNoResults: !!aq && addPool.length === 0,
      outsideMatch: !!outside,
      inviteInstead: () => this.setState({ tab: keys.indexOf("invite"), query: s.addQuery }),
      addNote: s.addPicked.length + (s.addPicked.length === 1 ? " person selected" : " people selected"),
      addCtaLabel: "Add to " + chanName,
      addCtaBg: s.addPicked.length ? "var(--accent,#FF5672)" : "var(--overlay-1,rgba(255,255,255,.05))",
      addCtaInk: s.addPicked.length ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      addCtaCursor: s.addPicked.length ? "pointer" : "not-allowed",
      onAdd: () => {
        if (s.addPicked.length && this.props.onAdd) this.props.onAdd(s.addPicked.slice());
        if (embedded) this.setState({ addPicked: [], addQuery: "" });
      },

      query: s.query,
      onQuery: e => this.setState({ query: e.target.value }),
      onClearQuery: () => this.setState({ query: "" }),
      noResults: !!q && pool.length === 0,
      listLabel: q ? "SEARCH RESULTS" : "FREQUENTLY CONTACTED",
      pickedLabel: "SELECTED · " + s.picked.length,
      hasPicked: s.picked.length > 0,
      onClearAll: () => this.setState({ picked: [] }),
      picked: s.picked.map(h => {
        const u = PEOPLE.find(p => p.handle === h) || { handle: h, color: "violet" };
        return { handle: u.handle, gradient: GRADIENTS[u.color], onToggle: () => this._toggle(h) };
      }),
      people: pool.map(u => {
        const sel = s.picked.indexOf(u.handle) !== -1;
        return {
          name: u.name,
          handle: u.handle,
          gradient: GRADIENTS[u.color],
          color: u.color, sel,
          onToggle: () => this._toggle(u.handle),
          rowBg: sel ? "color-mix(in srgb, var(--accent,#FF5672) 8%, transparent)" : "transparent",
          addBg: sel ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.07))",
          addLine: sel ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
          addInk: sel ? "var(--on-accent,#2E0512)" : "var(--ink-3,#9A9AA8)",
          addMask: sel ? checkMask : plusMask,
        };
      }),
      pendingUsers: PENDING.map(u => ({ ...u, gradient: GRADIENTS[u.color] })),
      hasPending: PENDING.length > 0 && !q,
      pendingLabel: "PENDING · " + PENDING.length,

      shareOn: s.shareOn,
      onShareOn: v => this.setState({ shareOn: v }),
      noun: this.props.noun ?? "group",
      shareHeading: "SHARE " + String(this.props.noun ?? "group").toUpperCase() + " VIA LINK",
      shareLink: this.props.shareLink ?? ("oc.app/group/" + String(this.props.groupName ?? "the awesome group").toLowerCase().replace(/^#/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-8f2a"),

      cancelLabel: key === "share" ? "Done" : "Cancel",
      sendNote: s.picked.length + (s.picked.length === 1 ? " person selected" : " people selected"),
      sendBg: s.picked.length ? "var(--accent,#FF5672)" : "var(--overlay-1,rgba(255,255,255,.05))",
      sendInk: s.picked.length ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      sendCursor: s.picked.length ? "pointer" : "not-allowed",
      onCancel: () => { if (embedded && this.props.onClose) this.props.onClose(); else if (this.props.onCancel) this.props.onCancel(); },
      onSend: () => {
        if (!s.picked.length) return;
        if (this.props.onInvite) this.props.onInvite(s.picked.slice());
        if (embedded) this.setState({ picked: [], query: "" });
      },
    };
  }
}

export default Component;

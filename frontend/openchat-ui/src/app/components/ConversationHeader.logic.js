// Logic for ConversationHeader.svelte — carried over from lib/ConversationHeader.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const LOCK_OPEN = "var(--icon-lock-open) center/contain no-repeat";
const LOCK_CLOSED = "var(--icon-lock) center/contain no-repeat";
const VIDEO_MASK = "var(--icon-video) center/contain no-repeat";
const INVITE_MASK = "var(--icon-invite) center/contain no-repeat";
const INK = "regular", DANGER = "danger";
const CHANNEL_MENU = [
  { label: "Add to favourites", mask: "var(--icon-heart) center/contain no-repeat", variant: INK },
  { label: "Copy URL", mask: "var(--icon-link) center/contain no-repeat", variant: INK },
  { label: "Mute notifications", mask: "var(--icon-bell-off) center/contain no-repeat", variant: INK },
  { label: "Mute @everyone", mask: "var(--icon-at) center/contain no-repeat", variant: INK },
  { label: "Leave channel", mask: "var(--icon-exit) center/contain no-repeat", variant: DANGER },
];
const COLLAPSE_VW = 1280;
const COLLAPSED_ACTIONS = [
  { label: "View pinned messages", mask: "var(--icon-pin) center/contain no-repeat", variant: "regular", maxVw: COLLAPSE_VW },
  { label: "Members", mask: "var(--icon-users) center/contain no-repeat", variant: "regular", maxVw: COLLAPSE_VW },
];
const GROUP_MENU = CHANNEL_MENU.map(i => (i.label === "Leave channel" ? { ...i, label: "Leave group" } : i));
const DEFAULT_MENU = [
  CHANNEL_MENU[0],
  CHANNEL_MENU[1],
  CHANNEL_MENU[2],
  { label: "Block user", mask: "var(--icon-ban) center/contain no-repeat", variant: DANGER },
  { label: "Delete chat", mask: "var(--icon-trash) center/contain no-repeat", variant: DANGER },
];

class Component extends DCLogic {
  state = { menuOpen: false, vw: typeof window === "undefined" ? 1920 : window.innerWidth };
  _menuRef = React.createRef();

  componentDidMount() {
    this._away = e => {
      if (!this.state.menuOpen) return;
      const el = this._menuRef.current;
      if (el && el.contains(e.target)) return;
      this.setState({ menuOpen: false });
    };
    this._esc = e => { if (e.key === "Escape" && this.state.menuOpen) this.setState({ menuOpen: false }); };
    this._onResize = () => this.setState({ vw: window.innerWidth });
    window.addEventListener("resize", this._onResize);
    document.addEventListener("click", this._away, true);
    document.addEventListener("keydown", this._esc);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("click", this._away, true);
    document.removeEventListener("keydown", this._esc);
  }

  renderVals() {
    const vw = this.state.vw;
    const online = this.props.online ?? true;
    const kind = this.props.kind ?? "user";
    const isChannel = kind === "channel";
    const isGroup = kind === "group";
    const many = isChannel || isGroup;
    // pinned lives in a strip above the messages, members in the side panel
    const actions = this.props.actions ?? ["search"];
    const fav = !!this.props.isFavourite;
    const chanMenu = [
      { label: "Invite", mask: INVITE_MASK },
      { ...CHANNEL_MENU[0], label: fav ? "Remove from favourites" : "Add to favourites" },
      CHANNEL_MENU[1],
      CHANNEL_MENU[4],
    ];
    const base = this.props.menuItems ?? (isChannel ? chanMenu : (isGroup ? GROUP_MENU : DEFAULT_MENU));
    const items = base;
    return {
      title: (isChannel ? "#" : "") + (this.props.title ?? "Danielle Moreau"),
      color: this.props.color ?? "violet",
      avatarShape: isGroup ? "squircle" : "circle",
      online,
      showPresenceDot: online && kind === "user",
      verified: (this.props.verified ?? false) && kind === "user",
      presence: this.props.presence || ((isChannel || isGroup)
        ? (this.props.visibility ?? "Public") + " · " + (this.props.memberCount ?? 248) + " members"
        : (online ? "Online" : "Last seen 2h ago")),
      presenceColor: (online && kind === "user") ? "var(--status-online,#2EE6A8)" : "var(--ink-3,#8A8A99)",
      actions: actions
        .map(a => (typeof a === "string" ? { icon: a } : a))
        .filter(a => (a.minVw == null || vw >= a.minVw) && (a.maxVw == null || vw < a.maxVw))
        .map(a => ({ ...a, onPress: a.onPress ?? (this.props.actionHandlers ?? {})[a.icon] })),
      showCall: (this.props.showCall ?? true) && !isChannel,
      showHash: false,
      showInlineLock: many && !!this.props.visibility,
      lockMask: (this.props.visibility ?? "Public") === "Private" ? LOCK_CLOSED : LOCK_OPEN,
      lockColor: (this.props.visibility ?? "Public") === "Private" ? "var(--status-danger,#F5493D)" : "var(--status-online,#2EE6A8)",
      showMenu: this.props.showMenu ?? true,
      openDetails: this.props.openDetails,
      // Modal model: the name opens the group itself (chevron cue); a separate toggle shows the side panel
      showChevron: !!this.props.titleChevron,
      // your own states for this chat, shown only when on
      statusFav: !!this.props.statusFav,
      statusMuted: !!this.props.statusMuted,
      statusEveryone: !!this.props.statusEveryone,
      hasStatus: !!(this.props.statusFav || this.props.statusMuted || this.props.statusEveryone),
      statusMutedTitle: ({ "8h": "Muted for 8 hours", "1w": "Muted for 1 week" })[this.props.statusMuted] || "Notifications muted",
      statusHeartMask: "var(--icon-heart-filled) center/contain no-repeat",
      statusBellOffMask: "var(--icon-bell-off) center/contain no-repeat",
      statusAtOffMask: "var(--icon-at-off) center/contain no-repeat",
      titleHint: this.props.titleHint || undefined,
      chevMask: "var(--icon-chevron-down) center/contain no-repeat",
      showPanelToggle: !!this.props.onTogglePanel,
      onTogglePanel: this.props.onTogglePanel,
      panelOpen: !!this.props.panelOpen,
      panelHint: this.props.panelOpen ? "Hide side panel" : "Show side panel",
      panelBg: this.props.panelOpen ? "var(--btn-hover,rgba(255,255,255,.1))" : "transparent",
      panelInk: this.props.panelOpen ? "var(--ink,#ECECF1)" : "var(--ink-2,#B9B9C6)",
      panelMask: "var(--icon-panel) center/contain no-repeat",
      menuRef: this._menuRef,
      menuOpen: this.state.menuOpen,
      toggleMenu: () => this.setState(s => ({ menuOpen: !s.menuOpen })),
      menuItems: items.map(it => ({
        ...it,
        onSelect: it.onSelect
          ? () => { this.setState({ menuOpen: false }); it.onSelect(); }
          : /^leave/i.test(it.label || "")
          ? () => {
              this.setState({ menuOpen: false });
              // dialogs are rendered by the host: every DC mount wrapper sets
              // container-type, which would trap a position:fixed dialog in this column
              if (this.props.onLeave) this.props.onLeave();
            }
          : () => { this.setState({ menuOpen: false }); if (this.props.onMenu) this.props.onMenu(it.label); },
      })),
      callLabel: this.props.callLabel ?? "Video call",
      onCall: this.props.onCall, onVoiceCall: this.props.onVoiceCall,
      videoMask: "var(--icon-video) center/contain no-repeat",
    };
  }
}

export default Component;

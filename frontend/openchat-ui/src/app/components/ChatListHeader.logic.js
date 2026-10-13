// Logic for ChatListHeader.svelte — carried over from lib/ChatListHeader.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const I = {
  users: "var(--icon-users) center/contain no-repeat",
  edit: "var(--icon-edit) center/contain no-repeat",
  plus: "var(--icon-plus) center/contain no-repeat",
  embed: "var(--icon-embed) center/contain no-repeat",
  check: "var(--icon-check-double) center/contain no-repeat",
  bellOff: "var(--icon-bell-off) center/contain no-repeat",
  at: "var(--icon-at) center/contain no-repeat",
  exit: "var(--icon-exit) center/contain no-repeat",
  invite: "var(--icon-invite) center/contain no-repeat",
  group: "var(--icon-group) center/contain no-repeat",
};

const LOCK_OPEN = "var(--icon-lock-open) center/contain no-repeat";
const LOCK_CLOSED = "var(--icon-lock) center/contain no-repeat";

const DMS_MENU = [
  { label: "Create new group", mask: I.group },
  { label: "Mark all as read", mask: I.check },
];

const COMMUNITY_MENU = [
  { label: "Members", mask: I.users },
  { label: "Invite", mask: I.invite },
  { label: "Edit community", mask: I.edit },
  { label: "New channel", mask: I.plus },
  { label: "Add embedded channel", mask: I.embed },
  { label: "Mark all as read", mask: I.check },
  { label: "Leave community", mask: I.exit, variant: "danger" },
];

class Component extends DCLogic {
  state = { menuOpen: false };
  _menuRef = React.createRef();

  componentDidMount() {
    this._away = e => {
      if (!this.state.menuOpen) return;
      const el = this._menuRef.current;
      if (el && el.contains(e.target)) return;
      this.setState({ menuOpen: false });
    };
    this._esc = e => { if (e.key === "Escape" && this.state.menuOpen) this.setState({ menuOpen: false }); };
    document.addEventListener("click", this._away, true);
    document.addEventListener("keydown", this._esc);
  }

  componentWillUnmount() {
    document.removeEventListener("click", this._away, true);
    document.removeEventListener("keydown", this._esc);
  }

  renderVals() {
    const kind = this.props.kind ?? "dms";
    const isCommunity = kind === "community";
    const visibility = this.props.visibility ?? "Public";
    const members = this.props.memberCount ?? 248;
    const items = this.props.menuItems ?? (isCommunity ? COMMUNITY_MENU : DMS_MENU);
    return {
      isPlain: !isCommunity,
      isCommunity,
      title: this.props.title ?? (isCommunity ? "Design Guild" : "Chats"),
      color: this.props.color ?? "teal",
      meta: this.props.meta ?? (visibility + " · " + members + " members"),
      lockMask: visibility === "Private" ? LOCK_CLOSED : LOCK_OPEN,
      lockColor: visibility === "Private" ? "var(--status-danger,#F5493D)" : "var(--status-online,#2EE6A8)",
      openDetails: this.props.openDetails,
      menuRef: this._menuRef,
      menuOpen: this.state.menuOpen,
      menuWidth: isCommunity ? "246px" : "200px",
      toggleMenu: () => this.setState(s => ({ menuOpen: !s.menuOpen })),
      isDiamond: this.props.isDiamond ?? true,
      menuItems: items.map(it => ({
        ...it,
        onSelect: it.onSelect ? () => { this.setState({ menuOpen: false }); it.onSelect(); }
          : /^create new group$/i.test(it.label || "")
          ? () => {
              this.setState({ menuOpen: false });
              // the host renders the dialog; a container-type mount wrapper here
              // would trap its position:fixed layout inside the list column
              if (this.props.onCreateGroup) this.props.onCreateGroup();
            }
          : () => { this.setState({ menuOpen: false }); if (this.props.onMenu) this.props.onMenu(it.label); },
      })),
    };
  }
}

export default Component;

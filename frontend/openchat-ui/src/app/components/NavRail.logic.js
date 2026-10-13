// Logic for NavRail.svelte — carried over from lib/NavRail.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const FLAME = "var(--icon-flame) center/contain no-repeat";

// nav item keys → canonical names in lib/icons.js
const ICONS = {
  "messages": "messages",
  "bell": "bell",
  "wallet": "wallet",
  "chit": "zap",
  "heart": "heart"
};

const DEFAULT_ITEMS = [
  { icon: "messages", label: "DM & Group Chats", dot: true, count: 3 },
  { icon: "bell", label: "Notifications" },
  { icon: "wallet", label: "Wallet" },
];

const GRADIENTS = {
  sunset: "linear-gradient(140deg,#ff8a3d,#ff2d74)",
  blue: "linear-gradient(140deg,#3d7bff,#7a3dff)",
  teal: "linear-gradient(140deg,#2ee6a8,#1f8fbf)",
  plum: "linear-gradient(140deg,#b04dff,#4d2dff)",
};

const DEFAULT_PINS = [
  { color: "sunset", name: "Community 01" },
  { color: "blue", name: "Community 02" },
  { color: "teal", name: "Community 03", dot: true },
  { color: "plum", name: "Community 04" },
];

class Component extends DCLogic {
  state = { active: null, activePin: undefined, expanded: null, barTop: null };
  rootRef = React.createRef();

  syncBar() {
    const root = this.rootRef.current;
    if (!root) return;
    const row = root.querySelector("[data-active-row]");
    const top = row
      ? Math.round(row.getBoundingClientRect().top - root.getBoundingClientRect().top) + 7
      : null;
    if (top !== this.state.barTop) this.setState({ barTop: top });
  }
  componentDidMount() {
    this.syncBar();
    // when the host gives the rail a fixed slot, the expanded rail floats over the content:
    // treat it as temporary and close it on an outside click or a pick
    this._away = e => {
      if (!this._overlaying()) return;
      const r = this.rootRef.current;
      if (r && !r.contains(e.target)) this.setState({ expanded: false });
    };
    document.addEventListener("pointerdown", this._away, true);
  }
  componentWillUnmount() { document.removeEventListener("pointerdown", this._away, true); }
  _overlaying() {
    const r = this.rootRef.current, slot = r && r.closest("[data-rail-slot]");
    const expanded = this.state.expanded === null ? (this.props.expanded ?? false) : this.state.expanded;
    return !!(expanded && slot && slot.getBoundingClientRect().width < 200);
  }
  _pick() { if (this._overlaying()) this.setState({ expanded: false }); }
  componentDidUpdate(prevProps) {
    // let Tweaks changes win over local click state
    if (prevProps.expanded !== this.props.expanded && this.state.expanded !== null) {
      this.setState({ expanded: null });
    }
    if (prevProps.activeIndex !== this.props.activeIndex && this.state.active !== null) {
      this.setState({ active: null, activePin: undefined });
    }
    if (prevProps.activePin !== this.props.activePin && this.state.activePin !== undefined) {
      this.setState({ activePin: undefined });
    }
    this.syncBar();
  }
  renderVals() {
    const items = this.props.items ?? DEFAULT_ITEMS;
    const pins = this.props.pins ?? DEFAULT_PINS;
    const pinIndex = this.props.activePin !== undefined
      ? this.props.activePin
      : (this.state.activePin ?? null);
    const active = pinIndex !== null ? -1 : (this.state.active ?? (this.props.activeIndex ?? 0));
    const expanded = this.state.expanded === null ? (this.props.expanded ?? false) : this.state.expanded;
    const exploring = !!this.props.exploreActive;
    return {
      onExplore: this.props.onExplore,
      exploreActiveAttr: exploring ? "" : undefined,
      exploreBg: exploring ? "var(--accent-soft,rgba(255,86,114,.07))" : "transparent",
      exploreInk: exploring ? "var(--accent,#FF5672)" : "var(--ink-3,#7C7C8C)",
      exploreLabelInk: exploring ? "var(--ink,#ECECF1)" : "var(--ink-3,#8A8A99)",
      eyeMask: "var(--icon-eye) center/contain no-repeat",
      plusMask: "var(--icon-plus) center/contain no-repeat",
      onCreateCommunity: this.props.onCreateCommunity,
      profileLabel: this.props.profileLabel ?? "Profile",
      profileHandle: this.props.profileHandle ?? "@you",
      rootRef: this.rootRef,
      barTop: (this.state.barTop ?? 13) + "px",
      barOpacity: this.state.barTop === null ? 0 : 1,
      railWidth: expanded ? "283px" : "60px",
      expandedAttr: expanded ? "true" : "false",
      labelOpacity: expanded ? 1 : 0,
      dotOpacity: expanded ? 0 : 1,
      badgeMax: expanded ? "48px" : "0px",
      labelMax: expanded ? "207px" : "0px",
      pillOffset: expanded ? "10px" : "-7px",
      chevronTransform: expanded ? "rotate(180deg)" : "none",
      // CHIT is a personal action, so it never takes the destination highlight
      chitShown: (this.props.chitShown ?? true) && !this.props.guest,
      isGuest: !!this.props.guest, notGuest: !this.props.guest,
      homeHref: this.props.homeHref ?? "OpenChat Landing.dc.html",
      homeMask: "var(--icon-home) center/contain no-repeat",
      onSignIn: () => { if (this.props.onSignIn) this.props.onSignIn(); },
      keyMask: "var(--icon-key) center/contain no-repeat",
      chitMask: "var(--icon-" + ICONS.chit + ") center/contain no-repeat",
      chitStreak: String(this.props.chitStreak ?? 57),
      chitClaimable: !!(this.props.chitClaimable ?? true),
      chitInk: (this.props.chitClaimable ?? true) ? "var(--status-chit,#FF9F45)" : "var(--ink-3,#7C7C8C)",
      chitPillBg: (this.props.chitClaimable ?? true) ? "var(--status-chit-soft,rgba(255,159,69,.16))" : "var(--overlay-2,rgba(255,255,255,.09))",
      chitPillInk: (this.props.chitClaimable ?? true) ? "var(--status-chit,#FF9F45)" : "var(--ink-3,#9A9AA8)",
      chitDotOpacity: ((this.props.chitClaimable ?? true) || !!this.props.puzzleDue) && !expanded ? 1 : 0,
      chitTitle: (this.props.chitClaimable ?? true)
        ? "Claim today's CHIT · " + (this.props.chitStreak ?? 57) + " day streak"
        : "Claimed today · " + (this.props.chitStreak ?? 57) + " day streak" + (this.props.puzzleDue ? " · today's puzzle is ready" : ""),
      onChit: () => { if (this.props.onChit) this.props.onChit(); },
      onProfile: () => { if (this.props.onProfile) this.props.onProfile(); },
      toggleExpanded: () => this.setState({ expanded: !expanded }),
      pins: pins.map((p, i) => ({
        gradient: GRADIENTS[p.color] ?? GRADIENTS.blue,
        name: p.name ?? "Community",
        dot: !!p.dot,
        selected: i === pinIndex,
        ariaLabel: p.label || p.name || p.title || "Community " + (i + 1), ariaCurrent: i === pinIndex ? "page" : undefined,
        idle: i !== pinIndex,
        preview: !!p.preview,
        ring: p.preview ? "none" : "0 0 0 2px var(--bg,#07070a),0 0 0 4px var(--accent,#FF5672)",
        outline: p.preview ? "1.5px dashed var(--accent,#FF5672)" : "none",
        onPress: () => {
          this._pick();
          this.setState({ activePin: i });
          if (this.props.onSelectPin) this.props.onSelectPin(i);
        },
      })),
      items: items.map((it, i) => ({
        maskCss: "var(--icon-" + (ICONS[it.icon] ?? ICONS.messages) + ") center/contain no-repeat",
        label: it.label ?? "",
        ariaLabel: (it.label || ({ messages: "Chats", bell: "Notifications", wallet: "Wallet", chit: "CHIT rewards", heart: "Favourites" })[it.icon] || it.icon) + (it.count ? ", " + it.count + " unread" : ""),
        count: String(it.count ?? ""),
        dot: !!it.dot,
        active: i === active,
        idle: i !== active,
        onPress: () => {
          this._pick();
          this.setState({ active: i, activePin: null });
          if (this.props.onSelect) this.props.onSelect(i);
        },
      })),
    };
  }
}

export default Component;

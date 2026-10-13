// Logic for UserDialog.svelte — carried over from lib/UserDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const MESSAGE = "var(--icon-chat) center/contain no-repeat";

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  rose: "linear-gradient(140deg,#FF6B8B,#C13584)",
  plum: "linear-gradient(140deg,#B06BFF,#6A2BFF)",
  slate: "linear-gradient(140deg,#8E9BB3,#5A6478)",
};

// the same fields the DM panel shows, so one profile shape serves both surfaces
const FACTS = [
  { label: "Member since", value: "1 Nov 2021" },
  { label: "Chit earned", value: "339,400", highlight: true },
  { label: "Status", value: "Online now", dot: true },
];

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

const UD_MASKS = {
  bell: "var(--icon-bell) center/contain no-repeat",
  bellOff: "var(--icon-bell-off) center/contain no-repeat",
  heart: "var(--icon-heart) center/contain no-repeat",
  caret: "var(--icon-chevron-down) center/contain no-repeat",
};
const UD_SPANS = [
  { key: "8h", label: "For 8 hours", tile: "Muted · 8h" },
  { key: "1w", label: "For 1 week", tile: "Muted · 1w" },
  { key: "always", label: "Until I turn it back on", tile: "Muted" },
];

class Component extends DCLogic {
  state = { closing: false, tab: null, muteMenu: null, muted: undefined, fav: undefined };

  componentWillUnmount() { clearTimeout(this._t); }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  renderVals() {
    const handle = this.props.handle ?? "";
    const about = this.props.about ?? "Product designer at OpenChat. Building onboarding flows, mostly. Coffee first, replies second.";
    const facts = (this.props.facts ?? FACTS).map(f => Object.assign({ dot: false, highlight: false }, f));
    const close = () => this._close(this.props.onCancel);
    const p = this.props, s = this.state;
    // opened from the DM with this person: state pills + Profile / This chat tabs, no Message
    const dm = !!p.dmTabs && !p.isSelf;
    const tab = dm ? (s.tab ?? p.initialTab ?? "profile") : "profile";
    const muted = s.muted !== undefined ? s.muted : (p.muted ?? null);
    const fav = s.fav !== undefined ? s.fav : !!p.fav;
    const span = UD_SPANS.find(o => o.key === muted);
    const setMute = key => { this.setState({ muted: key, muteMenu: null }); if (p.onMuteChange) p.onMuteChange(key); };
    const SOFT = "var(--accent-soft,rgba(255,86,114,.1))", LINE = "var(--line-2,rgba(255,255,255,.12))", ON = "var(--accent-bright,#FF8298)";
    const dmVals = {
      dmTabs: dm, showMessage: !dm,
      showProfileTab: tab === "profile", showChatTab: tab === "chat",
      profileTop: dm ? "var(--space-10)" : "var(--space-16)",
      tabLabels: ["Profile", "This chat"], tabIndex: tab === "chat" ? 1 : 0,
      onTab: i => this.setState({ tab: i === 1 ? "chat" : "profile" }),
      mutePillLabel: span ? span.tile : "Mute",
      muteTitle: muted ? "Change or end the mute" : "Mute notifications",
      mutePillMask: muted ? UD_MASKS.bellOff : UD_MASKS.bell,
      mutePillBg: muted ? SOFT : "transparent", mutePillLine: muted ? "var(--accent,#FF5672)" : LINE, mutePillInk: muted ? ON : "var(--ink-2,#C9C9D4)",
      caretMask: UD_MASKS.caret, heartMask: UD_MASKS.heart,
      onMutePill: e => {
        const el = e && e.currentTarget, root = el && el.closest('[data-panel-root]');
        if (el && root) { const r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
          this.setState({ muteMenu: { top: (r.bottom - b.top + 6) + "px", left: Math.max(16, Math.min(r.left - b.left, b.width - 232)) + "px" } }); }
      },
      muteMenuOpen: !!s.muteMenu,
      muteMenuTop: (s.muteMenu || {}).top || "0px", muteMenuLeft: (s.muteMenu || {}).left || "0px",
      muteMenuTitle: muted ? "Muted" : "Mute notifications for",
      closeMuteMenu: () => { if (this.state.muteMenu) this.setState({ muteMenu: null }); },
      muteOptions: muted
        ? [{ label: "Unmute notifications", onSelect: () => setMute(null) }].concat(UD_SPANS.filter(o => o.key !== muted).map(o => ({ label: o.label, onSelect: () => setMute(o.key) })))
        : UD_SPANS.map(o => ({ label: o.label, onSelect: () => setMute(o.key) })),
      fav, favPillLabel: fav ? "Favourited" : "Favourite",
      favPillBg: fav ? SOFT : "transparent", favPillLine: fav ? "var(--accent,#FF5672)" : LINE, favPillInk: fav ? ON : "var(--ink-2,#C9C9D4)",
      onFavPill: () => { this.setState({ fav: !fav }); if (p.onToggleFavourite) p.onToggleFavourite(); },
      disappearOn: p.disappearOn ?? true, disappearAfter: p.disappearAfter ?? "12 hours", readReceipts: !!p.readReceipts,
      onDisappearChange: v => { if (p.onDisappearChange) p.onDisappearChange(v); },
      onReadReceiptsChange: on => { if (p.onReadReceiptsChange) p.onReadReceiptsChange(on); },
    };
    return {
      ...dmVals,
      cover: this.props.cover || "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)",
      coverActions: ["close"],
      // your own profile: nothing to message, block or favourite
      notSelf: !this.props.isSelf,
      // in a DM the favourite lives in the pill row, so the cover only closes
      coverTrailActions: this.props.isSelf || dm ? [] : ["favourite"],
      coverHandlers: { close },
      gradient: GRADIENTS[this.props.color ?? "violet"] ?? GRADIENTS.violet,
      online: this.props.online ?? true,
      title: this.props.title ?? "Alice Anderson",
      verified: this.props.verified ?? false,
      handle,
      hasHandle: !!handle,
      valueFacts: facts,
      factColumns: facts.length,
      about,
      hasAbout: !!about,
      messageMask: MESSAGE,
      onCancel: close,
      onBlock: () => this._close(this.props.onBlock ?? this.props.onCancel),
      onMessage: () => this._close(this.props.onMessage ?? this.props.onCancel),
      veilAnim: this.state.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: this.state.closing ? OUT_CARD : IN_CARD,
    };
  }
}

export default Component;

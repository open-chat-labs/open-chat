// Logic for DmPanel.svelte — carried over from lib/DmPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const M = {
  bell: "var(--icon-bell) center/contain no-repeat",
  bellOff: "var(--icon-bell-off) center/contain no-repeat",
  heart: "var(--icon-heart) center/contain no-repeat",
  caret: "var(--icon-chevron-down) center/contain no-repeat",
  clock: "var(--icon-clock) center/contain no-repeat",
  eye: "var(--icon-eye) center/contain no-repeat",
  ban: "var(--icon-ban) center/contain no-repeat",
};
const MUTE_SPANS = [
  { key: "8h", label: "For 8 hours", tile: "Muted · 8h" },
  { key: "1w", label: "For 1 week", tile: "Muted · 1w" },
  { key: "always", label: "Until I turn it back on", tile: "Muted" },
];
const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)", amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)", blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
  rose: "linear-gradient(140deg,#ff7a9c,#d6336c)", plum: "linear-gradient(140deg,#b06bff,#5b2a86)", slate: "linear-gradient(140deg,#8a93a6,#3b4252)",
};
const ON = "var(--accent-bright,#FF8298)", SOFT = "var(--accent-soft,rgba(255,86,114,.1))", LINE = "var(--line-2,rgba(255,255,255,.12))";

class Component extends DCLogic {
  state = { aboutOpen: false, muteMenu: null, menu: false, muted: undefined, fav: undefined };

  renderVals() {
    const p = this.props, s = this.state;
    const muted = s.muted !== undefined ? s.muted : (p.muted ?? null);
    const fav = s.fav !== undefined ? s.fav : !!p.fav;
    const span = MUTE_SPANS.find(o => o.key === muted);
    const handle = p.handle ?? "@alice_anderson";
    const about = p.about ?? "Product designer at OpenChat. Building onboarding flows, mostly. Coffee first, replies second.";
    const setMute = key => { this.setState({ muted: key, muteMenu: null }); if (p.onMuteChange) p.onMuteChange(key); };
    const menuItems = (p.menuItems ?? []).map(it => it.onSelect ? Object.assign({}, it, { onSelect: () => { this.setState({ menu: false }); it.onSelect(); } }) : it);
    return {
      cover: p.cover || "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)",
      coverActions: ["close"],
      coverTrailActions: menuItems.length ? ["more"] : [],
      coverHandlers: Object.assign({}, p.coverHandlers ?? {}, { more: () => this.setState(st => ({ menu: !st.menu })) }),
      menuOpen: s.menu && menuItems.length > 0, menuItems, closeMenu: () => this.setState({ menu: false }),
      avatarGradient: GRADIENTS[p.color ?? "violet"] ?? GRADIENTS.violet,
      online: p.online ?? true,
      title: p.title ?? "Alice Anderson",
      handle, hasHandle: !!handle,
      memberSince: p.memberSince ?? "Nov 2021",
      chit: p.chit ?? "339,400",
      onOpenProfile: () => { if (p.onOpenProfile) p.onOpenProfile("profile"); },
      // mute: same pill + span menu as the group side panel
      mutePillLabel: span ? span.tile : "Mute",
      muteTitle: muted ? "Change or end the mute" : "Mute notifications",
      mutePillMask: muted ? M.bellOff : M.bell,
      mutePillBg: muted ? SOFT : "transparent", mutePillLine: muted ? "var(--accent,#FF5672)" : LINE, mutePillInk: muted ? ON : "var(--ink-2,#C9C9D4)",
      caretMask: M.caret, heartMask: M.heart, banMask: M.ban,
      onMutePill: e => {
        const el = e && e.currentTarget, root = el && el.closest('[data-panel-root]');
        if (el && root) { const r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
          this.setState({ muteMenu: { top: (r.bottom - b.top + 6) + "px", left: Math.max(16, Math.min(r.left - b.left, b.width - 232)) + "px" } }); }
      },
      muteMenuOpen: !!s.muteMenu,
      muteMenuTop: (s.muteMenu || {}).top || "0px",
      muteMenuLeft: (s.muteMenu || {}).left || "0px",
      muteMenuTitle: muted ? "Muted" : "Mute notifications for",
      closeMuteMenu: () => { if (this.state.muteMenu) this.setState({ muteMenu: null }); },
      muteOptions: muted
        ? [{ label: "Unmute notifications", onSelect: () => setMute(null) }].concat(MUTE_SPANS.filter(o => o.key !== muted).map(o => ({ label: o.label, onSelect: () => setMute(o.key) })))
        : MUTE_SPANS.map(o => ({ label: o.label, onSelect: () => setMute(o.key) })),
      fav,
      favPillLabel: fav ? "Favourited" : "Favourite",
      favPillBg: fav ? SOFT : "transparent", favPillLine: fav ? "var(--accent,#FF5672)" : LINE, favPillInk: fav ? ON : "var(--ink-2,#C9C9D4)",
      onFavPill: () => { this.setState({ fav: !fav }); if (p.onToggleFavourite) p.onToggleFavourite(); },
      about, hasAbout: !!about,
      dmOnProp: p.disappearOn ?? true, afterProp: p.disappearAfter ?? "12 hours", rrProp: !!p.readReceipts,
      onDisappearChange: v => { if (p.onDisappearChange) p.onDisappearChange(v); },
      onReadReceiptsChange: on => { if (p.onReadReceiptsChange) p.onReadReceiptsChange(on); },
      onBlock: () => { if (p.onBlock) p.onBlock(); },
    };
  }
}

export default Component;

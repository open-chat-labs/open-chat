// Logic for ChatRow.svelte — carried over from lib/ChatRow.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const KEBAB = "var(--icon-kebab) center/contain no-repeat";
// Row menu: right-click opens at the cursor, the kebab (hover / focus only) anchors under itself,
// a touch long-press anchors to the row at the finger, Shift+F10 / Menu key anchors to the row. All share one ContextMenu.
class Component extends DCLogic {
  state = { hover: false, focus: false, menu: false, point: null, anchor: null, align: "end" };
  _root = React.createRef();
  _kebab = React.createRef();
  componentWillUnmount() { clearTimeout(this._lpT); }
  _openAt(point, anchor, align) { this.setState({ menu: true, point: point || null, anchor: anchor || null, align: align || "end" }); }
  _rowRect() { const r = this._root.current ? this._root.current.getBoundingClientRect() : null; return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; }
  renderVals() {
    const items = this.props.menuItems || [];
    const hasMenu = items.length > 0;
    const s = this.state;
    const kebab = hasMenu && !this._touch && (s.hover || s.focus || s.menu);
    const count = this.props.unreadCount ?? 0;
    const typing = this.props.typing ?? false;
    return {
      title: ((this.props.kind ?? "user") === "channel" ? "#" : "") + (this.props.title ?? "Alice Anderson"),
      rootRef: this._root, kebabRef: this._kebab,
      onEnter: e => { if (e && e.pointerType === "touch") return; if (hasMenu && !s.hover) this.setState({ hover: true }); },
      onLeave: () => { if (s.hover) this.setState({ hover: false }); },
      hasMenu,
      kebabW: kebab ? "14px" : "0px", kebabGap: kebab ? "var(--space-4)" : "calc(var(--space-6) * -1)",
      kebabOp: kebab ? "1" : "0", kebabPe: kebab ? "auto" : "none", kebabHidden: kebab ? undefined : "true",
      tabIndex: hasMenu ? 0 : undefined,
      focusRing: s.focusVisible ? "0 0 0 2px var(--accent,#FF5672)" : "none",
      onFocusIn: e => { if (hasMenu && this._root.current && this._root.current.contains(e.target)) this.setState({ focus: true, focusVisible: e.target === this._root.current && e.target.matches(":focus-visible") }); },
      onFocusOut: e => { if (!this._root.current || !this._root.current.contains(e.relatedTarget)) this.setState({ focus: false, focusVisible: false }); },
      onKey: e => {
        if (!hasMenu || e.target !== this._root.current) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (this.props.onClick) this.props.onClick(); }
        else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); this._openAt(null, this._rowRect(), "end"); }
      },
      // long-press (touch): 500ms hold without moving opens an anchored popover at the finger
      onPDown: e => {
        this._touch = e.pointerType === "touch";
        if (!hasMenu || !this._touch) return;
        const x = e.clientX, y = e.clientY;
        this._lpStart = { x, y };
        clearTimeout(this._lpT);
        this._lpT = setTimeout(() => { this._lpFired = true; const r = this._rowRect(); if (r) this._openAt(null, { left: x, right: x, top: r.top, bottom: r.bottom }, "start"); }, 500);
      },
      onPMove: e => { if (this._lpStart && Math.hypot(e.clientX - this._lpStart.x, e.clientY - this._lpStart.y) > 10) { clearTimeout(this._lpT); this._lpStart = null; } },
      onPUp: () => { clearTimeout(this._lpT); this._lpStart = null; },
      onContext: e => {
        if (!hasMenu) return;
        e.preventDefault(); e.stopPropagation();
        if (this._touch) { if (!s.menu) { clearTimeout(this._lpT); this._lpFired = true; const r = this._rowRect(); if (r) this._openAt(null, { left: e.clientX, right: e.clientX, top: r.top, bottom: r.bottom }, "start"); } return; }
        this._openAt({ x: e.clientX, y: e.clientY }, null);
      },
      menuPoint: s.point, menuAnchor: s.anchor, menuAlign: s.align,
      rowBg: s.menu ? "var(--overlay-1,rgba(255,255,255,.045))" : "transparent", kebabMask: KEBAB,
      kebabBg: s.menu ? "var(--overlay-2,rgba(255,255,255,.1))" : "transparent",
      toggleMenu: e => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        if (s.menu) return this.setState({ menu: false });
        const k = this._kebab.current, r = k ? k.getBoundingClientRect() : null;
        this._openAt(null, r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : this._rowRect(), "end");
      },
      closeMenu: () => this.setState({ menu: false, hover: false }),
      stop: e => e.stopPropagation(),
      menuOpen: s.menu,
      menuList: items,
      preview: this.props.preview ?? "Anyhow, let me know what you think",
      time: this.props.time ?? "10:48",
      color: this.props.color ?? "violet",
      avatarShape: (this.props.kind ?? "user") === "group" ? "squircle" : "circle",
      online: (this.props.online ?? true) && (this.props.kind ?? "user") === "user",
      verified: (this.props.verified ?? false) && (this.props.kind ?? "user") === "user",
      selected: this.props.selected ?? false,
      pinned: this.props.pinned ?? false,
      muted: this.props.muted ?? false,
      // favourites have their own section; the list only flags mute (it explains the quiet badge)
      fav: false,
      // a long-press must not also open the chat
      onSelect: e => { if (this._lpFired) { this._lpFired = false; if (e) e.stopPropagation(); return; } if (this.props.onClick) this.props.onClick(e); },
      onPress: () => {},
      typing,
      showPreview: !typing && !this.props.liveCall,
      showCall: !typing && !!this.props.liveCall,
      callLabel: (this.props.liveCall === "video" ? "Video" : "Voice") + " call in progress",
      callMask: (this.props.liveCall === "video" ? "var(--icon-video)" : "var(--icon-phone)") + " center/contain no-repeat",
      previewFont: count > 0 ? "600" : "400",
      unread: count > 0,
      count: String(count),
    };
  }
}

export default Component;

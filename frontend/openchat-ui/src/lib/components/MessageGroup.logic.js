// Logic for MessageGroup.svelte — carried over from lib/MessageGroup.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Message actions. Pointer: hover bar (3 recent reactions, 🙂, Reply/Edit, ⋯) + right-click. Keyboard: Shift+F10 / Menu key.
// Touch: long-press (onMessageMenu with touch:true → host shows focus mode). Swipe (touch, mouse drag, trackpad two-finger):
// toward start = onReply, toward end = onEdit (own text) / onSwipeLeft — rubber-banded past 56px, accent + haptic at the threshold, mirrored in RTL
// (host: edit own / forward others'). pos always carries el (the message node) and rect for the focus clone.
class Component extends DCLogic {
  state = { hover: -1 };
  _refs = []; _more = []; _emo = [];
  _rect(el) { const r = el && el.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null; }
  // the visual bubble inside a full-width row: descend while the element spans the row, stop at the first narrower one
  _bubble(wrap) {
    if (!wrap) return null;
    const W = wrap.getBoundingClientRect();
    let el = [...wrap.children].find(c => !c.hasAttribute("data-msg-acts") && !c.hasAttribute("data-swipe-hint") && !c.hasAttribute("data-swipe-hint-end") && !c.hasAttribute("data-msg-mark"));
    for (let n = 0; el && n < 8; n++) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < W.width - 1) return { left: r.left - W.left, width: r.width };
      el = el.firstElementChild;
    }
    return { left: 0, width: W.width };
  }
  _actLeft(i) {
    const b = this._bubble(this._refs[i] && this._refs[i].current); if (!b) return "8px";
    const TW = 196; // toolbar width (3 reactions, picker, divider, reply/edit, more)
    return (b.width >= TW + 16 ? b.left + b.width - TW - 8 : b.left) + "px";
  }
  // swipe: logical dx (+ = toward the reply side; flips for RTL), free up to the threshold then rubber-banded
  _swRtl(el) { return !!el && getComputedStyle(el).direction === "rtl"; }
  // own text: right = edit, left = reply · everything else: right = reply, left = forward
  _swMap(m) { const p = this.props, ownTxt = (p.side ?? "received") === "sent" && (!m.kind || m.kind === "text") && !!p.onEdit; return ownTxt ? { right: "edit", left: "reply" } : { right: "reply", left: "forward" }; }
  _swAllowed(m) { const p = this.props, map = this._swMap(m), has = a => a === "edit" ? !!p.onEdit : a === "reply" ? !!p.onReply : !!p.onSwipeLeft; return { reply: has(map.right), left: has(map.left) }; }
  _swSet(i, raw, m) {
    const el = this._refs[i] && this._refs[i].current; if (!el) return;
    const rtl = this._swRtl(el), T = 150, MAX = 400, ok = this._swAllowed(m);
    let d = rtl ? -raw : raw;
    if ((d > 0 && !ok.reply) || (d < 0 && !ok.left)) d = 0;
    const a = Math.abs(d), eased = a <= T ? a : Math.min(MAX, T + (a - T) * 0.6);
    d = Math.sign(d) * eased;
    const g = this._sw && this._sw.i === i ? this._sw : (this._sw = { i, past: false });
    g.d = d;
    el.style.transition = "none"; el.style.transform = "translateX(" + (rtl ? -d : d) + "px)";
    const past = Math.abs(d) >= T;
    const crossed = past && !g.past;
    if (crossed && navigator.vibrate) navigator.vibrate(10);
    g.past = past;
    const hs = el.querySelector("[data-swipe-hint]"), he = el.querySelector("[data-swipe-hint-end]");
    const paint = (h, on, amt) => { if (!h) return; h.style.display = on ? "flex" : "none"; h.style.opacity = String(Math.min(1, amt / T)); h.style.transform = past && on ? "scale(1.3)" : "scale(1)"; if (crossed && on && h.animate) h.animate([{ transform: "scale(1)" }, { transform: "scale(1.55)" }, { transform: "scale(1.2)" }, { transform: "scale(1.38)" }, { transform: "scale(1.3)" }], { duration: 420, easing: "ease-out" }); h.style.background = past && on ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.1))"; const ic = h.firstElementChild; if (ic) ic.style.background = past && on ? "var(--on-accent,#2E0512)" : "var(--ink,#ECECF1)"; };
    paint(hs, d > 0, Math.max(0, d)); paint(he, d < 0, Math.max(0, -d));
  }
  _swEnd(i, m) {
    const el = this._refs[i] && this._refs[i].current, g = this._sw && this._sw.i === i ? this._sw : null; this._sw = null;
    if (el) { el.style.transition = "transform .22s cubic-bezier(.2,.8,.3,1.2)"; el.style.transform = ""; el.querySelectorAll("[data-swipe-hint],[data-swipe-hint-end]").forEach(n => { n.style.opacity = "0"; n.style.display = "none"; n.style.transform = "scale(1)"; }); }
    if (!g || Math.abs(g.d) < 150) return;
    const p = this.props, act = g.d > 0 ? this._swMap(m).right : this._swMap(m).left;
    if (act === "edit") p.onEdit(i, el); else if (act === "reply") { if (p.onReply) p.onReply(i, el); } else if (p.onSwipeLeft) p.onSwipeLeft(i);
  }
  _actLeftFor(i) { const p = this.props; return (p.activeMenu ?? -1) === i ? this._actLeft(i) : "8px"; }
  _pos(i, extra) { const el = this._refs[i] && this._refs[i].current; return Object.assign({ el, rect: this._rect(el) }, extra); }
  renderVals() {
    const p = this.props, side = p.side ?? "received";
    const messages = p.messages ?? [];
    const onMenu = p.onMessageMenu, active = p.activeMenu ?? -1;
    const recent = (p.recentReactions && p.recentReactions.length ? p.recentReactions : ["👍", "❤️", "😂"]).slice(0, 3);
    const open = (i, extra) => { if (onMenu) onMenu(i, this._pos(i, extra)); };
    const isText = m => !m.kind || m.kind === "text";
    return {
      actEnd: "var(--space-8)", actStart: "auto",
      threadMask: "var(--icon-dm) center/contain no-repeat",
      side,
      rowDirection: "row",
      columnAlign: "flex-start",
      columnText: "start",
      showAvatar: p.showAvatar ?? true,
      showName: p.showName ?? true,
      senderName: p.senderName ?? p.name ?? (side === "sent" ? "You" : "Alice Anderson"),
      color: p.color ?? "violet",
      messages: messages.map((m, i) => {
        const ref = this._refs[i] || (this._refs[i] = React.createRef());
        const moreRef = this._more[i] || (this._more[i] = React.createRef());
        const emojiRef = this._emo[i] || (this._emo[i] = React.createRef());
        const menuable = !!onMenu && !m.deleted;
        const hov = this.state.hover === i && !this._touch;
        const canEdit = side === "sent" && isText(m) && !!p.onEdit;
        const mine = (m.reactions || []).filter(r => r.mine).map(r => r.emoji);
        const primary = () => { this.setState({ hover: -1 }); if (canEdit) p.onEdit(i, ref.current); else if (p.onReply) p.onReply(i, ref.current); };
        const kbd = fn => e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e); } };
        const emoji = () => { const bar = emojiRef.current && emojiRef.current.closest("[data-msg-acts]"); if (p.onReactPicker) p.onReactPicker(i, this._pos(i, { anchor: this._rect(bar || emojiRef.current), align: "end" })); };
        return {
        ...m, ref, moreRef, emojiRef,
        isVoice: m.kind === "voice",
        isMedia: ["image", "album", "video", "gif"].indexOf(m.kind) >= 0, isFile: m.kind === "file", isLink: m.kind === "link",
        isTransfer: m.kind === "transfer", isSwap: m.kind === "swap", isPoll: m.kind === "poll", isPrize: m.kind === "prize",
        isText: isText(m),
        status: m.status ?? "delivered",
        forwarded: m.forwarded ?? false,
        edited: m.edited ?? false,
        deleted: m.deleted ?? false,
        threadCount: m.threadCount ?? 0,
        threadLastAt: m.threadLastAt ?? "",
        quoteName: m.quoteName ?? "",
        quoteText: m.quoteText ?? "",
        reactions: m.reactions ?? [],
        failedText: m.failedText ?? "",
        last: i === messages.length - 1,
        showActs: menuable && hov && active !== i,
        actLeft: (this.state.hover === i && this.state.actLeft) || this._actLeftFor(i),
        quick: recent.map(c => { const on = mine.indexOf(c) >= 0; const pick = () => p.onReact && p.onReact(i, c); return { char: c, label: (on ? "Remove " : "React ") + c, onStr: String(on), bg: on ? "var(--accent-soft,rgba(255,86,114,.16))" : "transparent", pick, key: kbd(pick) }; }),
        onChip: c => p.onReact && p.onReact(i, c),
        onEmoji: e => { e.stopPropagation(); emoji(); }, onEmojiKey: kbd(emoji),
        primaryLabel: canEdit ? "Edit" : "Reply", primaryMask: (canEdit ? "var(--icon-edit)" : "var(--icon-reply)") + " center/contain no-repeat",
        onPrimary: primary, onPrimaryKey: kbd(primary),
        leftMask: "var(--icon-" + this._swMap(m).left + ") center/contain no-repeat",
        rightMask: "var(--icon-" + this._swMap(m).right + ") center/contain no-repeat",
        menuOpenStr: String(active === i),
        // row tint while this message is the menu / reply / edit target
        markOp: (p.marked ?? -1) === i ? "1" : "0", markZ: (p.marked ?? -1) === i ? "0" : "auto",
        moreBg: active === i ? "var(--overlay-2,rgba(255,255,255,.08))" : "transparent",
        // the bar belongs to the bubble: show it only while the cursor is over the bubble (or the bar itself)
        onMove: e => {
          if (!menuable || this._touch) return;
          const over = (e.target.closest && e.target.closest("[data-msg-acts]")) || (() => { const w = ref.current, b = this._bubble(w); if (!w || !b) return false; const W = w.getBoundingClientRect(), x = e.clientX - W.left; return x >= b.left && x <= b.left + b.width; })();
          // short intent delay so the bar doesn't flicker while the cursor passes over the chat
          if (over && this.state.hover !== i) { if (this._pend !== i) { clearTimeout(this._hT); this._pend = i; this._hT = setTimeout(() => { this._pend = null; this.setState({ hover: i, actLeft: this._actLeft(i) }); }, 350); } }
          else if (!over) { if (this._pend === i) { clearTimeout(this._hT); this._pend = null; } if (this.state.hover === i) this.setState({ hover: -1 }); }
        },
        onEnter: e => { if (e && e.pointerType === "touch") return; if (menuable && this.state.hover !== i) this.setState({ hover: i, actLeft: this._actLeft(i) }); },
        onLeave: () => { if (this._pend === i) { clearTimeout(this._hT); this._pend = null; } if (this.state.hover === i) this.setState({ hover: -1 }); },
        onBlurOut: e => { if (ref.current && !ref.current.contains(e.relatedTarget) && this.state.hover === i) this.setState({ hover: -1 }); },
        onCtx: e => { if (!menuable) return; if (e.target.closest && e.target.closest("a,input,textarea")) return; e.preventDefault(); if (this._lpFired) { this._lpFired = false; return; } open(i, { point: { x: e.clientX, y: e.clientY } }); },
        onKey: e => { if (!menuable) return; if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); open(i, { anchor: this._rect(ref.current), align: side === "sent" ? "end" : "start", keyboard: true }); } },
        onMore: e => { e.stopPropagation(); if (active === i) return; open(i, { anchor: this._rect(moreRef.current), align: "end", fromBar: true }); },
        onMoreKey: kbd(() => open(i, { anchor: this._rect(moreRef.current), align: "end", keyboard: true, fromBar: true })),
        onPDown: e => {
          this._touch = e.pointerType === "touch";
          if (!menuable) return;
          if (e.pointerType === "mouse" && (e.button !== 0 || (e.target.closest && e.target.closest("a,button,input,textarea,[role=button],[data-msg-acts],[role=slider]")))) return;
          this._g = { x: e.clientX, y: e.clientY, i, dx: 0, swiping: false, id: e.pointerId, type: e.pointerType };
          clearTimeout(this._lpT);
          if (this._touch) this._lpT = setTimeout(() => { if (!this._g || this._g.swiping) return; this._lpFired = true; if (navigator.vibrate) navigator.vibrate(8); open(i, { touch: true }); this._g = null; }, 500);
        },
        onPMove: e => {
          const g = this._g; if (!g || g.i !== i || g.id !== e.pointerId) return;
          const dx = e.clientX - g.x, dy = e.clientY - g.y;
          if (!g.swiping) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(this._lpT); this._g = null; return; }
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { g.swiping = true; clearTimeout(this._lpT); this.setState({ hover: -1 }); try { ref.current.setPointerCapture(e.pointerId); } catch (x) {} const sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges(); } else return;
          }
          e.preventDefault();
          this._swSet(i, dx, m);
        },
        onPUp: () => { clearTimeout(this._lpT); const g = this._g; this._g = null; if (!g || g.i !== i || !g.swiping) return; if (g.type === "mouse") this._justSwiped = Date.now(); this._swEnd(i, m); },
        // trackpad: two-finger horizontal scroll drives the same swipe; ends ~140ms after the last wheel event
        onWheel: e => {
          if (!menuable || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 1) return;
          const w = this._w && this._w.i === i ? this._w : (this._w = { i, dx: 0 });
          w.dx -= e.deltaX; this._swSet(i, w.dx, m);
          clearTimeout(this._wT); this._wT = setTimeout(() => { this._w = null; this._swEnd(i, m); }, 140);
        },
        noDrag: e => e.preventDefault(),
        onClickCap: e => { if (this._justSwiped && Date.now() - this._justSwiped < 300) { e.stopPropagation(); e.preventDefault(); this._justSwiped = 0; } },
      }; }),
    };
  }
}

export default Component;

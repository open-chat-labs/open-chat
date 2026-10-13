// Logic for ChatBubble.svelte — carried over from lib/ChatBubble.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const REPLY_MASK = "var(--icon-reply) center/contain no-repeat";

const CLOSE_MASK = "var(--icon-close) center/contain no-repeat";

// count grapheme clusters so flags, skin tones and ZWJ families read as one emoji
const SEG = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

function emojiOnlyCount(text) {
  const t = (text || "").trim();
  if (!t || !EMOJI_RE.test(t)) return 0;
  const units = SEG ? [...SEG.segment(t)].map(s => s.segment) : [...t];
  const glyphs = units.filter(u => u.trim() !== "");
  if (!glyphs.length) return 0;
  // every visible cluster must be pictographic — no mixed text
  return glyphs.every(g => EMOJI_RE.test(g)) ? glyphs.length : 0;
}

class Component extends DCLogic {
  state = { fit: null, expanded: false };
  _reactionsRef = React.createRef();
  _lastWidth = 0;

  componentDidMount() { this._observe(); this._sync(); }
  componentDidUpdate() { this._sync(); }
  componentWillUnmount() { if (this._ro) this._ro.disconnect(); }

  // the bubble's width is set by the message text, so it is a stable trigger:
  // observing the column instead would feed the chip count back into its own constraint
  _anchor() {
    const el = this._reactionsRef.current;
    const col = el && el.parentElement;
    return (col && col.querySelector("[data-oc-bubble]")) || col;
  }

  _observe() {
    const box = this._anchor();
    if (!box || typeof ResizeObserver === "undefined") return;
    this._lastWidth = box.getBoundingClientRect().width;
    this._ro = new ResizeObserver(() => {
      const w = this._anchor() ? this._anchor().getBoundingClientRect().width : 0;
      if (!w || Math.abs(w - this._lastWidth) < 1) return;
      this._lastWidth = w;
      if (!this.state.expanded) this.setState({ fit: null });   // show all, then converge down again
    });
    this._ro.observe(box);
  }

  // no arithmetic: let the browser wrap, read how many rows it actually used,
  // and drop one chip per pass until it fits. Monotonic, so it always terminates.
  _sync() {
    const el = this._reactionsRef.current;
    if (!el || this.state.expanded) return;
    if (!this._ro) this._observe();
    const kids = [...el.children];
    if (!kids.length) return;
    const rows = new Set(kids.map(k => Math.round(k.getBoundingClientRect().top))).size;
    const maxRows = Math.max(1, this.props.maxReactionRows ?? 1);
    if (rows <= maxRows) return;
    const total = (this.props.reactions ?? []).length;
    const shown = this.state.fit === null ? total : this.state.fit;
    if (shown > 1) this.setState({ fit: shown - 1 });
  }

  renderVals() {
    const side = this.props.side ?? "sent";
    const last = this.props.lastInGroup ?? true;
    const XS = "var(--radius-xs)", XL = "var(--radius-xl)";
    const nearTop = XS;
    const nearBottom = last ? XL : XS;
    // every bubble is left-aligned now, so the avatar-facing edge is inline-start for both sides
    const rSS = nearTop;
    const rSE = XL;
    const rEE = XL;
    const rES = nearBottom;
    const quoteName = this.props.quoteName ?? "";
    const emojiCount = emojiOnlyCount(this.props.text);
    const emojiScale = emojiCount === 1 ? { size: "42px", leading: "1.15" }
      : emojiCount === 2 ? { size: "32px", leading: "1.2" }
      : { size: "var(--text-base)", leading: "1.5" };
    const allReactions = this.props.reactions ?? [];
    // fit === null on the first pass: render every chip so their widths can be measured
    const fit = this.state.fit;
    const reactions = ((fit === null || this.state.expanded) ? allReactions : allReactions.slice(0, fit)).map(r => ({ ...r,
      mineStr: String(!!r.mine), aria: (r.mine ? "Remove your " : "Add ") + r.emoji + " · " + r.count,
      // opaque: chips overlap the bubble's bottom edge, so a translucent tint would vanish into it
      bg: r.mine ? "color-mix(in oklch, var(--accent,#FF5672) 20%, var(--card-2,#191921))" : "var(--card-2,#191921)",
      ring: r.mine ? "inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 55%,transparent)" : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))",
      ink: r.mine ? "var(--ink,#ECECF1)" : "var(--ink-2,#B9B9C6)",
      toggle: () => this.props.onToggleReaction && this.props.onToggleReaction(r.emoji) }));
    const hiddenCount = allReactions.length - reactions.length;
    const overflowed = hiddenCount > 0;
    const threadCount = this.props.threadCount ?? 0;
    const status = this.props.status ?? "delivered";
    const deleted = this.props.deleted ?? false;
    const MASKS = {
      sending: "var(--icon-clock) center/contain no-repeat",
      sent: "var(--icon-check) center/contain no-repeat",
      delivered: "var(--icon-check-double) center/contain no-repeat",
      failed: "var(--icon-failed) center/contain no-repeat",
    };
    return {
      text: this.props.text ?? "Morning! Just pushed the updated onboarding flow.",
      // optional code block shown above the text, as in pasted snippets
      code: this.props.code ?? "",
      hasCode: !!this.props.code,
      time: this.props.time ?? "10:32",
      isSent: side === "sent" && !deleted,
      isReceived: side === "received" && !deleted,
      isDeleted: deleted,
      deletedText: this.props.deletedText ?? "This message was deleted",
      deletedRadius: side === "sent" ? "var(--radius-xl) var(--radius-xs) var(--radius-xl) var(--radius-xl)" : "var(--radius-xs) var(--radius-xl) var(--radius-xl) var(--radius-xl)",
      trashMask: "var(--icon-trash) center/contain no-repeat",
      forwarded: this.props.forwarded ?? false,
      forwardMask: "var(--icon-forward) center/contain no-repeat",
      editedMark: (this.props.edited ?? false) ? "edited · " : "",
      align: "flex-start",
      quoteName,
      quoteText: this.props.quoteText ?? "",
      hasQuote: !!quoteName,
      reactions,
      rSS, rSE, rEE, rES,
      lineBox: "calc(" + emojiScale.size + " * " + emojiScale.leading + ")",
      textSize: emojiScale.size,
      textLeading: emojiScale.leading,
      hasReactions: allReactions.length > 0,
      hasMoreReactions: overflowed,
      moreReactionsLabel: "+" + hiddenCount,
      isExpanded: this.state.expanded,
      closeMask: CLOSE_MASK,
      onCollapseReactions: () => this.setState({ expanded: false, fit: null }),
      onShowAllReactions: () => {
        if (this.props.onShowAllReactions) this.props.onShowAllReactions();
        this.setState({ expanded: true, fit: null });
      },
      reactionsRef: this._reactionsRef,
      hasThread: threadCount > 0,
      reactionsShift: threadCount > 0 ? "var(--space-6)" : "-9px",
      threadLabel: threadCount === 1 ? "1 reply" : threadCount + " replies",
      threadMeta: this.props.threadLastAt ? "Last reply " + this.props.threadLastAt : "",
      threadAlign: "flex-start",
      replyMask: REPLY_MASK,
      onOpenThread: this.props.onOpenThread,
      isFailed: status === "failed",
      retryAction: this.props.retryAction,
      failedText: this.props.failedText ?? (side === "sent" ? "Not delivered" : "Couldn't load"),
      statusMask: MASKS[status] || MASKS.delivered,
      statusColor: "var(--bubble-tick,rgba(255,255,255,.9))",
    };
  }
}

export default Component;

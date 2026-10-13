// Logic for MediaMessage.svelte — carried over from lib/MediaMessage.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Image, album, video and GIF messages. Media is inset 4px in the bubble; caption + time below, or time floats on media when there's no caption.
// Natural ratio capped at 360×420 (single), fixed grids for albums (2, 3, 4, 5+ → "+N"). Clicking a tile calls onOpen(index) → fullscreen viewer.
// items: [{ src?, bg?, w?, h? }] — src is an image URL; bg a CSS background fallback (placeholders).
const SENT = { bg: "var(--bubble-send-bg,#B83E52)", ring: "none", ink: "var(--bubble-text,#fff)", soft: "var(--bubble-text-soft,rgba(255,255,255,.82))", tick: "var(--bubble-tick,#fff)" };
const RECV = { bg: "var(--bubble-recv-bg,#191921)", ring: "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: "var(--bubble-recv-text,#E4E4EC)", soft: "var(--ink-4,#8A8A99)", tick: "var(--ink-4,#8A8A99)" };
class Component extends DCLogic {
  renderVals() {
    const p = this.props, side = p.side ?? "received", c = side === "sent" ? SENT : RECV;
    const kind = p.kind ?? "image";
    const items = (p.items && p.items.length ? p.items : [{}]);
    const n = kind === "album" ? items.length : 1, shown = Math.min(n, 4);
    const caption = p.caption ?? "";
    const tileBg = it => it.src ? "center/cover no-repeat url(" + JSON.stringify(it.src) + ")" : (it.bg || "linear-gradient(170deg,#2b1055,#7597de 55%,#ffb36b)");
    let width = "300px", height = "220px", cols = "1fr", rows = "1fr";
    if (kind === "album") {
      const L = { 1: ["1fr", "1fr", "220px"], 2: ["1fr 1fr", "1fr", "200px"], 3: ["1fr 1fr", "1fr 1fr", "260px"], 4: ["1fr 1fr", "1fr 1fr", "280px"] }[shown];
      cols = L[0]; rows = L[1]; height = L[2];
    } else {
      const it = items[0], w = it.w || 4, h = it.h || 3, maxW = kind === "gif" ? 240 : 360, maxH = 420;
      const sc = Math.min(maxW / w, maxH / h); const W = Math.round(Math.max(160, Math.min(maxW, w * sc))); const H = Math.round(Math.min(maxH, W * h / w));
      width = (W + 8) + "px"; height = H + "px";
    }
    const status = p.status ?? (side === "sent" ? "delivered" : null);
    const tickMask = status === "read" || status === "delivered" ? "var(--icon-check-double) center/contain no-repeat" : "var(--icon-check) center/contain no-repeat";
    const up = p.upload;
    const isUploading = !!(up && up.state === "uploading"), isFailed = !!(up && up.state === "failed");
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    return {
      width, height, cols, rows, bg: c.bg, ring: c.ring, ink: c.ink, soft: c.soft,
      shellR: XS + " 22px 22px " + (last ? "22px" : XS), mediaR: caption ? "2px 18px 6px 6px" : "2px 18px 18px " + (last ? "18px" : "2px"),
      shellOp: isFailed ? ".85" : "1",
      tiles: items.slice(0, shown).map((it, i) => ({
        bg: tileBg(it), span: kind === "album" && shown === 3 && i === 0 ? "1 / -1" : "auto",
        label: kind === "video" ? "Open video" : "Open image " + (i + 1) + (n > 1 ? " of " + n : ""),
        more: n > 4 && i === 3, moreLabel: "+" + (n - 3), open: () => { if (p.onOpen) p.onOpen(i); },
      })),
      isVideo: kind === "video" && !isUploading && !isFailed, isGif: kind === "gif",
      videoMeta: [p.duration, p.size].filter(Boolean).join(" · "), playLabel: "Play video" + (p.duration ? ", " + p.duration : ""),
      onPlayVideo: () => { if (p.onOpen) p.onOpen(0); },
      isUploading, isFailed, progressDeg: Math.round((up && up.progress || 0) * 360) + "deg",
      onCancel: p.onCancel, onRetry: p.onRetry, onDelete: p.onDelete, canDelete: !!p.onDelete,
      failedText: p.failedText ?? "Couldn't send",
      hasCaption: !!caption, caption, timeOnMedia: !caption && !isUploading && !isFailed, time: p.time ?? "11:15",
      tickShow: side === "sent" && status ? "block" : "none", tickMask, tickInk: c.tick,
    };
  }
}

export default Component;

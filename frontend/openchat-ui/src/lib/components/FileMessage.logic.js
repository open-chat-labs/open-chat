// Logic for FileMessage.svelte — carried over from lib/FileMessage.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// File / document message: type tile, middle-truncated name (extension always visible), size, download.
// upload: { state: 'uploading', progress, sent } → ring + cancel, "3.2 of 5.4 MB · 60%"; { state: 'failed' } → retry + red line.
const SENT = { bg: "var(--bubble-send-bg,#B83E52)", ring: "none", ink: "var(--bubble-text,#fff)", soft: "var(--bubble-text-soft,rgba(255,255,255,.82))", tick: "var(--bubble-tick,#fff)", seg: "rgba(0,0,0,.18)", btn: "rgba(0,0,0,.2)", track: "rgba(255,255,255,.22)" };
const RECV = { bg: "var(--bubble-recv-bg,#191921)", ring: "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink: "var(--bubble-recv-text,#E4E4EC)", soft: "var(--ink-4,#8A8A99)", tick: "var(--ink-4,#8A8A99)", seg: "var(--overlay-1,rgba(255,255,255,.04))", btn: "var(--overlay-2,rgba(255,255,255,.08))", track: "var(--overlay-2,rgba(255,255,255,.1))" };
const TYPE = { pdf: "var(--status-danger,#FF4D4D)", doc: "var(--status-verified,#3D9BFF)", docx: "var(--status-verified,#3D9BFF)", xls: "var(--status-online,#2EE6A8)", xlsx: "var(--status-online,#2EE6A8)", csv: "var(--status-online,#2EE6A8)", zip: "var(--status-warning,#FFB03D)", ppt: "var(--status-chit,#FF9F45)", pptx: "var(--status-chit,#FF9F45)" };
class Component extends DCLogic {
  renderVals() {
    const p = this.props, side = p.side ?? "received", c = side === "sent" ? SENT : RECV;
    const name = p.fileName ?? "document.pdf";
    const dot = name.lastIndexOf("."), ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
    const tailLen = Math.min(name.length, (ext ? ext.length + 1 : 0) + 4);
    const hue = TYPE[ext] || "var(--ink-2,#C9C9D4)";
    const up = p.upload, isUploading = !!(up && up.state === "uploading"), isFailed = !!(up && up.state === "failed");
    const caption = p.caption ?? "";
    const pct = Math.round((up && up.progress || 0) * 100);
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    return {
      bg: c.bg, ring: c.ring, ink: c.ink, soft: c.soft, tick: c.tick, seg: c.seg, btnBg: c.btn, track: c.track,
      shellR: XS + " 22px 22px " + (last ? "22px" : XS), rowR: "2px 18px 6px 6px",
      name, nameHead: name.slice(0, name.length - tailLen), nameTail: name.slice(name.length - tailLen),
      ext: (ext || "FILE").toUpperCase().slice(0, 4), typeBg: "color-mix(in oklch," + hue + " 18%,transparent)", typeInk: hue,
      meta: isUploading ? (up.sent ? up.sent + " of " : "") + (p.size || "") + " · " + pct + "%" : [p.size, (ext || "").toUpperCase()].filter(Boolean).join(" · "),
      isIdle: !isUploading && !isFailed, isUploading, isFailed, progressDeg: Math.round(pct * 3.6) + "deg",
      onDownload: p.onDownload, onCancel: p.onCancel, onRetry: p.onRetry, downloadLabel: "Download " + name,
      failedText: p.failedText ?? "Couldn't send the file",
      hasCaption: !!caption, noCaption: !caption, caption, time: p.time ?? "", footTime: isUploading ? "Sending…" : (p.time ?? ""),
      tickShow: side === "sent" && !isUploading && !isFailed ? "block" : "none",
    };
  }
}

export default Component;

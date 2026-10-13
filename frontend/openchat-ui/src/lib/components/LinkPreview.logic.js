// Logic for LinkPreview.svelte — carried over from lib/LinkPreview.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Message with a link preview. Text (with the URL) first, the preview card below it — the card explains the link.
// size: 'large' (image on top, domain, title, 2-line description) or 'compact' (thumbnail row, for repos/profiles without a hero image).
class Component extends DCLogic {
  renderVals() {
    const p = this.props, sent = (p.side ?? "received") === "sent";
    const size = p.size ?? "large";
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    return {
      bg: sent ? "var(--bubble-send-bg,#B83E52)" : "var(--bubble-recv-bg,#191921)",
      ring: sent ? "none" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))",
      ink: sent ? "var(--bubble-text,#fff)" : "var(--bubble-recv-text,#E4E4EC)",
      soft: sent ? "var(--bubble-text-soft,rgba(255,255,255,.82))" : "var(--ink-3,#9A9AA8)",
      tick: sent ? "var(--bubble-tick,#fff)" : "var(--ink-4,#8A8A99)",
      card: sent ? "var(--bubble-reply,#8C2A3D)" : "var(--overlay-1,rgba(255,255,255,.04))",
      domainInk: sent ? "var(--bubble-text-soft,rgba(255,255,255,.82))" : "var(--accent-bright,#FF8298)",
      shellR: XS + " 22px 22px " + (last ? "22px" : XS),
      text: p.text ?? "Worth a read before the vote oc.app/blog/sns-treasury-2026",
      // URLs inside the text render as bold, underlined links
      parts: (p.text ?? "Worth a read before the vote oc.app/blog/sns-treasury-2026").split(/((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i).filter(x => x !== "").map((x, i) => i % 2 === 0 && !/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}/i.test(x) ? { plain: true, link: false, t: x } : { plain: false, link: true, t: x, href: /^https?:/.test(x) ? x : "https://" + x }),
      linkInk: sent ? "var(--bubble-text,#fff)" : "var(--accent-bright,#FF8298)", url: p.url ?? "#", domain: p.domain ?? "oc.app", title: p.title ?? "How SNS treasuries are changing in 2026",
      description: p.description ?? "Proposal flow, spending limits and what this means for community-owned apps.", hasDescription: p.description == null || !!p.description,
      image: p.image ? "center/cover no-repeat url(" + JSON.stringify(p.image) + ")" : (p.imageBg || "linear-gradient(170deg,#2b1055,#7597de 55%,#ffb36b)"),
      hasImage: p.imageBg !== null, isLarge: size === "large", isCompact: size === "compact",
      time: p.time ?? "11:15", tickShow: sent ? "block" : "none",
    };
  }
}

export default Component;

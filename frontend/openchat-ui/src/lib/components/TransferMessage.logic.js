// Logic for TransferMessage.svelte — carried over from lib/TransferMessage.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Crypto transfer: the sign says the direction (+ received, green; − sent), USD inline, "View transaction" opens details.
// side follows the bubble (sent = you sent it). Optional caption sits under the card.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, sent = (p.side ?? "received") === "sent";
    const sym = p.symbol ?? "CHAT", amt = p.amount ?? "100";
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    return {
      bg: sent ? "var(--bubble-send-bg,#B83E52)" : "var(--bubble-recv-bg,#191921)",
      ring: sent ? "none" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))",
      ink: sent ? "var(--bubble-text,#fff)" : "var(--bubble-recv-text,#E4E4EC)",
      soft: sent ? "var(--bubble-text-soft,rgba(255,255,255,.82))" : "var(--ink-4,#8A8A99)",
      card: sent ? "rgba(0,0,0,.18)" : "var(--overlay-1,rgba(255,255,255,.04))",
      line: sent ? "rgba(255,255,255,.14)" : "var(--line-1,rgba(255,255,255,.07))",
      shellR: XS + " 22px 22px " + (last ? "22px" : XS),
      symbol: sym, mark: p.mark ?? sym[0], gradient: p.gradient ?? "linear-gradient(140deg,#2EE6A8,#1FB6FF)", badge: sent ? "send" : "receive",
      signed: (sent ? "−" : "+") + amt + " " + sym, amountInk: sent ? "var(--bubble-text,#fff)" : "var(--status-online,#2EE6A8)",
      usd: p.usd ?? "$1,113.35", caption: p.caption ?? "For the design sprint, thanks!", hasCaption: p.caption !== "", noCaption: p.caption === "", time: p.time ?? "11:15",
      onOpen: p.onOpen,
    };
  }
}

export default Component;

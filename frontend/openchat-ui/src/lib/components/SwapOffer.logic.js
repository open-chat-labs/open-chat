// Logic for SwapOffer.svelte — carried over from lib/SwapOffer.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Swap offer, read from the viewer's side: what leaves your wallet (−) on top, what arrives (+) below, joined by an arrow.
// state: open | done | expired. Your own offer (side 'sent') shows Cancel offer as a quiet segment; others' offers show accent Accept swap.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, sent = (p.side ?? "received") === "sent";
    const st = p.state ?? "open";
    const give = p.give ?? { amount: "20", symbol: "ICP", mark: "\u221E", usd: "$1,095.87", gradient: "linear-gradient(140deg,#ff5f9e,#6a2bff)" };
    const get = p.get ?? { amount: "100", symbol: "CHAT", mark: "C", usd: "$1,113.35", gradient: "linear-gradient(140deg,#2EE6A8,#1FB6FF)" };
    const ink = sent ? "var(--bubble-text,#fff)" : "var(--bubble-recv-text,#E4E4EC)";
    const leg = (t, sign, isGet) => ({ symbol: t.symbol, mark: t.mark ?? t.symbol[0], gradient: t.gradient, usd: t.usd ?? "", signed: sign + t.amount + " " + t.symbol, ink: isGet && !sent ? "var(--status-online,#2EE6A8)" : ink });
    const XS = "var(--radius-xs,4px)", last = p.lastInGroup ?? true;
    const open = st === "open";
    return {
      bg: sent ? "var(--bubble-send-bg,#B83E52)" : "var(--bubble-recv-bg,#191921)",
      ring: sent ? "none" : "inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))", ink,
      soft: sent ? "var(--bubble-text-soft,rgba(255,255,255,.82))" : "var(--ink-4,#8A8A99)",
      seg: sent ? "rgba(0,0,0,.18)" : "var(--overlay-1,rgba(255,255,255,.045))",
      shellR: XS + " 22px 22px " + (last ? "22px" : XS), op: st === "expired" ? ".65" : "1",
      when: open ? (p.expiresIn ? p.expiresIn + " left" : "") : st === "done" ? "Finished" : "Expired",
      whenInk: sent ? "var(--bubble-text-soft,rgba(255,255,255,.82))" : "var(--ink-4,#8A8A99)",
      legs: [leg(give, "−", false), leg(get, "+", true)],
      hasAction: open, action: sent ? "Cancel offer" : "Accept swap",
      btnBg: sent ? "rgba(0,0,0,.18)" : "var(--accent,#FF5672)", btnInk: sent ? "var(--bubble-text,#fff)" : "var(--on-accent,#2E0512)",
      act: sent ? p.onCancel : p.onAccept,
      isDone: st === "done", doneText: p.doneText ?? "Swapped",
      time: p.time ?? "11:15",
    };
  }
}

export default Component;

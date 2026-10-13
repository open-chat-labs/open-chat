// Logic for TransactionRow.svelte — carried over from lib/TransactionRow.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const ICONS = {
  send: "var(--icon-send) center/contain no-repeat",
  receive: "var(--icon-receive) center/contain no-repeat",
  swap: "var(--icon-swap) center/contain no-repeat",
};
// One wallet transaction. With a token (mark + gradient) it shows the token avatar badged with the kind (All activity);
// without, a neutral kind icon (a single token's page). onPress makes it a hover row; divider draws the list rule above it.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, kind = p.kind ?? "receive", press = !!p.onClick, fresh = !!p.fresh;
    const pos = p.positive ?? kind === "receive";
    return { 
      title: p.title ?? "Received from Lucy Linden", sub: p.sub ?? "10:42 · in The Awesome Group",
      amount: p.hidden ? "••••" : p.amount ?? "+385.60 ICP", fiat: p.hidden ? "••••" : p.fiat ?? "$2,113.47",
      amountAria: p.hidden ? "Amount hidden" : undefined,
      amountInk: p.hidden ? "var(--ink,#ECECF1)" : pos ? "var(--status-online,#2EE6A8)" : "var(--ink,#ECECF1)",
      hasToken: !!p.mark, hasIcon: !p.mark, symbol: p.symbol ?? "", mark: p.mark, gradient: p.gradient, kind,
      iconMask: ICONS[kind] || ICONS.receive,
      hasStatus: !!p.status, status: p.status ?? "", statusTone: p.statusTone ?? "neutral",
      onPress: p.onClick, role: press ? "button" : undefined, tab: press ? "0" : undefined,
      minH: press ? "72px" : "64px",
      padX: press || fresh ? "var(--space-10)" : "0",
      radius: press || fresh ? "var(--radius-md,12px)" : "0",
      divider: p.divider ? "1px solid var(--line-1,rgba(255,255,255,.06))" : "none",
      bg: fresh ? "rgba(46,230,168,.06)" : "transparent",
      cursor: press ? "pointer" : "default",
      hover: press ? "var(--overlay-1,rgba(255,255,255,.05))" : "",
    };
  }
}

export default Component;

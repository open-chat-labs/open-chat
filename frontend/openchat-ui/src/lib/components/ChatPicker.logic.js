// Logic for ChatPicker.svelte — carried over from lib/ChatPicker.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Share something to one chat: pick → preview with optional message → Send.
// item: what is being shared ({ title, sub, mark?, icon?, grad?, round? }). chats: [{ name, kind, grad, radius? }].
// onSend({ chat, message }) fires on Send; the parent closes the picker and shows its own toast.
class Component extends DCLogic {
  state = { q: "", to: null, msg: "" };
  renderVals() {
    const p = this.props, s = this.state, item = p.item || null;
    const all = p.chats || [];
    const q = s.q.trim().toLowerCase();
    const list = q ? all.filter(c => (c.name + " " + (c.kind || "")).toLowerCase().indexOf(q) >= 0) : all;
    const to = s.to != null ? all[s.to] : null;
    const hasIcon = !!(item && item.icon);
    return {
      dialogTitle: p.title ?? "Share to chat", z: p.z ?? 90,
      onClose: p.onClose,
      isPick: !to, isConfirm: !!to,
      hasItem: !!item,
      itemTitle: item ? item.title : "", itemSub: item ? item.sub || "" : "",
      itemMark: item && !hasIcon ? item.mark || "" : "",
      itemIconShow: hasIcon ? "block" : "none",
      itemMask: hasIcon ? "var(--icon-" + item.icon + ") center/contain no-repeat" : "none",
      itemBg: item && item.grad ? item.grad : "var(--overlay-2,rgba(255,255,255,.08))",
      itemInk: item && item.grad ? "#0b0b10" : "var(--ink-2,#C9C9D4)",
      itemRadius: item && item.round === false ? "10px" : "var(--radius-pill)",
      q: s.q, onQuery: v => this.setState({ q: v && v.target ? v.target.value : v }), clearQuery: () => this.setState({ q: "" }),
      listLabel: q ? "RESULTS" : "RECENT CHATS",
      empty: !!q && list.length === 0,
      chats: list.map(c => Object.assign({ radius: "50%" }, c, { pick: () => this.setState({ to: all.indexOf(c), msg: "" }) })),
      to: to ? Object.assign({ radius: "50%" }, to) : { name: "", grad: "none", radius: "50%" },
      previewLabel: p.previewLabel ?? "SHARING",
      msg: s.msg, onMsg: v => this.setState({ msg: v && v.target ? v.target.value : v }),
      back: () => this.setState({ to: null }),
      sendLabel: p.sendLabel ?? "Send",
      send: () => { if (p.onSend && to) p.onSend({ chat: to.name, message: s.msg.trim() }); },
    };
  }
}

export default Component;

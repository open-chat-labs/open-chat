// Logic for ThreadPanel.svelte — carried over from lib/ThreadPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const BELL = "var(--icon-bell) center/contain no-repeat";
const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)", amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)", teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)", rose: "linear-gradient(140deg,#ff7a9c,#d6336c)", plum: "linear-gradient(140deg,#b06bff,#5b2a86)", slate: "linear-gradient(140deg,#8a93a6,#3b4252)",
};
const grad = c => GRADIENTS[c] || GRADIENTS.violet;

// An open thread: the root stays pinned as a compact card above the replies.
// Lives in the right side panel on wide windows and in a modal on narrow ones.
class Component extends DCLogic {
  state = { rootOpen: false, following: undefined };
  listRef = React.createRef();
  componentDidMount() { this._bottom(); }
  componentDidUpdate(prev) {
    if (prev.threadKey !== this.props.threadKey) { this.setState({ rootOpen: false, following: undefined }); this._bottom(); }
    else if ((prev.replies || []).length !== (this.props.replies || []).length) this._bottom();
  }
  _bottom() { requestAnimationFrame(() => { const el = this.listRef.current; if (el) el.scrollTop = el.scrollHeight; }); }

  renderVals() {
    const p = this.props, s = this.state;
    const root = p.root || { author: "Ana Ferreira", color: "violet", text: "Agreed. Let's decide on the scale before anyone touches a component.", time: "11:15" };
    const replies = p.replies || [];
    const fresh = p.newReplies || [];
    const following = s.following !== undefined ? s.following : (p.following ?? true);
    const people = p.faces || [];
    const total = replies.length + fresh.length;
    const empty = total === 0;
    const on = following;
    return {
      chatName: p.chatName ?? "The Awesome Group",
      rootAuthor: root.author, rootTime: root.time, rootText: root.text, rootGrad: grad(root.color),
      rootLong: String(root.text || "").length > 110,
      rootClamp: s.rootOpen ? "unset" : "2", rootMore: s.rootOpen ? "Less" : "More",
      toggleRoot: () => this.setState(st => ({ rootOpen: !st.rootOpen })),
      onJump: () => { if (p.onJump) p.onJump(); },
      faces: people.slice(0, 4).map(grad),
      peopleLine: people.length + (people.length === 1 ? " person" : " people") + " · " + total + (total === 1 ? " reply" : " replies"),
      following: on, followLabel: on ? "Following" : "Follow",
      followBg: on ? "var(--accent-soft,rgba(255,86,114,.1))" : "transparent",
      followLine: on ? "var(--accent,#FF5672)" : "var(--line-2,rgba(255,255,255,.12))",
      followInk: on ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#C9C9D4)",
      bellMask: BELL,
      toggleFollow: () => { this.setState({ following: !on }); if (p.onFollowChange) p.onFollowChange(!on); },
      replies, newReplies: fresh, hasNew: fresh.length > 0, isEmpty: empty,
      listRef: this.listRef,
      composerPlaceholder: "Reply to " + String(root.author || "").split(" ")[0],
      onClose: () => { if (p.onClose) p.onClose(); },
      // side panel: back to the details, like pinned messages; modal (narrow): close only
      showBack: !p.asModal, showClose: !!p.asModal,
      headPadStart: p.asModal ? "var(--space-18)" : "var(--space-8)",
      onSend: text => { if (p.onSend) p.onSend(text); this._bottom(); },
      onGif: q => { if (p.onSend) p.onSend("GIF · " + q); this._bottom(); },
      onVoice: r => { const d = Math.max(1, Math.round((r && r.duration) || 0)); if (p.onSend) p.onSend({ kind: "voice", progress: 0, elapsed: "0:00", total: Math.floor(d / 60) + ":" + String(d % 60).padStart(2, "0") }); this._bottom(); },
      onAttach: p.onAttach,
    };
  }
}

export default Component;

// Logic for ImportToCommunityDialog.svelte — carried over from lib/ImportToCommunityDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const IMPORT = "var(--icon-import) center/contain no-repeat";
const CHEVRON = "var(--icon-chevron-right) center/contain no-repeat";
const BACK = "var(--icon-back) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";
const WARN = "var(--icon-warning) center/contain no-repeat";

const GRADIENTS = [
  "linear-gradient(140deg,#ff8a5f,#b3407a)",
  "linear-gradient(140deg,#5fa8ff,#8c6bff)",
  "linear-gradient(140deg,#2ee6a8,#1fb6ff)",
];

const COMMUNITIES = [
  { name: "Community One", members: 1234, channels: 10 },
  { name: "Community Two", members: 1234, channels: 10 },
];

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  state = { target: null, closing: false };

  componentWillUnmount() { clearTimeout(this._t); }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  renderVals() {
    const list = (this.props.communities && this.props.communities.length) ? this.props.communities : COMMUNITIES;
    const fmt = c => c.members.toLocaleString() + " members · " + c.channels + " channels";
    const target = this.state.target;
    return {
      groupName: this.props.groupName ?? "The Awesome Group",
      isPick: !target,
      isConfirm: !!target,
      pickLabel: "SELECT A COMMUNITY YOU OWN (" + list.length + ")",
      communities: list.map((c, i) => ({
        name: c.name,
        meta: fmt(c),
        gradient: GRADIENTS[i % GRADIENTS.length],
        onSelect: () => this.setState({ target: { name: c.name, meta: fmt(c), gradient: GRADIENTS[i % GRADIENTS.length] } }),
      })),
      targetName: target ? target.name : "",
      targetMeta: target ? target.meta : "",
      targetGradient: target ? target.gradient : GRADIENTS[0],
      onBack: () => this.setState({ target: null }),
      onCancel: () => this._close(this.props.onCancel),
      onConfirm: () => this._close(() => { if (this.props.onConfirm) this.props.onConfirm(target && target.name); }),
      veilAnim: this.state.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: this.state.closing ? OUT_CARD : IN_CARD,
      importMask: IMPORT,
      chevronMask: CHEVRON,
      backMask: BACK,
      closeMask: CLOSE,
      warnMask: WARN,
    };
  }
}

export default Component;

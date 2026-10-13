// Logic for LeaveGroupDialog.svelte — carried over from lib/LeaveGroupDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const LEAVE = "var(--icon-leave) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  state = { closing: false };

  componentWillUnmount() { clearTimeout(this._t); }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  renderVals() {
    return {
      noun: this.props.noun ?? "group",
      groupName: this.props.groupName ?? "The Awesome Group",
      body: this.props.body ?? ((this.props.noun ?? "group") === "community"
        ? "You will leave every channel in this community, and it disappears from your nav rail. You can rejoin later if it is public, or by invite."
        : "You will stop receiving messages from this " + (this.props.noun ?? "group") + ", and it disappears from your chat list. Anyone in the " + (this.props.noun ?? "group") + " can invite you back later."),
      onCancel: () => this._close(this.props.onCancel),
      onConfirm: () => this._close(this.props.onConfirm),
      veilAnim: this.state.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: this.state.closing ? OUT_CARD : IN_CARD,
      leaveMask: LEAVE,
      closeMask: CLOSE,
    };
  }
}

export default Component;

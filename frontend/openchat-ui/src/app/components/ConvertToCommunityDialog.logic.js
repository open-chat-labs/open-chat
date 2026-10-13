// Logic for ConvertToCommunityDialog.svelte — carried over from lib/ConvertToCommunityDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const COMMUNITY = "var(--icon-community) center/contain no-repeat";
const WARN = "var(--icon-warning) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";
const CHECK = "var(--icon-check) center/contain no-repeat";
const HINT = "var(--icon-info) center/contain no-repeat";
const ARROW = "var(--icon-arrow) center/contain no-repeat";

const STEPS = [
  "Freeze the existing group",
  "Create a new community with the same name as the group",
  "Add a public channel to the community with the same name as the group",
  "Add all members of the group as members of the community",
  "Copy the full message history from the group into the channel",
  "Delete the existing group and inform its members that it has been converted",
];

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  state = { stepOverride: null, closing: false };

  componentWillUnmount() { clearTimeout(this._t); }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  componentDidUpdate(prev) {
    if (prev.step !== this.props.step) this.setState({ stepOverride: null });
  }

  renderVals() {
    const step = this.state.stepOverride ?? this.props.step ?? "confirm";
    const isDone = step === "done";
    return {
      groupName: this.props.groupName ?? "The Awesome Group",
      isConfirm: !isDone,
      isDone,
      steps: STEPS.map(label => ({ label, mask: CHECK })),
      onConfirm: () => {
        if (this.props.onConfirm) this.props.onConfirm();
        this.setState({ stepOverride: "done" });
      },
      onCancel: () => this._close(this.props.onCancel),
      onFinish: () => this._close(this.props.onFinish ?? this.props.onCancel),
      onGoTo: () => this._close(this.props.onGoTo ?? this.props.onFinish ?? this.props.onCancel),
      veilAnim: this.state.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: this.state.closing ? OUT_CARD : IN_CARD,
      markMask: COMMUNITY,
      warnMask: WARN,
      hintMask: HINT,
      closeMask: CLOSE,
      arrowMask: ARROW,
    };
  }
}

export default Component;

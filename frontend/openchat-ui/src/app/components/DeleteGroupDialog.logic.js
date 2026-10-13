// Logic for DeleteGroupDialog.svelte — carried over from lib/DeleteGroupDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const TRASH = "var(--icon-trash) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";

const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";

class Component extends DCLogic {
  state = { typed: "", closing: false };

  componentWillUnmount() { clearTimeout(this._t); }

  _close(fn) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { this.setState({ closing: false }); if (fn) fn(); }, 170);
  }

  renderVals() {
    const groupName = this.props.groupName ?? "The Awesome Group";
    const armed = this.state.typed.trim().toLowerCase() === groupName.trim().toLowerCase();
    return {
      noun: this.props.noun ?? "group",
      groupName,
      typed: this.state.typed,
      onType: e => this.setState({ typed: e.target.value }),
      inputLine: armed ? "var(--btn-danger-line,rgba(240,68,56,.5))" : "var(--line-2,rgba(255,255,255,.08))",
      deleteBg: armed ? "var(--status-danger,#F5493D)" : "var(--btn-danger-bg,rgba(240,68,56,.08))",
      deleteLine: armed ? "transparent" : "var(--btn-danger-line,rgba(240,68,56,.5))",
      deleteInk: armed ? "#1A0303" : "var(--status-danger,#F5493D)",
      deleteCursor: armed ? "pointer" : "not-allowed",
      onConfirm: () => { if (armed) this._close(this.props.onConfirm); },
      onCancel: () => this._close(this.props.onCancel),
      veilAnim: this.state.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: this.state.closing ? OUT_CARD : IN_CARD,
      trashMask: TRASH,
      closeMask: CLOSE,
    };
  }
}

export default Component;

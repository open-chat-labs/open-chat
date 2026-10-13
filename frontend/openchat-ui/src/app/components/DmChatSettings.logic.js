// Logic for DmChatSettings.svelte — carried over from lib/DmChatSettings.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const CARET = "var(--icon-chevron-down) center/contain no-repeat";
const CLOCK = "var(--icon-clock) center/contain no-repeat";
const EYE = "var(--icon-eye) center/contain no-repeat";
const DURATIONS = ["1 hour", "8 hours", "12 hours", "1 day", "1 week", "30 days"];
const SOFT = "var(--accent-soft,rgba(255,86,114,.1))", ON = "var(--accent-bright,#FF8298)";
const sw = on => ({ track: on ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.14))", knob: on ? "#fff" : "var(--ink-4,#6E6E7C)", shift: on ? "translateX(calc(var(--oc-dir,1) * 18px))" : "translateX(0)" });

// Per-DM settings: shared by the DM side panel and the profile dialog's "This chat" tab
class Component extends DCLogic {
  state = { dmOn: undefined, after: undefined, rr: undefined };

  renderVals() {
    const p = this.props, s = this.state;
    const dmOn = s.dmOn !== undefined ? s.dmOn : (p.disappearOn ?? true);
    const after = s.after !== undefined ? s.after : (p.disappearAfter ?? "12 hours");
    const rr = s.rr !== undefined ? s.rr : !!p.readReceipts;
    const first = String(p.peerName ?? "Alice Anderson").split(" ")[0];
    const r = sw(rr);
    return {
      eyeMask: EYE,
      dmOn, after,
      onDmOn: on => { this.setState({ dmOn: on }); if (p.onDisappearChange) p.onDisappearChange({ on, after }); },
      onAfter: a => { this.setState({ after: a }); if (p.onDisappearChange) p.onDisappearChange({ on: true, after: a }); },
      rrOn: rr, rrTrack: r.track, rrKnob: r.knob, rrShift: r.shift,
      rrHint: first + " sees when you've read their messages",
      onRrSwitch: () => { this.setState({ rr: !rr }); if (p.onReadReceiptsChange) p.onReadReceiptsChange(!rr); },
    };
  }
}

export default Component;

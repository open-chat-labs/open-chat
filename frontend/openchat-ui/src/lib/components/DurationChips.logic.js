// Logic for DurationChips.svelte — carried over from lib/DurationChips.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const DURATIONS = ["1 hour", "12 hours", "1 day", "1 week", "2 weeks", "1 month", "3 months", "6 months"];

class Component extends DCLogic {
  renderVals() {
    const list = (this.props.options && this.props.options.length) ? this.props.options : DURATIONS;
    const value = this.props.value ?? "12 hours";
    const branch = this.props.branch ?? true;
    return {
      branch,
      // with the elbow connector the content clears it; standalone it sits flush
      inset: branch ? "calc(var(--oc-trunk) + var(--oc-stub) + var(--oc-clear))" : "var(--space-4)",
      title: this.props.title ?? "Disappearing messages timeout",
      hint: this.props.hint ?? "How long a message survives before it is deleted for everyone.",
      options: list.map(label => {
        const sel = label === value;
        return {
          label,
          wash: sel ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))",
          line: sel ? "var(--accent-dim,rgba(255,86,114,.45))" : "var(--line-2,rgba(255,255,255,.08))",
          ink: sel ? "var(--accent-bright,#FF8298)" : "var(--ink-3,#9A9AA8)",
          onSelect: () => { if (this.props.onChange) this.props.onChange(label); },
        };
      }),
    };
  }
}

export default Component;

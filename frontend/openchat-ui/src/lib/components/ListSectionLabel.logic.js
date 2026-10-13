// Logic for ListSectionLabel.svelte — carried over from lib/ListSectionLabel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Small mono uppercase heading for list groups and form fields (TODAY, ACTIVITY, YOU PAY). Optional right-side meta (e.g. "Balance 4,820 ICP").
class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    return { label: p.label ?? "Activity",
      meta: p.meta ?? "", hasMeta: !!p.meta, inset: p.inset ? "var(--space-10)" : "0" };
  }
}

export default Component;

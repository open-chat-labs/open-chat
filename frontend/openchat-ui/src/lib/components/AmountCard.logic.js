// Logic for AmountCard.svelte — carried over from lib/AmountCard.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const CARET = "var(--icon-chevron-down) center/contain no-repeat";
// You pay / you get card: label + balance, big amount (input when onChange is given), token pill that opens a picker, fiat/notice line, optional quick chips.
// position "top" | "bottom" adds the extra padding a flip button overlapping the seam needs.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, editable = !!p.onChange, tone = p.tone ?? "default", pos = p.position ?? "top";
    const empty = !editable && (p.value == null || p.value === "");
    return { 
      label: p.label ?? "You pay", meta: p.meta ?? "",
      editable, readOnly: !editable, value: p.value ?? "", shown: empty ? "\u2014" : p.value, onChange: p.onChange,
      valueInk: tone === "danger" ? "var(--status-danger,#F5493D)" : empty || p.muted ? "var(--ink-5,#6E6E7C)" : "var(--ink,#ECECF1)",
      symbol: p.symbol ?? "ICP", mark: p.mark ?? "\u221E", gradient: p.gradient ?? "linear-gradient(140deg,#ff5f9e,#6a2bff)",
      onPickToken: p.onTokenClick, caret: CARET,
      note: p.note ?? "", noteInk: tone === "danger" ? "var(--status-danger,#F5493D)" : "var(--ink-3,#9A9AA8)",
      hasChips: !!p.onQuickSelect, onChip: p.onQuickSelect,
      pad: pos === "bottom" ? "22px 18px 18px" : pos === "top" ? "18px 18px 22px" : "18px",
    };
  }
}

export default Component;

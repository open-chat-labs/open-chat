// Logic for SegmentedTabs.svelte — carried over from lib/SegmentedTabs.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Left/Right/Home/End move and select (automatic activation), RTL-aware.
const rove = (e, sel, orient) => {
  const keys = orient === "h" ? { next: "ArrowRight", prev: "ArrowLeft" } : { next: "ArrowDown", prev: "ArrowUp" };
  if ([keys.next, keys.prev, "Home", "End"].indexOf(e.key) < 0) return null;
  const els = [...e.currentTarget.querySelectorAll(sel)].filter(el => el.getAttribute("aria-disabled") !== "true");
  if (!els.length) return null;
  let i = els.indexOf(document.activeElement && document.activeElement.closest(sel));
  const rtl = orient === "h" && getComputedStyle(e.currentTarget).direction === "rtl";
  const fwd = (e.key === keys.next) !== rtl;
  i = e.key === "Home" ? 0 : e.key === "End" ? els.length - 1 : i < 0 ? (fwd ? 0 : els.length - 1) : (i + (fwd ? 1 : -1) + els.length) % els.length;
  e.preventDefault(); els[i].focus(); return els[i];
};
class Component extends DCLogic {
  state = { active: null };
  renderVals() {
    const labels = this.props.labels ?? ["All", "Direct", "Groups", "Unread"];
    const dotOn = this.props.dotOnLast ?? true;
    const dotIndexes = this.props.dotIndexes ?? null;
    const counts = this.props.counts ?? [];
    const controlled = !!this.props.onSelect;
    const active = controlled ? (this.props.selectedIndex ?? 0) : (this.state.active ?? (this.props.selectedIndex ?? 0));
    return {
      onKeyNav: e => { const el = rove(e, '[role="tab"]', "h"); if (el) el.click(); },
      tabs: labels.map((label, i) => ({
        label,
        selected: i === active, ariaSel: i === active ? "true" : "false", tabIdx: i === active ? 0 : -1,
        // counts are index-aligned; null/undefined entries render no pill
        hasCount: counts[i] != null,
        count: String(counts[i] ?? ""),
        countBg: i === active ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.1))",
        countInk: i === active ? "var(--on-accent,#2E0512)" : "var(--ink-3,#8A8A99)",
        dot: dotIndexes ? dotIndexes.indexOf(i) !== -1 : (dotOn && i === labels.length - 1),
        ink: i === active ? "var(--ink,#ECECF1)" : "var(--ink-3,#8A8A99)",
        onSelect: () => {
          if (controlled) this.props.onSelect(i);
          else this.setState({ active: i });
        },
      })),
    };
  }
}

export default Component;

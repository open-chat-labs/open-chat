// Logic for Menu.svelte — carried over from lib/Menu.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Up/Down/Home/End move between items; Enter/Space activate (a11y.js); Esc closes (owner).
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
  state = { vw: typeof window === "undefined" ? 1920 : window.innerWidth };

  componentDidMount() {
    this._onResize = () => this.setState({ vw: window.innerWidth });
    window.addEventListener("resize", this._onResize);
    this._onResize();
  }

  componentWillUnmount() { window.removeEventListener("resize", this._onResize); }

  renderVals() {
    const vw = this.state.vw;
    const visible = it => (it.minVw == null || vw >= it.minVw) && (it.maxVw == null || vw < it.maxVw);
    const raw = (this.props.items ?? []).filter(visible);
    const heading = this.props.heading ?? "";
    const onSelect = this.props.onSelect;
    const variantOf = it => it && (it.variant ?? (it.color === "danger" ? "danger" : "regular"));
    const items = [];
    raw.forEach((it, i) => {
      const variant = variantOf(it);
      const prevVariant = variantOf(raw[i - 1]);
      if (variant === "danger" && prevVariant && prevVariant !== "danger" && prevVariant !== "separator") {
        items.push({ variant: "separator", label: "", mask: "", shortcut: "" });
      }
      items.push({
        label: it.label ?? "",
        variant,
        mask: it.mask ?? "",
        checkMask: it.checkMask ?? "",
        shortcut: it.shortcut ?? "",
        minVw: it.minVw ?? null,
        maxVw: it.maxVw ?? null,
        onSelect: it.onSelect ?? (onSelect ? () => onSelect(it) : undefined),
      });
    });
    return {
      minWidth: this.props.minWidth ?? "212px",
      heading,
      hasHeading: !!heading,
      onKeyNav: e => rove(e, '[role="menuitem"]', "v"),
      items,
    };
  }
}

export default Component;

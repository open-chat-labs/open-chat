// Logic for TimedToggle.svelte — carried over from lib/TimedToggle.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const ICONS = {
  clock: "var(--icon-clock) center/contain no-repeat",
  refresh: "var(--icon-refresh) center/contain no-repeat",
};
const CARET = "var(--icon-chevron-down) center/contain no-repeat";
const DURATIONS = ["1 hour", "8 hours", "12 hours", "1 day", "1 week", "30 days"];
const SOFT = "var(--accent-soft,rgba(255,86,114,.1))", ON = "var(--accent-bright,#FF8298)";

// A switch with a timed value: the value is the row's subtitle, tapping the row expands the picker.
// Used for disappearing messages (DMs, groups, channels) and access-gate re-checks.
class Component extends DCLogic {
  state = { open: undefined, on: undefined, value: undefined };

  renderVals() {
    const p = this.props, s = this.state;
    const on = s.on !== undefined ? s.on : !!(p.on ?? false);
    const value = s.value !== undefined ? s.value : (p.value ?? "12 hours");
    const readOnly = !!p.readOnly;
    const open = !readOnly && on && (s.open !== undefined ? s.open : !!p.defaultOpen);
    const density = p.density ?? "compact";
    const regular = density !== "compact", flush = density === "flush";
    const icon = p.icon === undefined ? (regular ? null : "clock") : p.icon;
    const padX = flush ? "0px" : "var(--space-16)";
    const setOn = v => { this.setState({ on: v, open: v ? (p.openOnEnable ?? true) : false }); if (p.onChange) p.onChange(v); };
    const pick = v => { this.setState({ value: v, open: !!p.stayOpen }); if (p.onDurationChange) p.onDurationChange(v); };
    const prefix = p.prefix ?? "After";
    return {
      label: p.label ?? "Disappearing messages",
      on, readOnly, canEdit: !readOnly,
      hasIcon: !!icon, iconMask: ICONS[icon] || ICONS.clock,
      titleSize: regular ? "var(--text-base)" : "var(--text-md)",
      textGap: regular ? "3px" : "var(--space-4)",
      rowAlign: regular ? "flex-start" : "center",
      rowGap: regular ? "var(--space-16)" : "var(--space-14)",
      rowMinH: regular ? "0px" : "64px",
      rowPad: flush ? "0px" : regular ? "var(--space-16)" : "var(--space-12) var(--space-16)",
      rowRadius: p.rowRadius ?? "0px",
      rowRole: readOnly ? "group" : "button", rowTab: readOnly ? "-1" : "0",
      rowCursor: readOnly ? "default" : "pointer",
      rowHover: readOnly || flush ? "transparent" : "var(--overlay-1,rgba(255,255,255,.03))",
      sub: on ? prefix + " " + value : (p.offHint ?? "Off"),
      subInk: on ? ON : "var(--ink-4,#8A8A99)",
      showCaret: on && !readOnly,
      caretMask: CARET, caretRot: open ? "rotate(180deg)" : "none",
      expanded: open, showOptions: open,
      status: on ? "On · " + value : "Off",
      track: on ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.14))",
      knob: on ? "#fff" : "var(--ink-4,#6E6E7C)",
      shift: on ? "translateX(calc(var(--oc-dir,1) * 18px))" : "translateX(0)",
      // tapping the row while off turns it on and opens the picker; the switch alone toggles
      toggleExpand: () => { if (readOnly) return; if (!on) setOn(true); else this.setState({ open: !open }); },
      onSwitch: e => { e.stopPropagation(); setOn(!on); },
      gridPad: "var(--space-10) " + padX + " var(--space-18) " + (icon ? "calc(" + padX + " + 31px)" : padX),
      choices: ((p.options && p.options.length) ? p.options : DURATIONS).map(label => { const sel = label === value; return { label, on: sel,
        bg: sel ? SOFT : "var(--overlay-1,rgba(255,255,255,.05))", ring: sel ? "inset 0 0 0 1px var(--accent,#FF5672)" : "none", ink: sel ? ON : "var(--ink-2,#C9C9D4)",
        onPick: () => pick(label) }; }),
    };
  }
}

export default Component;

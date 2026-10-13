// Logic for InfoPanel.svelte — carried over from lib/InfoPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  amber: "linear-gradient(140deg,#ffb03d,#ff4d4d)",
  teal: "linear-gradient(140deg,#2EE6A8,#1FB6FF)",
  blue: "linear-gradient(140deg,#5FA8FF,#8C6BFF)",
};

const DURATIONS = ["1 hour", "12 hours", "1 day", "1 week", "2 weeks", "1 month", "3 months", "6 months"];

class Component extends DCLogic {
  state = { disappearOn: null, disappearAfter: null };

  renderVals() {
    const kind = this.props.kind ?? "user";
    const handle = this.props.handle ?? "";
    const bylineName = this.props.bylineName ?? "";
    const details = this.props.details ?? [];
    const rawToggles = this.props.toggles ?? [];
    const disappearOn = this.state.disappearOn === null || this.state.disappearOn === undefined
      ? (this.props.disappearOn ?? true) : this.state.disappearOn;
    const disappearAfter = this.state.disappearAfter || this.props.disappearAfter || "12 hours";
    const chips = () => DURATIONS.map(label => {
      const sel = label === disappearAfter;
      return {
        label,
        wash: sel ? "var(--accent-soft,rgba(255,86,114,.14))" : "var(--overlay-1,rgba(255,255,255,.05))",
        line: sel ? "var(--accent-dim,rgba(255,86,114,.45))" : "var(--line-2,rgba(255,255,255,.08))",
        ink: sel ? "var(--accent-bright,#FF8298)" : "var(--ink-3,#9A9AA8)",
        onSelect: () => this.setState({ disappearAfter: label }),
      };
    });
    const toggles = rawToggles.map(row => {
      if (!/disappearing/i.test(row.title || "")) return { ...row, showDurations: false, durations: [] };
      return {
        ...row,
        showDurations: disappearOn,
        durations: chips(),
        hint: disappearOn
          ? "Messages older than " + disappearAfter + " are deleted automatically."
          : "Messages are kept until someone deletes them.",
        on: disappearOn,
        onChange: v => this.setState({ disappearOn: v }),
      };
    });
    return {
      cover: this.props.cover || "repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)",
      coverActions: this.props.coverActions ?? ["close"],
      coverTrailActions: this.props.coverTrailActions ?? (kind === "user" ? ["favourite"] : ["favourite", "share", "more"]),
      coverHandlers: this.props.coverHandlers ?? {},
      avatarGradient: GRADIENTS[this.props.color ?? "violet"] ?? GRADIENTS.violet,
      avatarRadius: kind === "user" ? "var(--radius-pill)" : "24px",
      online: (this.props.online ?? true) && kind === "user",
      title: this.props.title ?? "Alice Anderson",
      verified: (this.props.verified ?? false) && kind === "user",
      handle,
      hasHandle: !!handle,
      hasByline: !!bylineName,
      bylinePrefix: this.props.bylinePrefix ?? "created by",
      bylineName,
      tiles: this.props.tiles ?? ["video", "mute", "search"],
      tileHandlers: this.props.tileHandlers ?? {},
      details: details.map(d => ({
        label: d.label,
        value: d.value,
        variant: d.variant ?? "value",
        dot: d.dot ?? false,
        highlight: d.highlight ?? false,
        span: d.wide ? "span 2" : "auto",
      })),
      toggles,
      hasToggles: toggles.length > 0,

      hasFooter: this.props.showFooter ?? true,
      footerLabel: this.props.footerLabel ?? "",
      // an empty label drops the secondary action (DMs: no report, just block)
      hasReport: !!this.props.footerLabel,
      dangerLabel: this.props.dangerLabel ?? "Block user",
    };
  }
}

export default Component;

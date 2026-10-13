// Logic for VoiceMessage.svelte — carried over from lib/VoiceMessage.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const H = [7,14,20,11,17,9,15,21,10,16,6,13,19,8,12,18,10,15,7,20];
const SPEEDS = ["1x", "1.5x", "2x"];

const XS = "var(--radius-xs)", LG = "var(--radius-lg)", XL = "var(--radius-xl)";

const BAR = 3, GAP = 2.5, HANDLE = 16; // handle = 12px + 2px ring each side

class Component extends DCLogic {
  state = { speedIndex: null, trackWidth: 0 };
  waveRef = React.createRef();

  componentDidMount() {
    const el = this.waveRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w && w !== this.state.trackWidth) this.setState({ trackWidth: w });
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(measure);
      this.ro.observe(el);
    }
  }
  componentWillUnmount() {
    if (this.ro) this.ro.disconnect();
  }

  renderVals() {
    const side = this.props.side ?? "received";
    const last = this.props.lastInGroup ?? true;
    const raw = this.props.cornerBottomLeft;
    const override = (raw === undefined || raw === null || raw === "") ? null : (String(raw).match(/[a-z%]/i) ? String(raw) : raw + "px");
    const progress = Math.max(0, Math.min(1, this.state.seek ?? this.props.progress ?? 0.25));
    const w = this.state.trackWidth;
    const count = w
      ? Math.max(8, Math.floor((w - HANDLE - GAP) / (BAR + GAP)))
      : (this.props.barCount ?? 34);
    const bars = [];
    for (let i = 0; i < count; i++) bars.push(H[i % H.length]);
    const cut = Math.round(count * progress);
    const fromProp = SPEEDS.indexOf(this.props.speed ?? "1x");
    const i = this.state.speedIndex === null ? (fromProp < 0 ? 0 : fromProp) : this.state.speedIndex;
    return {
      align: side === "sent" ? "flex-end" : "flex-start",
      radiusTL: side === "sent" ? XL : XS,
      radiusTR: side === "sent" ? XS : XL,
      radiusBR: side === "sent" ? (last ? LG : XL) : XL,
      radiusBL: override !== null ? override : (side === "sent" ? XL : (last ? LG : XL)),
      time: this.props.time ?? "10:39",
      elapsed: this.props.elapsed ?? "0:12",
      total: this.props.total ?? "0:53",
      onPlay: this.props.onPlay,
      waveRef: this.waveRef,
      speed: SPEEDS[i],
      cycleSpeed: () => {
        const next = (i + 1) % SPEEDS.length;
        this.setState({ speedIndex: next });
        if (this.props.onSpeedChange) this.props.onSpeedChange(SPEEDS[next]);
      },
      levels: H.slice(0, 40).concat(H, H).slice(0, 48).map(h => h / 22), prog: progress,
      seek: f => { this.setState({ seek: f }); if (this.props.onSeek) this.props.onSeek(f); },
      playedBars: bars.slice(0, cut).map((h) => ({ h })),
      restBars: bars.slice(cut).map((h) => ({ h })),
    };
  }
}

export default Component;

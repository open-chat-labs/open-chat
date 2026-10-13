// Logic for StatsDonut.svelte — carried over from lib/StatsDonut.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const TYPE_ICONS = {
  text: "var(--icon-chat) center/contain no-repeat",
  image: "var(--icon-image) center/contain no-repeat",
  video: "var(--icon-video) center/contain no-repeat",
  audio: "var(--icon-mic) center/contain no-repeat",
  file: "var(--icon-file) center/contain no-repeat",
  poll: "var(--icon-poll) center/contain no-repeat",
  crypto: "var(--icon-token) center/contain no-repeat",
  gif: "var(--icon-gif) center/contain no-repeat",
};

const PALETTE = ["#5B8CFF", "#B06BFF", "#FFB03D", "#2EE6A8", "#FF5672", "#1FB6FF", "#FF8A3D", "#8C6BFF"];

const DEFAULT_SLICES = [
  { label: "Text", count: 1286 },
  { label: "Image", count: 56 },
  { label: "Video", count: 11 },
  { label: "Audio", count: 3 },
  { label: "File", count: 25 },
  { label: "Poll", count: 12 },
  { label: "Crypto", count: 3 },
  { label: "GIF", count: 21 },
];

const DEFAULT_EXTRAS = [
  { label: "POLL VOTES", count: "11" },
  { label: "REPLIES", count: "75" },
  { label: "REACTIONS", count: "462" },
  { label: "DELETED", count: "5" },
];

const fmt = n => n.toLocaleString("en-US");

class Component extends DCLogic {
  renderVals() {
    const given = this.props.slices;
    const raw = (given && given.length) ? given : DEFAULT_SLICES;
    const total = raw.reduce((s, x) => s + x.count, 0) || 1;

    // one conic-gradient ring: each slice gets a hard stop at its cumulative angle
    let at = 0;
    const stops = raw.map((s, i) => {
      const from = (at / total) * 360;
      at += s.count;
      const to = (at / total) * 360;
      const c = s.color || PALETTE[i % PALETTE.length];
      return c + " " + from.toFixed(2) + "deg " + to.toFixed(2) + "deg";
    });

    return {
      ring: "conic-gradient(from -90deg," + stops.join(",") + ")",
      totalLabel: fmt(total),
      slices: raw.map((s, i) => {
        const c = s.color || PALETTE[i % PALETTE.length];
        return {
          label: s.label.toUpperCase(),
          count: fmt(s.count),
          mask: TYPE_ICONS[s.label.toLowerCase()] || TYPE_ICONS.text,
          color: c,
          wash: "color-mix(in srgb, " + c + " 12%, transparent)",
          line: "color-mix(in srgb, " + c + " 30%, transparent)",
        };
      }),
      onlineNow: fmt(this.props.onlineMinutes ?? 1659),
      onlinePrev: fmt(this.props.onlineMinutesPrev ?? 1521),
      extras: (this.props.extras && this.props.extras.length) ? this.props.extras : DEFAULT_EXTRAS,
    };
  }
}

export default Component;

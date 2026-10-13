// Logic for GroupStats.svelte — carried over from lib/GroupStats.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const UP = "var(--icon-chevron-up) center/contain no-repeat";
const DOWN = "var(--icon-chevron-down) center/contain no-repeat";

const MIX_COLORS = ["#5B8CFF", "#B06BFF", "#FFB03D", "#2EE6A8", "#6E6E7C"];

const DEFAULT_MIX = [
  { label: "Text", count: 1286 },
  { label: "Images", count: 56 },
  { label: "Files", count: 25 },
  { label: "GIFs", count: 21 },
  { label: "Polls, video & audio", count: 29 },
];

const DEFAULT_WEEKS = [186, 241, 198, 274, 312, 268, 355, 298, 389, 341, 402, 447];

const DEFAULT_PEOPLE = [
  { name: "Priya Raman", count: 312, gradient: "linear-gradient(145deg,#8FE3C6,#3FB99A)" },
  { name: "Danielle Moreau", count: 268, gradient: "linear-gradient(145deg,#C9B4FF,#8A6BE0)" },
  { name: "Jonah Weiss", count: 191, gradient: "linear-gradient(145deg,#FFD79A,#E8A13C)" },
];

const fmt = n => Number(n).toLocaleString("en-US");
const initials = name => name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");

class Component extends DCLogic {
  renderVals() {
    const mixRaw = (this.props.mix && this.props.mix.length) ? this.props.mix : DEFAULT_MIX;
    const total = mixRaw.reduce((s, x) => s + x.count, 0) || 1;
    const prev = this.props.totalPrev ?? 1298;
    const pct = Math.round(((total - prev) / prev) * 1000) / 10;
    const up = pct >= 0;

    const weeksRaw = (this.props.weeks && this.props.weeks.length) ? this.props.weeks : DEFAULT_WEEKS;
    const peak = Math.max.apply(null, weeksRaw) || 1;

    const people = (this.props.people && this.props.people.length) ? this.props.people : DEFAULT_PEOPLE;
    const topCount = people.reduce((m, p) => Math.max(m, p.count), 1);
    const namedTotal = people.reduce((s, p) => s + p.count, 0);
    const others = Math.max(total - namedTotal, 0);
    const otherPeople = this.props.otherPeople ?? 37;
    const onlineNow = this.props.onlineMinutes ?? 1659;
    const onlinePrev = this.props.onlineMinutesPrev ?? 1521;

    return {
      totalLabel: fmt(total),
      deltaLabel: (up ? "+" : "") + pct + "%",
      deltaInk: up ? "var(--status-online,#2EE6A8)" : "var(--status-danger,#F5493D)",
      deltaWash: up ? "color-mix(in srgb, var(--status-online,#2EE6A8) 14%, transparent)" : "color-mix(in srgb, var(--status-danger,#F5493D) 14%, transparent)",
      deltaMask: up ? UP : DOWN,
      weeks: weeksRaw.map((v, i) => ({
        height: Math.max(Math.round((v / peak) * 100), 8) + "%",
        // the most recent week reads as the live one; the rest recede
        fill: i === weeksRaw.length - 1 ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.12))",
        title: fmt(v) + " messages",
      })),
      mix: mixRaw.map((m, i) => ({
        label: m.label,
        count: fmt(m.count),
        pct: Math.round((m.count / total) * 100) + "%",
        width: ((m.count / total) * 100).toFixed(2) + "%",
        color: m.color || MIX_COLORS[i % MIX_COLORS.length],
      })),
      people: people.map(p => ({
        name: p.name,
        initials: initials(p.name),
        gradient: p.gradient || "linear-gradient(145deg,#C9B4FF,#8A6BE0)",
        count: fmt(p.count),
        width: ((p.count / topCount) * 100).toFixed(1) + "%",
      })),
      restLabel: fmt(others) + " messages from " + otherPeople + " other members",
      engagement: (this.props.engagement && this.props.engagement.length) ? this.props.engagement : [
        { count: "462", label: "Reactions" },
        { count: "75", label: "Replies" },
        { count: "11", label: "Poll votes" },
        { count: "5", label: "Deleted" },
      ],
      onlineNow: fmt(onlineNow),
      onlinePrev: fmt(onlinePrev),
      onlineWord: onlineNow >= onlinePrev ? "up" : "down",
      onlineInk: onlineNow >= onlinePrev ? "var(--status-online,#2EE6A8)" : "var(--status-danger,#F5493D)",
    };
  }
}

export default Component;

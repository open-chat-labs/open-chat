// Logic for Countdown.svelte — carried over from lib/Countdown.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Live countdown text. `to` = end time (ms epoch or ISO). format: auto ("2d 4h" → "3h 12m" → "4:09") | clock ("10:57:11") | words ("Ends in 3 hours").
// prefix/suffix wrap it ("Ends in", "left"); `ended` text when it hits zero, then onEnd fires once. Ticks every second under an hour, else every 30s.
class Component extends DCLogic {
  state = { now: Date.now() };
  componentDidMount() { this._tick(); }
  componentWillUnmount() { clearTimeout(this._t); }
  _end() { const t = this.props.to; return typeof t === "number" ? t : t ? Date.parse(t) : Date.now() + 3 * 3600e3 + 12 * 60e3; }
  _tick() { const left = this._end() - Date.now(); this.setState({ now: Date.now() }); if (left <= 0) { if (!this._done && this.props.onEnd) { this._done = true; this.props.onEnd(); } return; } this._t = setTimeout(() => this._tick(), left < 3600e3 || this.props.format === "clock" ? 1000 : 30000); }
  renderVals() {
    const p = this.props, end = this._end(), s = Math.max(0, Math.floor((end - this.state.now) / 1000));
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60, z = n => String(n).padStart(2, "0");
    const f = p.format || "auto";
    const body = s === 0 ? null
      : f === "clock" ? (d ? d + "d " : "") + (h || d ? h + ":" + z(m) : m) + ":" + z(sec)
      : f === "words" ? (d ? d + (d === 1 ? " day" : " days") : h ? h + (h === 1 ? " hour" : " hours") : m ? m + (m === 1 ? " minute" : " minutes") : sec + " seconds")
      : d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + ":" + z(sec);
    const text = body == null ? (p.ended ?? "Ended") : [p.prefix, body, p.suffix].filter(Boolean).join(" ");
    return { text, iso: new Date(end).toISOString(), full: new Date(end).toLocaleString() };
  }
}

export default Component;

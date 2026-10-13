// Logic for MiniCall.svelte — carried over from lib/MiniCall.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Minimised call: floats over the app (SnapFloat — drag anywhere, 8 snap spots, clear of header/composer via safeTop/safeBottom).
// Video calls show the lead feed; tap it or "Back to call" → onOpen. Mount inside a positioned container (fills it, passes clicks through).
const fmt = start => { const t = Math.max(0, Math.floor((Date.now() - start) / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = t % 60, p = n => String(n).padStart(2, "0"); return (h ? h + ":" + p(m) : m) + ":" + p(x); };
class Component extends DCLogic {
  componentDidMount() { this._tick = setInterval(() => this.forceUpdate(), 1000); }
  componentWillUnmount() { clearInterval(this._tick); }
  renderVals() {
    const p = this.props, muted = !!p.muted, ppl = p.people || [], lead = ppl[0] || {};
    const open = () => { if (p.onOpen) p.onOpen(); };
    return {
      position: p.position ?? "br", safeTop: p.safeTop ?? 20, safeBottom: p.safeBottom ?? 20, snap: k => { if (p.onSnap) p.onSnap(k); },
      isVideo: (p.media ?? "video") === "video", open, openKey: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
      leadGrad: lead.grad || p.avatarGrad || "linear-gradient(140deg,#B48CFF,#6A5CFF)", leadInitial: lead.initial || (p.title || "?").slice(0, 1).toUpperCase(),
      title: p.title ?? "Julian Jelfs", kind: (p.media ?? "video") === "video" ? "Video" : "Voice",
      timer: fmt(p.start ?? (this._t0 ??= Date.now() - 754000)),
      faces: p.faces ?? ppl.map(x => x.grad).filter(Boolean),
      muteIcon: muted ? "mic-off" : "mic", muteTip: muted ? "Unmute" : "Mute", muteVariant: muted ? "off" : "default", mutedB: muted,
      toggleMute: () => { if (p.onToggleMute) p.onToggleMute(); }, leave: () => { if (p.onLeave) p.onLeave(); },
    };
  }
}

export default Component;

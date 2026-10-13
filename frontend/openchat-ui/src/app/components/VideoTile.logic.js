// Logic for VideoTile.svelte — carried over from lib/VideoTile.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// One call participant. The feed keeps its own shape (ratio, default 4:3) and letterboxes inside the tile — never cropped.
// Avatar shows while the camera is off / no feed. speaking → accent ring (drawn above the feed). Name pill + mic state bottom-left.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, big = !!p.big, who = p.nameLabel ?? p.label ?? "alice_anderson", muted = !!p.muted;
    return {
      who, initial: p.initial ?? who.slice(0, 1).toUpperCase(), grad: p.grad ?? "linear-gradient(140deg,#B48CFF,#6A5CFF)",
      bg: p.feed ?? "linear-gradient(165deg,#4a3b45,#1d1a22)", ar: String(p.ratio || 4 / 3), radius: (p.radius ?? 10) + "px",
      ring: p.speaking ? "inset 0 0 0 2px var(--accent,#FF5672)" : "inset 0 0 0 1px rgba(255,255,255,.06)",
      av: big ? "112px" : "64px", avFont: big ? "40px" : "22px",
      micMask: "var(--icon-" + (muted ? "mic-off" : "mic") + ") center/contain no-repeat", micInk: muted ? "var(--status-danger,#F5493D)" : "#fff",
      aria: who + (muted ? ", muted" : "") + (p.speaking ? ", speaking" : ""),
    };
  }
}

export default Component;

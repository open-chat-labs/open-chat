// Logic for TileButtons.svelte — carried over from lib/TileButtons.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const MASKS = {
  video: "var(--icon-video) center/contain no-repeat",
  mute: "var(--icon-bell-off) center/contain no-repeat",
  search: "var(--icon-search) center/contain no-repeat",
  members: "var(--icon-users) center/contain no-repeat",
  everyone: "var(--icon-community) center/contain no-repeat",
  everyoneOff: "var(--icon-everyone-off) center/contain no-repeat",
  muteOff: "var(--icon-mute-off) center/contain no-repeat",
  pin: "var(--icon-pin) center/contain no-repeat",
};

const LABELS = { video: "Video call", mute: "Mute", search: "Search", members: "Members", pin: "Pinned", everyone: "@everyone" };

class Component extends DCLogic {
  renderVals() {
    const tiles = this.props.tiles ?? ["video", "mute", "search"];
    const handlers = this.props.handlers ?? {};
    const cols = this.props.columns ?? 0;
    return {
      columns: "repeat(" + (cols || tiles.length) + ",minmax(0,1fr))",
      tiles: tiles.map(t => {
        const o = typeof t === "object" ? t : { icon: t };
        const key = o.icon;
        // a tile with `on` is a live toggle: it shows its state rather than
        // committing anything, so it reads accent-tinted when engaged
        const on = !!o.on;
        return {
          mask: MASKS[on && MASKS[key + "On"] ? key + "On" : key] || MASKS.search,
          label: o.label || LABELS[key] || key,
          onPress: handlers[key],
          bg: on ? "color-mix(in srgb, var(--accent,#FF5672) 14%, transparent)" : "var(--overlay-1,rgba(255,255,255,.045))",
          ring: on ? "inset 0 0 0 1px color-mix(in srgb, var(--accent,#FF5672) 38%, transparent)" : "none",
          ink: on ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#D8D8E2)",
          labelInk: on ? "var(--accent-bright,#FF8298)" : "var(--ink-2,#B9B9C6)",
        };
      }),
    };
  }
}

export default Component;

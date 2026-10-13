// Logic for Icon.svelte — carried over from lib/Icon.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// One glyph from the canonical set (lib/icons.js → lib/icons.css). Colour follows currentColor unless set.
// flip mirrors direction-bearing glyphs in RTL. label makes it announced; otherwise it is decorative.
class Component extends DCLogic {
  renderVals() {
    const p = this.props, size = p.size ?? 16;
    return {
      px: typeof size === "number" ? size + "px" : size,
      color: p.color ?? "currentColor",
      mask: "var(--icon-" + (p.icon ?? "search") + ") center/contain no-repeat",
      flip: p.flip ? "" : undefined,
      role: p.label ? "img" : undefined, label: p.label || undefined, hidden: p.label ? undefined : "true",
    };
  }
}

export default Component;

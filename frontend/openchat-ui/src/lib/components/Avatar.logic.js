// Logic for Avatar.svelte — carried over from lib/Avatar.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

const GRADIENTS = {
  violet: "linear-gradient(140deg,#ff5f9e,#6a2bff)",
  blue: "linear-gradient(140deg,#3d7bff,#7a3dff)",
  teal: "linear-gradient(140deg,#2ee6a8,#1f8fbf)",
  amber: "linear-gradient(140deg,#ffb03d,#ff5f4d)",
  plum: "linear-gradient(140deg,#b04dff,#4d2dff)",
};

class Component extends DCLogic {
  renderVals() {
    const size = this.props.size ?? 42;
    const shape = this.props.shape ?? "circle";
    return {
      size,
      radius: shape === "circle" ? 999 : Math.round(size * 0.33),
      gradient: GRADIENTS[this.props.color ?? "violet"] ?? GRADIENTS.violet,
      online: this.props.online ?? true,
      dotSize: size >= 60 ? 14 : 11,
      dotOffset: size >= 60 ? 2 : 0,
    };
  }
}

export default Component;

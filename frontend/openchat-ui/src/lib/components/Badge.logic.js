// Logic for Badge.svelte — carried over from lib/Badge.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  // intrinsic sizing does not propagate through the dc-import mount, so the badge
  // measures its own pill once and pins the root to a definite px size
  state = { w: null, h: null };
  _rootRef = React.createRef();

  componentDidMount() { this._measure(); }
  componentDidUpdate() { this._measure(); }

  _measure() {
    const el = this._rootRef.current;
    const inner = el && el.firstElementChild;
    if (!inner) return;
    const r = inner.getBoundingClientRect();
    const w = Math.ceil(r.width), h = Math.ceil(r.height);
    if (!w || !h) return;
    if (w !== this.state.w || h !== this.state.h) this.setState({ w, h });
  }

  renderVals() {
    const v = this.props.variant ?? "count";
    return {
      rootRef: this._rootRef,
      rootW: this.state.w ? this.state.w + "px" : "auto",
      rootH: this.state.h ? this.state.h + "px" : "auto",
      label: this.props.label ?? "2",
      isCount: v === "count",
      isTag: v === "tag",
      isNeutral: v === "neutral",
      isChit: v === "chit",
      hasChitLabel: !(this.props.short ?? false),
      isDot: v === "dot",
      isVerified: v === "verified",
    };
  }
}

export default Component;

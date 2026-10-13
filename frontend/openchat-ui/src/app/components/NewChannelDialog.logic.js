// Logic for NewChannelDialog.svelte — carried over from lib/NewChannelDialog.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

const HASH = "var(--icon-hash) center/contain no-repeat";
const EMBED = "var(--icon-embed) center/contain no-repeat";
const CLOSE = "var(--icon-close) center/contain no-repeat";
const IN_VEIL = "oc-veil-in var(--duration-base,200ms) var(--ease-out) both";
const IN_CARD = "oc-dlg-in var(--duration-slow,280ms) var(--ease-out) both";
const OUT_VEIL = "oc-veil-out 170ms var(--ease-standard) both";
const OUT_CARD = "oc-dlg-out 170ms var(--ease-standard) both";
const slug = v => String(v).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");

class Component extends DCLogic {
  state = { closing: false, name: "", about: "", url: "", isPublic: true };
  componentDidMount() {
    this._key = e => { if (e.key === "Escape") this._close(this.props.onCancel); };
    window.addEventListener("keydown", this._key);
  }
  componentWillUnmount() { clearTimeout(this._t); window.removeEventListener("keydown", this._key); }
  _close(fn, arg) {
    if (this.state.closing) return;
    this.setState({ closing: true });
    this._t = setTimeout(() => { if (fn) fn(arg); }, 170);
  }
  renderVals() {
    const st = this.state, embedded = !!this.props.embedded;
    const urlOk = /^https?:\/\/\S+\.\S+/.test(st.url.trim());
    const ok = st.name.length > 1 && (!embedded || urlOk);
    return { 
      heading: embedded ? "Add embedded channel" : "New channel",
      cta: embedded ? "Add channel" : "Create channel",
      communityName: this.props.communityName ?? "OpenChat",
      headMask: embedded ? EMBED : HASH, closeMask: CLOSE,
      isEmbedded: embedded,
      name: st.name, onName: e => this.setState({ name: slug(e.target.value) }),
      nameRing: st.name ? "var(--line-3,rgba(255,255,255,.22))" : "var(--line-2,rgba(255,255,255,.1))",
      about: st.about, onAbout: e => this.setState({ about: e.target.value }),
      url: st.url, onUrl: e => this.setState({ url: e.target.value }),
      isPublic: st.isPublic, setPublic: v => this.setState({ isPublic: typeof v === "boolean" ? v : !st.isPublic }),
      visHint: st.isPublic ? "Anyone in the community can find and join it." : "Only people you add or invite can join, even in a public community.",
      ctaBg: ok ? "var(--accent,#FF5672)" : "var(--overlay-2,rgba(255,255,255,.09))",
      ctaInk: ok ? "var(--on-accent,#2E0512)" : "var(--ink-4,#7C7C8C)",
      ctaCursor: ok ? "pointer" : "default",
      onCancel: () => this._close(this.props.onCancel),
      onConfirm: () => { if (ok) this._close(this.props.onCreate, { name: st.name, about: st.about, isPublic: st.isPublic, embedded, url: st.url.trim() }); },
      veilAnim: st.closing ? OUT_VEIL : IN_VEIL,
      cardAnim: st.closing ? OUT_CARD : IN_CARD,
    };
  }
}

export default Component;

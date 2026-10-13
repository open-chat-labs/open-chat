// Logic for CallPanel.svelte — carried over from lib/CallPanel.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Live call surface. Inline (in the conversation column, under the header) or full screen (`full`).
// Layout rule: with 1–2 other people your own video floats as a draggable window that snaps to a corner;
// with 3+ others everyone, you included, gets an equal tile. Sharing your screen puts it on stage with people in a strip.
// Full screen hides the top bar and controls after 3s without pointer movement.
// Host owns mute (`muted` + onToggleMute) so the call bar / mini window stay in sync; camera and sharing live here.
const M = n => "var(--icon-" + n + ") center/contain no-repeat";
const fmt = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
const ME = { name: "You", initial: "I", grad: "linear-gradient(140deg,#FF9F45,#FF5672)", bg: "linear-gradient(165deg,#3d434c,#22262d)" };
const BGS = ["linear-gradient(165deg,#4a3b45,#1d1a22)", "linear-gradient(165deg,#2f3a44,#1a2026)", "linear-gradient(165deg,#43392f,#221d18)", "linear-gradient(165deg,#3b3446,#1e1a24)", "linear-gradient(165deg,#2e4038,#18221e)"];

class Component extends DCLogic {
  state = { cam: null, sharing: false, idle: false, speak: 0, corner: "br" };
  rootRef = React.createRef(); pipRef = React.createRef();
  componentDidMount() {
    this._tick = setInterval(() => this.setState(s => ({ speak: (Math.floor(Date.now() / 2600)) })), 1000);
    this._wake();
  }
  componentWillUnmount() { clearInterval(this._tick); clearTimeout(this._idleT); }
  componentDidUpdate(prev) { if (prev.full !== this.props.full) this._wake(); }
  _wake() { clearTimeout(this._idleT); if (this.state.idle) this.setState({ idle: false }); if (this.props.full) this._idleT = setTimeout(() => this.setState({ idle: true }), 3000); }

  renderVals() {
    const p = this.props, st = this.state, full = !!p.full;
    const video = (p.media ?? "video") === "video";
    const cam = st.cam ?? video;
    const muted = !!p.muted;
    const others = (p.people || [{ name: "julian_jelfs", initial: "J", grad: "linear-gradient(140deg,#9BD94B,#4E8F2B)" }]).map((o, i) => Object.assign({ bg: BGS[i % BGS.length] }, o));
    const speaking = others.length ? st.speak % others.length : -1;
    const ring = on => on ? "inset 0 0 0 2px var(--accent,#FF5672)" : "inset 0 0 0 1px rgba(255,255,255,.06)";
    const mic = off => ({ micMask: M(off ? "mic-off" : "mic"), micInk: off ? "var(--status-danger,#F5493D)" : "#fff" });
    const tile = (o, i, big) => Object.assign({}, o, mic(o.muted), { ratioN: o.ratio || 4 / 3, mutedB: !!o.muted, speakingB: i === speaking, bigB: !!big, ar: String(o.ratio || 4 / 3), ring: ring(i === speaking), av: big ? "112px" : "64px", avFont: big ? "40px" : "22px" });
    const selfTile = Object.assign({}, ME, mic(muted), { ratioN: 4 / 3, mutedB: !!muted, speakingB: false, bigB: false, ar: String(4 / 3), ring: ring(false), av: "64px", avFont: "22px", bg: cam ? ME.bg : "#16161c" });
    const pipMode = !st.sharing && others.length <= 2;
    let tiles, cols, strip = [];
    if (st.sharing) { tiles = []; cols = "minmax(0,1fr)"; strip = others.map((o, i) => tile(o, i)).concat([selfTile]); }
    else if (pipMode) { tiles = others.map((o, i) => tile(o, i, others.length === 1)); cols = others.length === 2 ? "repeat(2,minmax(0,1fr))" : "minmax(0,1fr)"; }
    else { tiles = others.map((o, i) => tile(o, i)).concat([selfTile]); const n = tiles.length; cols = "repeat(" + (n <= 4 ? 2 : n <= 9 ? 3 : 4) + ",minmax(0,1fr))"; }
    const k = st.corner, inset = full ? "20px" : "12px", pipLift = full ? "108px" : "86px";
    const set = o => this.setState(o);
    const btn = (label, icon, kind, press, pressed) => ({ label, icon, variant: kind === "end" ? "danger" : kind || "default", pressedBool: pressed == null ? undefined : !!pressed, mask: M(icon), press, pressed: pressed == null ? undefined : String(pressed),
      bg: kind === "end" ? "var(--status-danger,#F5493D)" : kind === "on" ? "var(--accent,#FF5672)" : kind === "off" ? "#ECECF1" : "rgba(255,255,255,.1)",
      ink: kind === "on" ? "var(--on-accent,#2E0512)" : kind === "off" ? "#0e0e12" : "#fff" });
    const total = others.length + 1;
    return {
      rootRef: this.rootRef, pipRef: this.pipRef, full, title: p.title ?? "Julian Jelfs", avatarGrad: p.avatarGrad ?? (others[0] ? others[0].grad : "transparent"),
      screenLabel: full ? "Call · full screen" : "Call",
      radius: full ? "0" : "14px", cursor: full && st.idle ? "none" : "default",
      stageInset: full ? (st.sharing ? "70px 200px 108px 20px" : "70px 20px 108px 20px") : (st.sharing ? "62px 168px 86px 12px" : "62px 12px 86px 12px"),
      tiles, cols, sharing: st.sharing,
      hasStrip: st.sharing, strip, stripTop: full ? "70px" : "62px", stripBottom: full ? "108px" : "86px", stripW: full ? "168px" : "144px",
      hasPip: pipMode, self: selfTile, pipW: full ? "375px" : "281px", pipTr: (k[0] === "m" ? "0 -50%" : "0 0").replace(/^0 /, k[1] === "c" ? "-50% " : "0 "),
      pipT: k[0] === "t" ? (full ? "70px" : "62px") : k[0] === "m" ? "50%" : "auto", pipB: k[0] === "b" ? pipLift : "auto",
      pipL: k[1] === "l" ? inset : k[1] === "c" ? "50%" : "auto", pipR: k[1] === "r" ? inset : "auto",
      pipDown: e => { const el = this.pipRef.current; if (!el) return; this._drag = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); el.style.transition = "none"; },
      pipMove: e => { const d = this._drag, el = this.pipRef.current; if (!d || !el) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; el.style.transform = "translate(" + dx + "px," + dy + "px)"; },
      pipUp: e => { const d = this._drag, el = this.pipRef.current, root = this.rootRef.current; this._drag = null; if (!d || !el || !root) return;
        const r = root.getBoundingClientRect(), b = el.getBoundingClientRect(), cx = b.left + b.width / 2 - r.left, cy = b.top + b.height / 2 - r.top;
        const v = cy < r.height / 3 ? "t" : cy > r.height * 2 / 3 ? "b" : "m", h = cx < r.width / 3 ? "l" : cx > r.width * 2 / 3 ? "r" : "c";
        // the centre is the stage: push to the nearer horizontal edge instead
        // FLIP: positions jump between auto/px (not animatable), so glide from the drop point with a transform
        el.style.transform = ""; el.style.transition = "none";
        this.setState({ corner: v === "m" && h === "c" ? "m" + (cx < r.width / 2 ? "l" : "r") : v + h }, () => { const n = el.getBoundingClientRect(); el.style.transform = "translate(" + (b.left - n.left) + "px," + (b.top - n.top) + "px)"; void el.offsetWidth; el.style.transition = "transform 720ms cubic-bezier(.16,1,.3,1)"; el.style.transform = ""; }); },
      barPad: full ? "14px 16px" : "10px 12px",
      elapsed: fmt(Math.max(0, Math.floor((Date.now() - (p.start ?? Date.now())) / 1000))),
      countLabel: total + " in call",
      chromeOpacity: full && st.idle ? 0 : 1, chromePointer: full && st.idle ? "none" : "auto",
      wake: () => this._wake(),
      fullLabel: full ? "Exit full screen" : "Full screen", fullMask: M(full ? "minimize" : "maximize"),
      hasPanel: !full && !!(p.onTogglePanel || p.onDetails), onTogglePanel: () => { if (p.onTogglePanel) p.onTogglePanel(); else if (p.onDetails) p.onDetails(); },
      panelOpenStr: String(!!(p.onTogglePanel && p.panelOpen)), panelLabel: p.onTogglePanel && p.panelOpen ? "Hide details" : "Details", panelBg: p.onTogglePanel && p.panelOpen ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.4)",
      onMinimise: () => { if (p.onMinimise) p.onMinimise(); },
      onToggleFull: () => { if (p.onToggleFull) p.onToggleFull(!full); },
      toggleShare: () => set({ sharing: !st.sharing }),
      pillBottom: full ? "20px" : "12px", btnSizeKey: full ? "lg" : "md", btnSize: full ? "56px" : "50px", icoSize: full ? "22px" : "20px",
      controls: [
        btn(muted ? "Unmute" : "Mute", muted ? "mic-off" : "mic", muted ? "off" : "", () => { if (p.onToggleMute) p.onToggleMute(); }, muted),
        btn(cam ? "Turn camera off" : "Turn camera on", cam ? "video" : "video-off", cam ? "" : "off", () => set({ cam: !cam }), !cam),
        btn(st.sharing ? "Stop sharing" : "Share screen", "screen-share", st.sharing ? "on" : "", () => set({ sharing: !st.sharing }), st.sharing),
        btn("Leave call", "phone-off", "end", () => { if (p.onLeave) p.onLeave(); }),
      ],
    };
  }
}

export default Component;

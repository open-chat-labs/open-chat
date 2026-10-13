// Logic for AchievementToast.svelte — carried over from lib/AchievementToast.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../../lib/dc/logic.js';

// Achievement unlocked toast (options/Achievement Toast - Options, 3a). Plays once on mount: medal pops in, pill opens
// straight to full width with a light sweep, "Achievement unlocked" rolls up to the title, CHIT counts up, confetti.
// Absolutely positioned: the host gives it a relative, zero-height anchor (e.g. just above the composer).
// Remount with a new key to replay. Hover holds it open; click → onClick; finished → onDone. Reduced motion: fade only.
const COLORS = ["var(--accent,#FF5672)", "var(--accent-bright,#FF8298)", "#ffd166", "#ffffff", "#7fe0d0", "#b48cff"];
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

class Component extends DCLogic {
  state = {};
  pillRef = React.createRef(); sweepRef = React.createRef(); glowRef = React.createRef(); rowRef = React.createRef(); medalRef = React.createRef();
  ringRef = React.createRef(); textRef = React.createRef(); rollRef = React.createRef(); chipRef = React.createRef(); numRef = React.createRef();
  componentDidMount() { this._t0 = setTimeout(() => this.play(), 60); }
  componentWillUnmount() { clearTimeout(this._t0); (this._timers || []).forEach(clearTimeout); clearInterval(this._cnt); (this._anims || []).forEach(a => a.cancel()); }
  later(fn, ms) { (this._timers = this._timers || []).push(setTimeout(fn, ms)); }
  anim(el, k, o) { if (!el) return null; const a = el.animate(k, o); (this._anims = this._anims || []).push(a); return a; }
  play() {
    const pill = this.pillRef.current, row = this.rowRef.current, num = this.numRef.current, chip = this.chipRef.current;
    if (!pill || !row) return;
    const reward = this.props.reward ?? 500;
    if (num) num.textContent = "+" + reward.toLocaleString("en-US");
    const W = row.scrollWidth;
    if (num) num.textContent = "+0";
    const total = 6600, f = ms => ms / total, out = 5300, open = { width: W + "px", marginLeft: -W / 2 + "px" }, shut = { width: "64px", marginLeft: "-32px" };
    const done = () => { if (this.props.onDone) this.props.onDone(); };
    if (reduced()) {
      if (num) num.textContent = "+" + reward.toLocaleString("en-US");
      this.anim(pill, [Object.assign({ opacity: 0 }, open), Object.assign({ opacity: 1, offset: .1 }, open), Object.assign({ opacity: 1, offset: .9 }, open), Object.assign({ opacity: 0 }, open)], { duration: 5000, fill: "forwards" }).onfinish = done;
      [this.textRef.current, chip].forEach(el => this.anim(el, [{ opacity: 1 }, { opacity: 1 }], { duration: 5000, fill: "forwards" }));
      this.anim(this.rollRef.current, [{ transform: "translateY(-40px)" }, { transform: "translateY(-40px)" }], { duration: 5000, fill: "forwards" });
      return;
    }
    const main = this.anim(pill, [
      Object.assign({ opacity: 0, transform: "translateY(16px) scale(.4)" }, shut),
      Object.assign({ opacity: 1, transform: "scale(1.08)", offset: f(380), easing: "cubic-bezier(.3,1.4,.6,1)" }, shut),
      Object.assign({ opacity: 1, transform: "none", offset: f(650), easing: "cubic-bezier(.2,.9,.3,1)" }, shut),
      Object.assign({ opacity: 1, transform: "none", offset: f(1200) }, open),
      Object.assign({ opacity: 1, transform: "none", offset: f(out), easing: "cubic-bezier(.6,0,.8,.4)" }, open),
      Object.assign({ opacity: 1, transform: "none", offset: f(out + 420) }, shut),
      Object.assign({ opacity: 0, transform: "translateY(10px) scale(.6)" }, shut),
    ], { duration: total, fill: "forwards" });
    main.onfinish = done; this._main = main;
    this.anim(this.sweepRef.current, [{ opacity: 0, transform: "rotate(0deg)" }, { opacity: 1, transform: "rotate(200deg)", offset: .15 }, { opacity: 1, transform: "rotate(720deg)", offset: .8 }, { opacity: 0, transform: "rotate(900deg)" }], { duration: 1700, delay: 600, easing: "cubic-bezier(.3,.1,.3,1)", fill: "forwards" });
    this.anim(this.glowRef.current, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: .5, offset: .85 }, { opacity: 0 }], { duration: out - 600, delay: 650, fill: "forwards" });
    this.anim(this.ringRef.current, [{ opacity: .9, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.9)" }], { duration: 700, delay: 380, easing: "ease-out", fill: "forwards" });
    this.anim(this.textRef.current, [{ opacity: 0 }, { opacity: 0, offset: f(800) }, { opacity: 1, offset: f(1150) }, { opacity: 1, offset: f(out) }, { opacity: 0, offset: f(out + 200) }, { opacity: 0 }], { duration: total, fill: "forwards" });
    this.anim(this.rollRef.current, [{ transform: "translateY(0)" }, { transform: "translateY(0)", offset: f(2000) }, { transform: "translateY(-44px)", offset: f(2300), easing: "cubic-bezier(.3,1.4,.6,1)" }, { transform: "translateY(-40px)", offset: f(2450) }, { transform: "translateY(-40px)" }], { duration: total, fill: "forwards" });
    this.anim(chip, [{ opacity: 0, transform: "scale(.6)" }, { opacity: 0, transform: "scale(.6)", offset: f(2200) }, { opacity: 1, transform: "scale(1)", offset: f(2450) }, { opacity: 1, transform: "scale(1)", offset: f(out) }, { opacity: 0, offset: f(out + 150) }, { opacity: 0 }], { duration: total, fill: "forwards" });
    this.later(() => { this.setState(s => ({ medalBurst: (s.medalBurst || 0) + 1 })); }, 380);
    if (chip && num) this.later(() => {
      const t0 = performance.now(), D = 900;
      this._cnt = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / D), e = 1 - Math.pow(1 - k, 3);
        num.textContent = "+" + Math.round(reward * e).toLocaleString("en-US");
        if (k >= 1) { clearInterval(this._cnt); chip.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out", composite: "add" }); this.setState(s => ({ chipBurst: (s.chipBurst || 0) + 1 })); }
      }, 30);
    }, 2500);
  }
  renderVals() {
    const p = this.props, reward = p.reward ?? 500, medalBurst = this.state.medalBurst || 0, chipBurst = this.state.chipBurst || 0, title = p.title ?? "Say cheese";
    // hovering holds the toast open (pauses every running animation)
    const each = fn => (this._anims || []).forEach(a => { if (a.playState === "running" || a.playState === "paused") fn(a); });
    return { medalBurst, chipBurst,
      pillRef: this.pillRef, sweepRef: this.sweepRef, glowRef: this.glowRef, rowRef: this.rowRef, medalRef: this.medalRef,
      ringRef: this.ringRef, textRef: this.textRef, rollRef: this.rollRef, chipRef: this.chipRef, numRef: this.numRef,
      title, hasReward: reward > 0, iconMask: "var(--icon-" + (p.icon ?? "camera") + ") center/contain no-repeat",
      kicker: p.kicker ?? "Achievement unlocked", aria: (p.kicker ?? "Achievement unlocked") + ": " + title + (reward ? ", plus " + reward + " CHIT" : ""),
      onClick: () => { if (p.onClick) p.onClick(); },
      pause: () => { if (this._main && this._main.currentTime > 1300) each(a => a.pause()); },
      resume: () => each(a => a.play()),
    };
  }
}

export default Component;

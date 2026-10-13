// Logic for Confetti.svelte — carried over from lib/Confetti.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Confetti burst from the parent element (put it inside the thing that celebrates, e.g. a Claim button).
// Bumps of `fire` trigger a burst. Physics: launch up, air drag eases each piece to a stop, gravity takes over;
// every piece has its own drag/gravity/flutter so they peak and fall at staggered times. Skipped with reduced motion.
function burst(el, o) {
o = Object.assign({ count: 80, spread: 92, power: 1 }, Object.fromEntries(Object.entries(o || {}).filter(e => e[1] != null)));
  if (!el || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const acc = getComputedStyle(el).getPropertyValue("--accent").trim() || "#FF5672";
  const colors = [acc, acc, "#FFFFFF", "#FFC061", "#2EE6A8", "#3D9BFF", "#E27BFF"];
  const layer = document.createElement("div");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(layer);
  const parts = [];
  for (let k = 0; k < o.count; k++) {
    const node = document.createElement("span"), w = 5 + Math.random() * 5, h = Math.random() < .5 ? w : w * .45;
    node.style.cssText = "position:absolute;left:0;top:0;width:" + w + "px;height:" + h + "px;border-radius:" + (Math.random() < .3 ? "50%" : "1px") + ";background:" + colors[k % colors.length] + ";will-change:transform,opacity";
    layer.appendChild(node);
    const ang = -Math.PI / 2 + (Math.random() - .5) * (o.spread * Math.PI / 180), v = (520 + Math.random() * 520) * o.power;
    parts.push({ node, x: cx + (Math.random() - .5) * r.width * .6, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
      drag: 2.2 + Math.random() * 2.4, g: 520 + Math.random() * 380, rot: Math.random() * 360, vr: (Math.random() - .5) * 720,
      sway: 14 + Math.random() * 26, phase: Math.random() * 6.28, life: 2.2 + Math.random() * 1.4, t: 0 });
  }
  let last = performance.now();
  const step = now => {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    let alive = 0;
    for (const p of parts) {
      p.t += dt;
      if (p.t > p.life) { p.node.style.opacity = "0"; continue; }
      alive++;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.g * dt * (p.vy < 0 ? 0.6 : 0.35);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const flutter = p.vy > 0 ? Math.sin(p.t * 5 + p.phase) * p.sway : 0;
      const fade = Math.min(1, (p.life - p.t) / 0.6);
      p.node.style.transform = "translate(" + (p.x + flutter) + "px," + p.y + "px) rotate(" + p.rot + "deg) rotateX(" + (p.t * 400 + p.phase * 60) + "deg)";
      p.node.style.opacity = String(fade);
    }
    if (alive) requestAnimationFrame(step); else layer.remove();
  };
  requestAnimationFrame(step);
}
class Component extends DCLogic {
  ref = React.createRef();
  componentDidUpdate(prev) { if (this.props.fire && this.props.fire !== prev.fire) { let el = this.ref.current && this.ref.current.parentElement; while (el && (el.getBoundingClientRect().width < 2 || el.getBoundingClientRect().height < 2)) el = el.parentElement; burst(el, { count: this.props.count, spread: this.props.spread, power: this.props.power }); } }
  renderVals() { return { ref: this.ref }; }
}

export default Component;

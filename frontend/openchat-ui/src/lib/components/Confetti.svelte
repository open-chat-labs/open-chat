<!-- Confetti burst from the parent element (put it inside the thing that celebrates, e.g. a Claim button).
     Each change of `fire` to a new truthy value triggers a burst. Physics: launch up, air drag eases each piece to a stop,
     gravity takes over; every piece has its own drag/gravity/flutter so they peak and fall at staggered times. Skipped with reduced motion. -->
<script lang="ts">
  import { untrack } from 'svelte';

  interface Props {
    count?: number;
    /** Cone width in degrees. */
    spread?: number;
    /** Launch speed multiplier. */
    power?: number;
    fire?: number;
    /** CSS selector of an ancestor to clip the burst to (e.g. a device frame); the whole viewport without it. */
    within?: string;
  }

  let { count = 80, spread = 92, power = 1, fire = 0, within }: Props = $props();

  let anchor: HTMLSpanElement;
  let last = untrack(() => fire);

  $effect(() => {
    const next = fire;
    if (next && next !== last) {
      untrack(() => {
        // burst from the nearest ancestor with a real box
        let el = anchor.parentElement;
        while (el && (el.getBoundingClientRect().width < 2 || el.getBoundingClientRect().height < 2)) el = el.parentElement;
        if (el) burst(el);
      });
    }
    last = next;
  });

  interface Piece {
    node: HTMLSpanElement;
    x: number;
    y: number;
    vx: number;
    vy: number;
    drag: number;
    g: number;
    rot: number;
    vr: number;
    sway: number;
    phase: number;
    life: number;
    t: number;
  }

  function burst(el: HTMLElement) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const acc = getComputedStyle(el).getPropertyValue('--accent').trim() || '#FF5672';
    const colors = [acc, acc, '#FFFFFF', '#FFC061', '#2EE6A8', '#3D9BFF', '#E27BFF'];
    const layer = document.createElement('div');
    // an invalid selector clips to nothing rather than stopping the burst
    let box: Element | null = null;
    if (within) {
      try {
        box = el.closest(within);
      } catch {
        box = null;
      }
    }
    let ox = 0, oy = 0;
    // the clip, and the pieces in it, follow the ancestor if it scrolls or moves during the burst
    const place = () => {
      if (!box) return;
      const b = box.getBoundingClientRect();
      ox = b.left;
      oy = b.top;
      layer.style.left = `${b.left}px`;
      layer.style.top = `${b.top}px`;
      layer.style.width = `${b.width}px`;
      layer.style.height = `${b.height}px`;
    };
    if (box) {
      layer.style.cssText = `position:fixed;border-radius:${getComputedStyle(box).borderRadius};pointer-events:none;z-index:9999;overflow:hidden`;
      place();
    } else {
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
    }
    document.body.appendChild(layer);
    const parts: Piece[] = [];
    for (let k = 0; k < count; k++) {
      const node = document.createElement('span'), w = 5 + Math.random() * 5, h = Math.random() < 0.5 ? w : w * 0.45;
      node.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;border-radius:${Math.random() < 0.3 ? '50%' : '1px'};background:${colors[k % colors.length]};will-change:transform,opacity`;
      layer.appendChild(node);
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * ((spread * Math.PI) / 180), v = (520 + Math.random() * 520) * power;
      parts.push({
        // relative to the clip box (from where it was at fire time), so the pieces move with it
        node, x: cx - ox + (Math.random() - 0.5) * r.width * 0.6, y: cy - oy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        drag: 2.2 + Math.random() * 2.4, g: 520 + Math.random() * 380, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 720,
        sway: 14 + Math.random() * 26, phase: Math.random() * 6.28, life: 2.2 + Math.random() * 1.4, t: 0,
      });
    }
    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.033, (now - prev) / 1000);
      prev = now;
      let alive = 0;
      place();
      for (const p of parts) {
        p.t += dt;
        if (p.t > p.life) {
          p.node.style.opacity = '0';
          continue;
        }
        alive++;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy = p.vy * k + p.g * dt * (p.vy < 0 ? 0.6 : 0.35);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const flutter = p.vy > 0 ? Math.sin(p.t * 5 + p.phase) * p.sway : 0;
        const fade = Math.min(1, (p.life - p.t) / 0.6);
        p.node.style.transform = `translate(${p.x + flutter}px,${p.y}px) rotate(${p.rot}deg) rotateX(${p.t * 400 + p.phase * 60}deg)`;
        p.node.style.opacity = String(fade);
      }
      if (alive) requestAnimationFrame(step);
      else layer.remove();
    };
    requestAnimationFrame(step);
  }
</script>

<span class="anchor" bind:this={anchor} aria-hidden="true"></span>

<style>
  .anchor {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>

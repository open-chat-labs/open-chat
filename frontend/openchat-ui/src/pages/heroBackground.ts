// Landing hero backdrop: a field of hexagons, faded out towards the edges, that light up in the accent colour, either as
// ripples spreading from random cells ('pulse') or a slow drifting band ('aurora'). Colours come from the canvas's
// computed style (`--accent`, and `color` for the hexagon outlines), so they follow the theme root it sits under.
// With reduced motion, or style 'off', it draws one frame and doesn't animate. Pauses while scrolled out of view.

export type HeroStyle = 'pulse' | 'aurora' | 'off';

const HEX_R = 30;
const SQ3 = Math.sqrt(3);
// a ripple's front is a gaussian of this width; beyond 3 sigma from it a cell gets no visible glow
const RIPPLE_SIGMA = 38;
const RIPPLE_REACH = 3 * RIPPLE_SIGMA;

type Cell = { x: number; y: number; mask: number };
type Ripple = { x: number; y: number; t0: number; speed: number; life: number; amp: number };
/** A ripple at one moment: where its front is and how strong. */
type Front = { x: number; y: number; front: number; strength: number };

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class HeroBackground {
  private ctx: CanvasRenderingContext2D;
  private cells: Cell[] = [];
  /** Cells bright enough to start a ripple from; rebuilt with the cells on resize. */
  private spawnPool: Cell[] = [];
  private ripples: Ripple[] = [];
  private fronts: Front[] = [];
  private nextRipple = 0;
  private nextCentre = 3;
  private w = 0;
  private h = 0;
  private visible = true;
  private raf = 0;
  private dead = false;
  private accent = '';
  private ink = '';
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  readonly reduced = prefersReducedMotion();

  /** Null when the browser can't draw on a canvas (nothing to clean up then). */
  static create(canvas: HTMLCanvasElement, opts: () => { style: HeroStyle; light: boolean }): HeroBackground | null {
    const ctx = canvas.getContext?.('2d');
    return ctx ? new HeroBackground(canvas, ctx, opts) : null;
  }

  private constructor(
    private cv: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    private opts: () => { style: HeroStyle; light: boolean },
  ) {
    this.ctx = ctx;
    if (typeof ResizeObserver === 'function') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(cv);
    }
    if (typeof IntersectionObserver === 'function') {
      this.io = new IntersectionObserver((es) => {
        this.visible = es[0].isIntersecting;
        if (this.visible) this.kick();
      });
      this.io.observe(cv);
    }
    this.resize();
  }

  /** Re-measure and re-read the theme colours (call after the mode or accent changes). */
  resize() {
    if (this.dead) return;
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = r.width;
    this.h = r.height;
    this.cv.width = r.width * dpr;
    this.cv.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = SQ3 * HEX_R;
    const rh = 1.5 * HEX_R;
    const cells: Cell[] = [];
    for (let row = -1; row * rh < this.h + HEX_R; row++) {
      for (let col = -1; col * cw < this.w + cw; col++) {
        const x = col * cw + (row & 1 ? cw / 2 : 0);
        const y = row * rh;
        const dx = (x - this.w / 2) / (this.w * 0.55);
        const dy = (y - this.h * 0.18) / (this.h * 0.55);
        const mask = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) * Math.min(1, Math.max(0, (this.h * 0.92 - y) / (this.h * 0.3)));
        if (mask > 0.01) cells.push({ x, y, mask });
      }
    }
    this.cells = cells;
    this.spawnPool = cells.filter((c) => c.mask > 0.3);
    const cs = getComputedStyle(this.cv);
    this.accent = cs.getPropertyValue('--accent').trim();
    this.ink = cs.color;
    // a still backdrop draws once here; an animated one (also after a switch from 'off') runs its loop
    if (this.still()) this.draw(performance.now() / 1000);
    else this.kick();
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.io?.disconnect();
  }

  private still() {
    return this.reduced || this.opts().style === 'off';
  }

  private kick() {
    if (this.still() || this.raf || this.dead) return;
    const loop = () => {
      this.raf = 0;
      if (!this.visible || this.dead) return;
      this.draw(performance.now() / 1000);
      // switched to 'off' mid-run: that frame cleared the canvas, and nothing else needs drawing
      if (this.still()) return;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private hex(x: number, y: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      if (i) c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      else c.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    c.closePath();
  }

  private glowPulse(cell: Cell) {
    let g = 0;
    for (const f of this.fronts) {
      const dx = cell.x - f.x;
      const dy = cell.y - f.y;
      const off = Math.sqrt(dx * dx + dy * dy) - f.front;
      if (off > RIPPLE_REACH || off < -RIPPLE_REACH) continue;
      g += Math.exp(-(off * off) / (2 * RIPPLE_SIGMA * RIPPLE_SIGMA)) * f.strength;
    }
    return Math.min(1, g);
  }

  private glowAurora(t: number, cell: Cell) {
    const { x, y } = cell;
    const h = this.h;
    const band = h * 0.3 + Math.sin(x * 0.0035 + t * 0.18) * h * 0.12 + Math.sin(x * 0.009 - t * 0.11) * 36;
    const v = Math.exp(-((y - band) ** 2) / (2 * 95 * 95));
    const sweep = 0.45 + 0.55 * Math.max(0, Math.sin(x * 0.0025 - t * 0.32));
    return v * sweep;
  }

  private draw(t: number) {
    const { ctx: c, w, h } = this;
    const o = this.opts();
    c.clearRect(0, 0, w, h);
    if (o.style === 'off' || !this.cells.length) return;
    const pulse = o.style === 'pulse';
    if (pulse) {
      this.ripples = this.ripples.filter((r) => t - r.t0 < r.life);
      if (t > this.nextRipple) {
        const pool = this.spawnPool;
        const cc = pool[Math.floor(Math.random() * pool.length)] ?? this.cells[0];
        this.ripples.push({ x: cc.x, y: cc.y, t0: t, speed: 70 + Math.random() * 40, life: 4.5, amp: 0.8 });
        this.nextRipple = t + 1.4 + Math.random() * 1.6;
      }
      if (t > this.nextCentre) {
        this.ripples.push({ x: w / 2, y: h * 0.62, t0: t, speed: 150, life: 5, amp: 1 });
        this.nextCentre = t + 8;
      }
      // each ripple's front and fade, once per frame rather than once per cell
      this.fronts = this.ripples.map((r) => {
        const age = t - r.t0;
        return { x: r.x, y: r.y, front: age * r.speed, strength: Math.max(0, 1 - age / r.life) * r.amp };
      });
    }
    c.lineWidth = 1;
    const base = o.light ? 0.12 : 0.06;
    const fillK = (pulse ? 0.22 : 0.16) * (o.light ? 1.6 : 1);
    const strokeK = o.light ? 1.3 : 0.9;
    for (const cell of this.cells) {
      const g = (pulse ? this.glowPulse(cell) : this.glowAurora(t, cell)) * cell.mask;
      this.hex(cell.x, cell.y, HEX_R - 2);
      if (g > 0.02 && this.accent) {
        c.globalAlpha = Math.min(1, g * fillK);
        c.fillStyle = this.accent;
        c.fill();
        c.globalAlpha = Math.min(1, g * strokeK);
        c.strokeStyle = this.accent;
        c.stroke();
      }
      c.globalAlpha = base * cell.mask;
      c.strokeStyle = this.ink;
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

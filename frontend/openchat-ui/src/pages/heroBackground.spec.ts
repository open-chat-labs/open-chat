import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HeroBackground, type HeroStyle } from './heroBackground';

describe('HeroBackground', () => {
  let frames: FrameRequestCallback[];
  let now: number;
  let ctx: Record<string, unknown>;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    frames = [];
    now = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
    ctx = new Proxy({} as Record<string, unknown>, {
      get: (o, k) => (k in o ? o[k as string] : () => {}),
      set: (o, k, v) => ((o[k as string] = v), true),
    });
    ctx.clearRect = vi.fn();
    canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 1440, height: 720 } as DOMRect);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Runs the queued animation frame, `dt` seconds on. */
  const frame = (dt = 0.016) => {
    now += dt * 1000;
    const next = frames.shift();
    next?.(now);
    return next !== undefined;
  };

  test("'off' draws one cleared frame and doesn't animate; switching to a style starts the loop", () => {
    let style: HeroStyle = 'off';
    const bg = HeroBackground.create(canvas, () => ({ style, light: false }))!;
    expect(frames).toHaveLength(0);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    style = 'pulse';
    bg.resize();
    expect(frames).toHaveLength(1);
    bg.destroy();
  });

  test("switching to 'off' mid-run clears the canvas and stops the loop", () => {
    let style: HeroStyle = 'aurora';
    const bg = HeroBackground.create(canvas, () => ({ style, light: false }))!;
    expect(frame()).toBe(true);
    expect(frames).toHaveLength(1);
    style = 'off';
    vi.mocked(ctx.clearRect as () => void).mockClear();
    frame();
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
    bg.destroy();
  });

  test('the first ripples are timed from when the backdrop starts, not from page load', () => {
    // long after page load: the centre ripple still waits its 3s, while a random one starts straight away
    now = 600_000;
    const bg = HeroBackground.create(canvas, () => ({ style: 'pulse', light: false }))!;
    const ripples = () => (bg as unknown as { ripples: { speed: number }[] }).ripples;
    frame();
    expect(ripples()).toHaveLength(1);
    expect(ripples()[0].speed).toBeLessThan(150);
    for (let i = 0; i < 200 && !ripples().some((r) => r.speed === 150); i++) frame();
    expect(now).toBeGreaterThan(603_000);
    expect(ripples().some((r) => r.speed === 150)).toBe(true);
    bg.destroy();
  });

  test('visibility follows the latest IntersectionObserver entry', () => {
    let report: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof report) {
          report = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const bg = HeroBackground.create(canvas, () => ({ style: 'aurora', light: false }))!;
    // scrolled out then back in within one batch: still visible, so the loop keeps going
    report([{ isIntersecting: false }, { isIntersecting: true }]);
    expect(frame()).toBe(true);
    expect(frames).toHaveLength(1);
    // in then out: hidden, so the next frame stops the loop
    report([{ isIntersecting: true }, { isIntersecting: false }]);
    frame();
    expect(frames).toHaveLength(0);
    bg.destroy();
  });

  test('pulse frames only work out the glow for cells near a ripple front, and spawn without rescanning the cells', () => {
    const bg = HeroBackground.create(canvas, () => ({ style: 'pulse', light: false }))!;
    const cells = (bg as unknown as { cells: unknown[] }).cells.length;
    // run until both ripple kinds are live (a random one and the centre one at t > 3s)
    for (let i = 0; i < 300; i++) frame();
    const live = (bg as unknown as { ripples: unknown[] }).ripples.length;
    expect(live).toBeGreaterThanOrEqual(2);
    const exp = vi.spyOn(Math, 'exp');
    const filter = vi.spyOn(Array.prototype, 'filter');
    // a frame that spawns a ripple
    (bg as unknown as { nextRipple: number }).nextRipple = 0;
    frame();
    expect(exp.mock.calls.length).toBeLessThan((cells * live) / 2);
    // only the expired-ripple sweep filters; the spawn pool comes from resize()
    expect(filter).toHaveBeenCalledTimes(1);
    bg.destroy();
  });
});

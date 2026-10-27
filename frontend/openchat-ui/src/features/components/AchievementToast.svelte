<!-- Achievement unlocked toast. Plays once on mount: medal pops in, pill opens straight to full width with a light sweep,
     the kicker rolls up to the title, CHIT counts up, confetti. Absolutely positioned: the host gives it a relative,
     zero-height anchor (e.g. just above the composer). Remount with a new key to replay. Hover holds it open;
     click → onClick; finished → onDone. Reduced motion: fade only. -->
<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import { onMount } from 'svelte';
  import Confetti from '../../lib/components/Confetti.svelte';
  const i18n = getI18n(); // number formatting follows the host locale

  interface Props {
    /** Achievement name: resource key (or literal text). */
    title: string;
    /** Resource key (or literal text). */
    kicker?: string;
    /** CHIT counted up on the chip; 0 hides the chip. */
    reward?: number;
    /** Icon name from icons.css for the medal. */
    icon?: string;
    onClick?: () => void;
    onDone?: () => void;
    /** 1 = the authored timing; 1.25 plays 20% faster (every duration, delay and timer). */
    speed?: number;
    /** Speeds up only the collapse and fade at the end; the entrance and hold keep their timing. */
    outroSpeed?: number;
  }

  let { title, kicker = 'ui.achievementToast.unlocked', reward = 0, icon = 'camera', onClick, onDone, speed = 1, outroSpeed = 1 }: Props = $props();
  const t = useT();

  let pill: HTMLDivElement;
  let sweep: HTMLSpanElement;
  let glow: HTMLSpanElement;
  let row: HTMLDivElement;
  let ring: HTMLSpanElement;
  let text: HTMLDivElement;
  let roll: HTMLDivElement;
  let chip = $state<HTMLSpanElement>();
  let num = $state<HTMLSpanElement>();

  let medalBurst = $state(0);
  let chipBurst = $state(0);

  const anims: Animation[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let counter: ReturnType<typeof setInterval> | undefined;
  let main: Animation | null = null;

  const fmt = (n: number) => `+${n.toLocaleString(i18n.locale ?? 'en')}`;

  const sp = () => Math.max(0.25, speed);
  const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms / sp()));

  function animate(el: Element | undefined, keys: Keyframe[], opts: KeyframeAnimationOptions) {
    if (!el) return null;
    const timed = { ...opts };
    if (typeof timed.duration === 'number') timed.duration /= sp();
    if (timed.delay) timed.delay /= sp();
    if (timed.endDelay) timed.endDelay /= sp();
    const a = el.animate(keys, timed);
    anims.push(a);
    return a;
  }

  function play() {
    if (!pill || !row) return;
    // measure the open width with the final number in place
    if (num) num.textContent = fmt(reward);
    const W = row.scrollWidth;
    if (num) num.textContent = '+0';
    const os = Math.max(0.25, outroSpeed);
    const out = 5300, total = out + 1300 / os, f = (ms: number) => ms / total;
    const open = { width: `${W}px`, marginLeft: `${-W / 2}px` }, shut = { width: '64px', marginLeft: '-32px' };
    const done = () => onDone?.();

    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (num) num.textContent = fmt(reward);
      const fade = animate(pill, [{ opacity: 0, ...open }, { opacity: 1, offset: 0.1, ...open }, { opacity: 1, offset: 0.9, ...open }, { opacity: 0, ...open }], { duration: 5000, fill: 'forwards' });
      if (fade) fade.onfinish = done;
      [text, chip].forEach((el) => animate(el, [{ opacity: 1 }, { opacity: 1 }], { duration: 5000, fill: 'forwards' }));
      animate(roll, [{ transform: 'translateY(-40px)' }, { transform: 'translateY(-40px)' }], { duration: 5000, fill: 'forwards' });
      return;
    }

    main = animate(
      pill,
      [
        { opacity: 0, transform: 'translateY(16px) scale(.4)', ...shut },
        { opacity: 1, transform: 'scale(1.08)', offset: f(380), easing: 'cubic-bezier(.3,1.4,.6,1)', ...shut },
        { opacity: 1, transform: 'none', offset: f(650), easing: 'cubic-bezier(.2,.9,.3,1)', ...shut },
        { opacity: 1, transform: 'none', offset: f(1200), ...open },
        { opacity: 1, transform: 'none', offset: f(out), easing: 'cubic-bezier(.6,0,.8,.4)', ...open },
        { opacity: 1, transform: 'none', offset: f(out + 420 / os), ...shut },
        { opacity: 0, transform: 'translateY(10px) scale(.6)', ...shut },
      ],
      { duration: total, fill: 'forwards' },
    );
    if (main) main.onfinish = done;
    animate(sweep, [{ opacity: 0, transform: 'rotate(0deg)' }, { opacity: 1, transform: 'rotate(200deg)', offset: 0.15 }, { opacity: 1, transform: 'rotate(720deg)', offset: 0.8 }, { opacity: 0, transform: 'rotate(900deg)' }], {
      duration: 1700,
      delay: 600,
      easing: 'cubic-bezier(.3,.1,.3,1)',
      fill: 'forwards',
    });
    animate(glow, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.5, offset: 0.85 }, { opacity: 0 }], { duration: out - 600, delay: 650, fill: 'forwards' });
    animate(ring, [{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.9)' }], { duration: 700, delay: 380, easing: 'ease-out', fill: 'forwards' });
    animate(text, [{ opacity: 0 }, { opacity: 0, offset: f(800) }, { opacity: 1, offset: f(1150) }, { opacity: 1, offset: f(out) }, { opacity: 0, offset: f(out + 200 / os) }, { opacity: 0 }], {
      duration: total,
      fill: 'forwards',
    });
    animate(
      roll,
      [
        { transform: 'translateY(0)' },
        { transform: 'translateY(0)', offset: f(2000) },
        { transform: 'translateY(-44px)', offset: f(2300), easing: 'cubic-bezier(.3,1.4,.6,1)' },
        { transform: 'translateY(-40px)', offset: f(2450) },
        { transform: 'translateY(-40px)' },
      ],
      { duration: total, fill: 'forwards' },
    );
    animate(
      chip,
      [
        { opacity: 0, transform: 'scale(.6)' },
        { opacity: 0, transform: 'scale(.6)', offset: f(2200) },
        { opacity: 1, transform: 'scale(1)', offset: f(2450) },
        { opacity: 1, transform: 'scale(1)', offset: f(out) },
        { opacity: 0, offset: f(out + 150 / os) },
        { opacity: 0 },
      ],
      { duration: total, fill: 'forwards' },
    );
    later(() => medalBurst++, 380);
    if (chip && num) {
      const c = chip, n = num;
      later(() => {
          const t0 = performance.now(), D = 900 / sp();
          counter = setInterval(() => {
            const k = Math.min(1, (performance.now() - t0) / D), e = 1 - Math.pow(1 - k, 3);
            n.textContent = fmt(Math.round(reward * e));
            if (k >= 1) {
              clearInterval(counter);
              c.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 320 / sp(), easing: 'ease-out', composite: 'add' });
              chipBurst++;
            }
          }, 30);
        }, 2500);
    }
  }

  onMount(() => {
    const start = setTimeout(play, 60);
    return () => {
      clearTimeout(start);
      timers.forEach(clearTimeout);
      clearInterval(counter);
      anims.forEach((a) => a.cancel());
    };
  });

  // hovering holds the toast open (pauses every running animation)
  const each = (fn: (a: Animation) => void) => anims.forEach((a) => (a.playState === 'running' || a.playState === 'paused') && fn(a));
</script>

<div
  class="pill"
  bind:this={pill}
  role="status"
  aria-live="polite"
  aria-label={t(reward ? 'ui.achievementToast.announceReward' : 'ui.achievementToast.announce', { kicker: t(kicker), title: t(title), reward })}
  onclick={() => onClick?.()}
  onmouseenter={() => main && (main.currentTime as number) > 1300 / sp() && each((a) => a.pause())}
  onmouseleave={() => each((a) => a.play())}
>
  <span class="sweep" bind:this={sweep}></span>
  <span class="face"></span>
  <span class="glow" bind:this={glow}></span>
  <div class="row" bind:this={row} aria-hidden="true">
    <div class="medal-slot">
      <div class="burst"><Confetti fire={medalBurst} count={40} spread={140} power={0.4} /></div>
      <span class="medal"><span class="medal-icon" style:mask="var(--icon-{icon}) center/contain no-repeat"></span></span>
      <span class="ring" bind:this={ring}></span>
    </div>
    <div class="text" bind:this={text}>
      <div class="roll" bind:this={roll}>
        <span class="kicker-line">{t(kicker)}</span>
        <span class="title-line"><span class="kicker-small">{t(kicker)}</span><span class="title">{t(title)}</span></span>
      </div>
    </div>
    {#if reward > 0}
      <span class="chip" bind:this={chip}
        ><div class="burst"><Confetti fire={chipBurst} count={34} spread={120} power={0.36} /></div>
        <span class="chit-icon"></span><span bind:this={num}>+0</span></span
      >
    {/if}
  </div>
</div>

<style>
  .pill {
    position: absolute;
    left: 50%;
    bottom: 0;
    height: 64px;
    width: 64px;
    margin-left: -32px;
    border-radius: 999px;
    overflow: hidden;
    opacity: 0;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    cursor: pointer;
    z-index: 20;
  }

  .sweep {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 640px;
    height: 640px;
    margin: -320px 0 0 -320px;
    background: conic-gradient(from 0deg, transparent 0deg, transparent 250deg, var(--accent) 300deg, #fff 330deg, var(--accent-bright) 345deg, transparent 360deg);
    opacity: 0;
  }

  .face {
    position: absolute;
    inset: 2px;
    border-radius: 999px;
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 35%, transparent);
  }

  .glow {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    box-shadow: inset 0 0 24px color-mix(in oklch, var(--accent) 45%, transparent);
    opacity: 0;
  }

  .row {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 100%;
    padding-right: 20px;
    white-space: nowrap;
  }

  .medal-slot {
    position: relative;
    flex: none;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .burst {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
  }

  .medal {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, var(--accent-bright), var(--accent) 55%, color-mix(in oklch, var(--accent) 60%, black));
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.25);
  }

  .medal-icon {
    width: 22px;
    height: 22px;
    background: #fff;
  }

  .ring {
    position: absolute;
    inset: 8px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--accent-bright);
    opacity: 0;
  }

  .text {
    flex: none;
    height: 40px;
    overflow: hidden;
    padding: 0 8px 0 4px;
    opacity: 0;
  }

  .roll {
    display: flex;
    flex-direction: column;
  }

  .kicker-line {
    height: 40px;
    display: flex;
    align-items: center;
    font: var(--weight-bold) 15px/1 var(--font-sans);
    color: var(--ink);
  }

  .title-line {
    height: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
  }

  .kicker-small {
    font: 600 10.5px/1 var(--font-mono);
    letter-spacing: 0.1em;
    color: var(--accent-bright);
    text-transform: uppercase;
  }

  .title {
    font: var(--weight-bold) 15px/1.1 var(--font-sans);
    color: var(--ink);
  }

  .chip {
    flex: none;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 11px;
    border-radius: 999px;
    background: color-mix(in oklch, var(--accent) 18%, transparent);
    font: 700 13px/1 var(--font-mono);
    color: var(--accent-bright);
    opacity: 0;
  }

  .chit-icon {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-chit) center/contain no-repeat;
  }
</style>

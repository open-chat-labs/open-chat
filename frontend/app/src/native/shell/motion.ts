import type { TransitionConfig } from "svelte/transition";

// The push stack's motion: going deeper, the new screen slides in from the right over the one
// under it and the tab bar, which stay put (decided 2026-11-06: the design notes' §3.1 had the one
// under it slide out to -28% and the bar go down), in .34s; going back slides it off again, quicker,
// in .24s (decided 2026-11-07: Back is a quick exit). Both on tokens.css's --ease-out, so the screen
// moves fastest at the start either way. Mirrored in RTL. None with reduced motion.

/** A push: the screen coming in. */
export const PUSH_MS = 340;
/** A pop (Back): the screen sliding off. */
export const POP_MS = 240;

/** CSS's cubic-bezier(x1, y1, x2, y2) as an easing function: progress (0–1) to how far along. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
    const bezier = (a: number, b: number, s: number) =>
        3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
    const slope = (a: number, b: number, s: number) =>
        3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s ** 2;
    return (t) => {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        // the curve's parameter s at which x is t: Newton's method, then halving if it stalls
        let s = t;
        for (let i = 0; i < 8; i++) {
            const error = bezier(x1, x2, s) - t;
            if (Math.abs(error) < 1e-6) return bezier(y1, y2, s);
            const d = slope(x1, x2, s);
            if (Math.abs(d) < 1e-6) break;
            s -= error / d;
        }
        let low = 0;
        let high = 1;
        s = t;
        for (let i = 0; i < 30; i++) {
            const x = bezier(x1, x2, s);
            if (Math.abs(x - t) < 1e-6) break;
            if (x < t) low = s;
            else high = s;
            s = (low + high) / 2;
        }
        return bezier(y1, y2, s);
    };
}

/** tokens.css's --ease-out. */
export const easeOut = cubicBezier(0.2, 0.8, 0.2, 1);

function reducedMotion(): boolean {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function slide(
    node: Element,
    play: boolean,
    ms: number,
    easing: (t: number) => number,
): TransitionConfig {
    // from the inline end: the right in LTR, the left in RTL
    const side = getComputedStyle(node).direction === "rtl" ? -1 : 1;
    return {
        duration: play && !reducedMotion() ? ms : 0,
        easing,
        css: (t) => `transform: translateX(${(1 - t) * 100 * side}%)`,
    };
}

/** A screen pushed: in from the inline end, if `play`. */
export function pushIn(node: Element, { play }: { play: () => boolean }): TransitionConfig {
    return slide(node, play(), PUSH_MS, easeOut);
}

/**
 * A screen popped: out to the inline end in POP_MS, if `play`; otherwise it goes at once (one
 * replaced goes under the screen taking its place). An outro's value is 1 less the eased time, so
 * on --ease-out the screen is off fastest at first and slows as it goes, as a push comes in (the
 * curve turned round, as it was before 2026-11-07, started it slowly and sped it off at the end).
 */
export function popOut(node: Element, { play }: { play: () => boolean }): TransitionConfig {
    return slide(node, play(), POP_MS, easeOut);
}

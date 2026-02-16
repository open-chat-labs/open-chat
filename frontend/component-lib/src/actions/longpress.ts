import { isTouchDevice, mobileOperatingSystem } from "component-lib";

// how close to the edge can we get for a longpress
const EDGE_TRESHOLD = 24;
const TRANSITION_DURATION = 250;

// Experience tells us that we get a strange rogue click event that fires after a long-press
// on Safari and we need to deliberately ignore this. No this is not nice.
function suppressNextClick() {
    if (mobileOperatingSystem !== "iOS") return;

    window.addEventListener(
        "click",
        (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
        },
        {
            capture: true,
            once: true,
        },
    );
}

// On android, OS level gestures will prevent touchmove events coming through
// and cause spurious firing of longpress events. Therefore we need to exclude
// any touchstart that begins within some safety threshold of the screen edge.
// Is this nice? No. Is this perfect? No.
function isEdgeTouch(e: TouchEvent) {
    const t = e.touches[0];
    const width = window.innerWidth;

    return t.clientX < EDGE_TRESHOLD || t.clientX > width - EDGE_TRESHOLD;
}

// Set scaling transitions on the longpress target node, without messing up
// any other transitions that are already set, though it may colide with any
// scale values previously set on the node.
function setTransitions(node: HTMLElement) {
    const current = window.getComputedStyle(node).transition;
    const newTransition = `scale ${TRANSITION_DURATION}ms ease-out`;

    // Check if the current transition is effectively "empty"
    // We look for '0s' which is the constant across all browsers for "no duration"
    const hasNoTransition =
        !current ||
        current === "none" ||
        current === "all" ||
        current.includes(" 0s") ||
        current.endsWith(" 0s");

    if (hasNoTransition) {
        node.style.transition = newTransition;
    } else {
        // Prevent double-adding the exact same transition
        if (!current.includes(newTransition)) {
            node.style.transition = `${current}, ${newTransition}`;
        }
    }
}

export type LongpressAnimation = "none" | "scale";

type Props = {
    onlongpress: (e: TouchEvent) => void;
    onpressactive?: () => void;
    animation?: LongpressAnimation;
    cooldown?: boolean;
    delay?: number;
};

// TODO this should basically just be props, but for backwards compatibility we use a union.
type LongpressArg = ((e: TouchEvent) => void) | Props;

export function longpress(node: HTMLElement, args?: LongpressArg) {
    if (args === undefined) return;

    let {
        onlongpress,
        onpressactive,
        animation = "none",
        cooldown = false,
        delay = 600,
    } = processArgs(args);

    let scaleAnimationEnabled = animation === "scale";
    let longPressTimer: number | undefined;
    let scalePressTimer: number | undefined;
    let startX = 0;
    let startY = 0;

    const originalScale = window.getComputedStyle(node).scale ?? "1.0";

    if (scaleAnimationEnabled) {
        setTransitions(node);
    }

    function processArgs(args: LongpressArg) {
        return "function" === typeof args ? { onlongpress: args } : args;
    }

    function onContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
    }

    function shrinkTarget() {
        if (scaleAnimationEnabled) {
            node.style.scale = "0.9";
        }
    }

    function restoreTargetScale() {
        if (scaleAnimationEnabled) {
            node.style.scale = "0.9";
            // Timeout kicks the CSS defined scale transition.
            requestAnimationFrame(() => {
                node.style.scale = originalScale;
            });
        }
    }

    function onTouchStart(e: TouchEvent) {
        if (cooldown || isEdgeTouch(e)) {
            return;
        }

        const t = e.changedTouches[0];
        startX = t.screenX;
        startY = t.screenY;
        clearLongPressTimer();

        scalePressTimer = window.setTimeout(() => {
            onpressactive?.();
            shrinkTarget();
        }, delay / 2);

        longPressTimer = window.setTimeout(() => {
            if (mobileOperatingSystem === "iOS") {
                suppressNextClick();
            }
            restoreTargetScale();
            onlongpress(e);
        }, delay);

        // This is so that the first (deepest) longpress wins and short-circuits the process
        // I'm not 100% sure that this isn't going to have some nasty side effect
        e.stopImmediatePropagation();
    }

    function onTouchMove(e: TouchEvent) {
        const {
            changedTouches: [t],
        } = e;
        const diffX = Math.abs(startX - t.screenX);
        const diffY = Math.abs(startY - t.screenY);
        if (diffX >= 10 || diffY >= 10) {
            clearLongPressTimer();
            restoreTargetScale();
        }
    }

    function clearLongPressTimer() {
        window.clearTimeout(scalePressTimer);
        window.clearTimeout(longPressTimer);
    }

    if (isTouchDevice) {
        node.addEventListener("touchend", () => {
            clearLongPressTimer();
            restoreTargetScale();
        });
        node.addEventListener("touchcancel", clearLongPressTimer);
        node.addEventListener("touchleave", clearLongPressTimer);
        node.addEventListener("touchmove", onTouchMove, { passive: true });
        node.addEventListener("touchstart", onTouchStart, { passive: true });
        node.addEventListener("contextmenu", onContextMenu);
    }

    return {
        // Args will be updated whenever they change!
        update(newArgs: LongpressArg) {
            // We only want cooldown updated for now
            const a = processArgs(newArgs);
            cooldown = a.cooldown ?? false;
        },
        destroy() {
            if (isTouchDevice) {
                node.removeEventListener("touchend", clearLongPressTimer);
                node.removeEventListener("touchcancel", clearLongPressTimer);
                node.removeEventListener("touchleave", clearLongPressTimer);
                node.removeEventListener("touchmove", onTouchMove);
                node.removeEventListener("touchstart", onTouchStart);
                node.removeEventListener("contextmenu", onContextMenu);
            }
        },
    };
}

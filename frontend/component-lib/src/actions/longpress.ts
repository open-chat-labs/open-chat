import { isTouchDevice, mobileOperatingSystem } from "component-lib";

// how close to the edge can we get for a longpress
const EDGE_TRESHOLD = 24;
const SCALE_EFFECT_TARGET = "0.95";
// Menu activates after 80% of the original delay time has passed.
const MENU_ACTIVATION_THRESHOLD = 0.8;

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
function setTransitions(node: HTMLElement, scaleDuration: number) {
    const current = window.getComputedStyle(node).transition;
    const newTransition = `scale ${scaleDuration}ms ease-out`;

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
    // Helps us prevent longpress-ing again when the menu is already shown, by
    // reseting a local var when isOpen value changes.
    isOpen?: boolean;
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
    let scaleDownTimer: number | undefined;
    let scaleUpTimer: number | undefined;
    let startX = 0;
    let startY = 0;
    let menuShown = false;

    const originalScale = window.getComputedStyle(node).scale ?? "1.0";

    if (scaleAnimationEnabled) {
        // We divide delay by 4, since scale down will start after half of delay
        // has passed already, so we have two quarts left to scale down then up.
        setTransitions(node, delay / 4);
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
            node.style.scale = SCALE_EFFECT_TARGET;
        }
    }

    function restoreTargetScale() {
        if (scaleAnimationEnabled) {
            node.style.scale = SCALE_EFFECT_TARGET;
            // Timeout kicks the CSS defined scale transition.
            requestAnimationFrame(() => {
                node.style.scale = originalScale;
            });
        }
    }

    function onTouchStart(e: TouchEvent) {
        if (cooldown || menuShown || isEdgeTouch(e)) {
            return;
        }

        const t = e.changedTouches[0];
        startX = t.screenX;
        startY = t.screenY;
        clearLongPressTimer();

        // Scale down starts when half of the longpress delay has passed. Animation
        // start does not mean the menu will open.
        scaleDownTimer = window.setTimeout(() => {
            onpressactive?.();
            shrinkTarget();
        }, delay / 2);

        scaleUpTimer = window.setTimeout(() => {
            window.clearTimeout(scaleDownTimer); // just in case of overlap
            restoreTargetScale();
        }, delay);

        // We activate the menu after threshold % of the time had passed. In
        // theory, this should prevent perceived issues with the menu where
        // users may release the longpress target before full timeout has
        // passed and no menu showed.
        longPressTimer = window.setTimeout(() => {
            if (mobileOperatingSystem === "iOS") {
                suppressNextClick();
            }
            menuShown = true;
            restoreTargetScale();
            onlongpress(e);
        }, delay * MENU_ACTIVATION_THRESHOLD);

        // This is so that the first (deepest) longpress wins and short-circuits the process
        // I'm not 100% sure that this isn't going to have some nasty side effect
        // (Note: with this enabled pan/swipe feature of the message bubble does not work since
        // it depends on the same event type.)
        // e.stopImmediatePropagation();
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
        window.clearTimeout(longPressTimer);
        window.clearTimeout(scaleDownTimer);
        window.clearTimeout(scaleUpTimer);
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
            const a = processArgs(newArgs);
            cooldown = a.cooldown ?? false;
            menuShown = a.isOpen ?? false;
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

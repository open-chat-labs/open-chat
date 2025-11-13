import TouchSweep from "touchsweep";

export type SwipeDirection = "up" | "down" | "left" | "right";

export type SwipeConfig = {
    threshold?: number;
    onSwipe?: (dir: SwipeDirection) => void;
};

export function onSwipeUp(fn: () => void) {
    return onSwipe("up", fn);
}

export function onSwipeDown(fn: () => void) {
    return onSwipe("down", fn);
}

export function onSwipeRight(fn: () => void) {
    return onSwipe("right", fn);
}

export function onSwipeLeft(fn: () => void) {
    return onSwipe("left", fn);
}

function onSwipe(match: SwipeDirection, fn: () => void) {
    return (dir: SwipeDirection) => {
        if (dir === match) {
            fn();
        }
    };
}

export function swipe(node: HTMLElement, config: SwipeConfig) {
    const { threshold = 30, onSwipe } = config;

    if (onSwipe === undefined) return;

    new TouchSweep(node, undefined, threshold);

    function left() {
        onSwipe?.("left");
    }
    function right() {
        onSwipe?.("right");
    }
    function down() {
        onSwipe?.("down");
    }
    function up() {
        onSwipe?.("up");
    }

    node.addEventListener("swipeleft", left);
    node.addEventListener("swiperight", right);
    node.addEventListener("swipedown", down);
    node.addEventListener("swipeup", up);

    return {
        destroy() {
            node.removeEventListener("swipeleft", left);
            node.removeEventListener("swiperight", right);
            node.removeEventListener("swipedown", down);
            node.removeEventListener("swipeup", up);
        },
    };
}

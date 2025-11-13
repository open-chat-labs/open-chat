export type SwipeDirection = "up" | "down" | "left" | "right";

export type SwipeConfig = {
    threshold?: number;
    velocity?: number;
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
    const { threshold = 30, velocity = 0.3, onSwipe } = config;

    let startX: number, startY: number, startTime: number;

    function handleTouchStart(e: TouchEvent) {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        startTime = Date.now();
    }

    function handleTouchEnd(e: TouchEvent) {
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const dt = Date.now() - startTime;

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const speedX = absX / dt;
        const speedY = absY / dt;

        let direction: "up" | "down" | "left" | "right" | null = null;

        if (absX > absY && absX > threshold && speedX > velocity) {
            direction = dx > 0 ? "right" : "left";
        } else if (absY > threshold && speedY > velocity) {
            direction = dy > 0 ? "down" : "up";
        }

        if (direction) {
            onSwipe?.(direction);
            e.stopPropagation();
        }
    }

    if (onSwipe !== undefined) {
        node.addEventListener("touchstart", handleTouchStart, { passive: true });
        node.addEventListener("touchend", handleTouchEnd, { passive: true });
        return {
            destroy() {
                node.removeEventListener("touchstart", handleTouchStart, false);
                node.removeEventListener("touchend", handleTouchEnd, false);
            },
        };
    }
}

// Adds double tap functionality as a svelte action!
//
// Taps must occur in the doubleTapDelay time span.
export function doubleTap(node: HTMLElement, callback: () => void) {
    let lastTap = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let isSingleTouch = false;
    const doubleTapDelay = 300;
    const moveTolerance = 20;

    const handleTouchStart = (e: TouchEvent) => {
        isSingleTouch = e.touches.length === 1;

        if (!isSingleTouch) return;

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (!isSingleTouch || e.changedTouches.length !== 1) {
            isSingleTouch = false;
            return;
        }

        const touch = e.changedTouches[0];
        const movedTooFar =
            Math.abs(touch.clientX - touchStartX) > moveTolerance ||
            Math.abs(touch.clientY - touchStartY) > moveTolerance;

        if (movedTooFar) {
            lastTap = 0;
            isSingleTouch = false;
            return;
        }

        const now = Date.now();
        const tapNearPrevious =
            Math.abs(touch.clientX - lastTapX) <= moveTolerance &&
            Math.abs(touch.clientY - lastTapY) <= moveTolerance;

        if (now - lastTap < doubleTapDelay && tapNearPrevious) {
            callback();
            lastTap = 0;
        } else {
            lastTap = now;
            lastTapX = touch.clientX;
            lastTapY = touch.clientY;
        }

        isSingleTouch = false;
    };

    node.addEventListener("touchstart", handleTouchStart);
    node.addEventListener("touchend", handleTouchEnd);
    return {
        destroy() {
            node.removeEventListener("touchstart", handleTouchStart);
            node.removeEventListener("touchend", handleTouchEnd);
        },
    };
}

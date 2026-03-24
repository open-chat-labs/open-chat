// Adds double tap functionality as a svelte action!
//
// Taps must occur in the doubleTapDelay time span.
export function doubleTap(node: HTMLElement, callback: () => void) {
    let lastTap = 0;
    const doubleTapDelay = 300;

    const handleTouch = (_e: TouchEvent) => {
        const now = Date.now();
        if (now - lastTap < doubleTapDelay) {
            callback();
        }
        lastTap = now;
    };

    node.addEventListener("touchstart", handleTouch);
    return {
        destroy() {
            node.removeEventListener("touchstart", handleTouch);
        },
    };
}

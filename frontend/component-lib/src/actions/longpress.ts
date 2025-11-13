import { isTouchDevice, mobileOperatingSystem } from "component-lib";

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

export function longpress(node: HTMLElement, onlongpress?: (e: TouchEvent) => void) {
    if (onlongpress === undefined) return;

    const handler = onlongpress;

    let longPressTimer: number | undefined;
    let startX = 0;
    let startY = 0;

    function onContextMenu(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
    }

    function onTouchStart(e: TouchEvent) {
        const t = e.changedTouches[0];
        startX = t.screenX;
        startY = t.screenY;
        clearLongPressTimer();
        longPressTimer = window.setTimeout(() => {
            if (mobileOperatingSystem === "iOS") {
                suppressNextClick();
            }
            handler(e);
        }, 500);
    }

    function onTouchMove(e: TouchEvent) {
        const {
            changedTouches: [t],
        } = e;
        const diffX = Math.abs(startX - t.screenX);
        const diffY = Math.abs(startY - t.screenY);
        if (diffX >= 10 || diffY >= 10) {
            clearLongPressTimer();
        }
    }

    function clearLongPressTimer() {
        window.clearTimeout(longPressTimer);
    }

    if (isTouchDevice) {
        node.addEventListener("touchend", clearLongPressTimer);
        node.addEventListener("touchleave", clearLongPressTimer);
        node.addEventListener("touchmove", onTouchMove, { passive: true });
        node.addEventListener("touchstart", onTouchStart, { passive: true });
        node.addEventListener("contextmenu", onContextMenu);
        return {
            destroy() {
                node.removeEventListener("touchend", clearLongPressTimer);
                node.removeEventListener("touchleave", clearLongPressTimer);
                node.removeEventListener("touchmove", onTouchMove);
                node.removeEventListener("touchstart", onTouchStart);
                node.removeEventListener("contextmenu", onContextMenu);
            },
        };
    }
}

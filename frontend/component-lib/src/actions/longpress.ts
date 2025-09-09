import { isTouchDevice, mobileOperatingSystem } from "component-lib";

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
    }

    function onTouchStart(e: TouchEvent) {
        const t = e.changedTouches[0];
        startX = t.screenX;
        startY = t.screenY;
        clearLongPressTimer();
        longPressTimer = window.setTimeout(() => {
            if (mobileOperatingSystem === "iOS") {
                suppressNextClick();
                handler(e);
            }
        }, 500);
    }

    function onTouchMove({ changedTouches: [t] }: TouchEvent) {
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
        node.addEventListener("touchend", clearLongPressTimer, true);
        node.addEventListener("touchleave", clearLongPressTimer, true);
        node.addEventListener("touchmove", onTouchMove, true);
        node.addEventListener("touchstart", onTouchStart, true);
        node.addEventListener("contextmenu", onContextMenu, true);
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

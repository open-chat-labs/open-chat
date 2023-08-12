/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { isTouchDevice } from "../utils/devices";

export function longpress(node: HTMLElement, onlongpress: () => void) {
    let longPressTimer: number | undefined;
    let startX = 0;
    let startY = 0;

    function onContextMenu(e: MouseEvent) {
        e.preventDefault();
    }

    function onTouchStart(e: TouchEvent) {
        const t = e.changedTouches[0];
        startX = t.clientX;
        startY = t.clientY;
        clearLongPressTimer();
        longPressTimer = window.setTimeout(() => {
            onlongpress();
        }, 500);
    }

    function onTouchMove({ changedTouches: [t] }: TouchEvent) {
        const diffX = Math.abs(startX - t.clientX);
        const diffY = Math.abs(startY - t.clientY);
        if (diffX >= 10 || diffY >= 10) {
            clearLongPressTimer();
        }
    }

    function clearLongPressTimer() {
        window.clearTimeout(longPressTimer);
    }

    if (isTouchDevice) {
        node.addEventListener("touchend", clearLongPressTimer);
        node.addEventListener("touchmove", onTouchMove);
        node.addEventListener("touchstart", onTouchStart);
        node.addEventListener("contextmenu", onContextMenu);
        return {
            destroy() {
                node.removeEventListener("touchend", clearLongPressTimer);
                node.removeEventListener("touchmove", onTouchMove);
                node.removeEventListener("touchstart", onTouchStart);
                node.removeEventListener("contextmenu", onContextMenu);
            },
        };
    }
}

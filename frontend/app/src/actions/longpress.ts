/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { isTouchDevice, mobileOperatingSystem } from "../utils/devices";
import { eventListLastScrolled } from "../stores/scrollPos";
import { get } from "svelte/store";

const SCROLL_PROXIMITY = 750;

function suppressNextClick() {
    if (mobileOperatingSystem !== "iOS") return;

    const handler = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };
    window.addEventListener("click", handler, {
        capture: true,
        once: true, // <— this is the key
    });
}

export function longpress(node: HTMLElement, onlongpress: (e: TouchEvent) => void) {
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
            const lastScroll = get(eventListLastScrolled);
            const diff = Date.now() - lastScroll;
            if (mobileOperatingSystem === "iOS" || diff > SCROLL_PROXIMITY) {
                suppressNextClick();
                onlongpress(e);
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

import type { Attachment } from "svelte/attachments";
import type { KeyboardPanelState } from "./panelState.svelte";

/**
 * Makes an element a keyboard-area panel's drag handle (its handle, the Recents header): the
 * finger drags the panel 1:1 (KeyboardPanelState).
 */
export function panelDragHandle(panel: KeyboardPanelState): Attachment<HTMLElement> {
    return (el) => {
        let pointer: number | undefined;

        function down(e: PointerEvent) {
            if (pointer !== undefined || (e.pointerType === "mouse" && e.button !== 0)) return;
            // a button in the handle (Recents' chevron) is pressed, not dragged
            if (e.target instanceof Element && e.target.closest("button") !== null) return;
            pointer = e.pointerId;
            el.setPointerCapture(e.pointerId);
            panel.dragStart(e.clientY, e.timeStamp);
        }

        function move(e: PointerEvent) {
            if (e.pointerId !== pointer) return;
            panel.dragMove(e.clientY, e.timeStamp);
        }

        function up(e: PointerEvent) {
            if (e.pointerId !== pointer) return;
            pointer = undefined;
            panel.dragEnd(e.timeStamp);
        }

        el.addEventListener("pointerdown", down);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
        return () => {
            el.removeEventListener("pointerdown", down);
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", up);
            el.removeEventListener("pointercancel", up);
        };
    };
}

/**
 * Makes a grown panel's scrolling content hand a pull over to the panel (KeyboardPanelState's
 * pull*: once the content is at its top, a finger moving down drags the panel). Touch events, as
 * the content's own scroll is the browser's: a move the panel has taken isn't the scroll's.
 */
export function panelContentPull(panel: KeyboardPanelState): Attachment<HTMLElement> {
    return (el) => {
        let finger: number | undefined;

        function start(e: TouchEvent) {
            if (finger !== undefined || e.touches.length !== 1) return;
            finger = e.touches[0].identifier;
            panel.pullStart(e.touches[0].clientY);
        }

        function move(e: TouchEvent) {
            const touch = [...e.changedTouches].find((t) => t.identifier === finger);
            if (touch === undefined) return;
            if (panel.pullMove(touch.clientY, e.timeStamp, el.scrollTop) && e.cancelable) {
                e.preventDefault();
            }
        }

        function end(e: TouchEvent) {
            if (![...e.changedTouches].some((t) => t.identifier === finger)) return;
            finger = undefined;
            panel.pullEnd(e.timeStamp);
        }

        el.addEventListener("touchstart", start, { passive: true });
        el.addEventListener("touchmove", move, { passive: false });
        el.addEventListener("touchend", end);
        el.addEventListener("touchcancel", end);
        return () => {
            el.removeEventListener("touchstart", start);
            el.removeEventListener("touchmove", move);
            el.removeEventListener("touchend", end);
            el.removeEventListener("touchcancel", end);
        };
    };
}

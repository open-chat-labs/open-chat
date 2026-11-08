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

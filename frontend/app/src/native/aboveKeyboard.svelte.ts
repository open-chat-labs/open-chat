import { keyboard } from "@stores/keyboard.svelte";
import type { Attachment } from "svelte/attachments";
import { keyboardOverlap, scrollToShow, takesTyping } from "./keyboard";

// The soft keyboard's height in the native tree, from the Android app's window insets (systemBars
// follows them); none while it's down, and none on iOS and mobile web, whose WebViews scroll the
// focused field into view themselves.

class SoftKeyboard {
    #height = $state(0);
    #reported = false;

    /** The keyboard's height in CSS pixels, from the window's bottom; 0 while it's down. */
    get height(): number {
        return this.#height;
    }

    /**
     * How tall the keyboard will be once it's up: the last height it had (the shared keyboard
     * store keeps it across sessions, guessing before it's been seen). Only where the keyboard's
     * height is reported (Android): elsewhere none.
     */
    get expected(): number {
        return this.#reported ? keyboard.height : 0;
    }

    follow(open: boolean, heightDp: number): void {
        this.#reported = true;
        const height = open ? heightDp : 0;
        if (height === this.#height) return;
        this.#height = height;
        // remembered for next time (stores/keyboard keeps it), without its own scrolling
        keyboard.currentHeight = height;
    }
}

export const softKeyboard = new SoftKeyboard();

/**
 * For a native screen's scroller with fields in it, under which the keyboard should come up over
 * the screen (a pinned button staying down) rather than the screen shrinking above it: keeps the
 * WebView's viewport resize off while it's attached (unless `holdViewport` is false, for a screen
 * that switches it itself), pads the scroller's end by as much of it as the keyboard covers so its
 * last field can scroll clear, and scrolls the field being typed in above the keyboard as it comes
 * up, and as the field grows.
 */
export function aboveKeyboard(options: { holdViewport?: boolean } = {}): Attachment<HTMLElement> {
    const holdViewport = options.holdViewport ?? true;
    return (scroller) => {
        if (holdViewport) keyboard.disableViewportResize();

        // the room at the end, after the screen's own content
        const room = document.createElement("div");
        room.setAttribute("aria-hidden", "true");
        room.style.flex = "none";
        room.style.height = "0px";
        room.style.pointerEvents = "none";
        scroller.append(room);

        // A field was just focused and the keyboard is on its way: its height comes once it's up
        // (a second or so on an emulator), so until then the field is kept above the height it
        // had last time, and doesn't show under it first and jump
        let expecting = false;

        let frame = 0;
        function update() {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const rect = scroller.getBoundingClientRect();
                const height =
                    softKeyboard.height > 0
                        ? softKeyboard.height
                        : expecting
                          ? softKeyboard.expected
                          : 0;
                const overlap = keyboardOverlap(
                    rect.bottom,
                    window.innerHeight,
                    height,
                    keyboard.viewportResizeEnabled,
                );
                room.style.height = `${overlap}px`;
                const field = document.activeElement;
                if (overlap === 0 || !takesTyping(field) || !scroller.contains(field)) return;
                const by = scrollToShow(field.getBoundingClientRect(), {
                    top: rect.top,
                    bottom: rect.bottom - overlap,
                });
                if (by !== 0) scroller.scrollBy({ top: by });
            });
        }

        // the keyboard coming up or going down (its height changes through its animation), and the
        // viewport resize switched by the screen
        $effect(() => {
            void softKeyboard.height;
            void keyboard.viewportResizeEnabled;
            // it's up (or was put away with the field still focused): no more guessing
            expecting = false;
            update();
        });
        function focusIn(e: FocusEvent) {
            if (softKeyboard.height === 0 && takesTyping(e.target)) {
                expecting = true;
            }
            update();
        }
        function focusOut() {
            expecting = false;
            update();
        }
        // another field, or one growing as it's typed in
        scroller.addEventListener("focusin", focusIn);
        scroller.addEventListener("focusout", focusOut);
        scroller.addEventListener("input", update);

        return () => {
            cancelAnimationFrame(frame);
            scroller.removeEventListener("focusin", focusIn);
            scroller.removeEventListener("focusout", focusOut);
            scroller.removeEventListener("input", update);
            room.remove();
            if (holdViewport) keyboard.enableViewportResize();
        };
    };
}

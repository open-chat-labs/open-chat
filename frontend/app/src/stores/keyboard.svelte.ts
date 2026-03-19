import { enableViewportResize, disableViewportResize } from "tauri-plugin-oc-api";

const STORAGE_KEY = "openchat_soft_keyboard_height";
const SCROLL_INTO_VIEW_DELAY = 400;
const IS_NATIVE_APP =
    import.meta.env.OC_APP_TYPE === "android" || import.meta.env.OC_APP_TYPE === "ios";

let visible = $state(false);
// Is zero while the kb is hidden
let currentHeight: number = $state(0);
let lastFocusedInput: HTMLElement | undefined;
let viewportResizeEnabled = $state(true);

// Guess the soft keyboard height based on the 38% rule. This is only required
// when we've not "seen" the keyboard yet.
let estHeight = Math.min(Math.max(window.innerHeight * 0.38, 260), 380);
let storedHeight = localStorage.getItem(STORAGE_KEY);

let height = $state(storedHeight ? parseInt(storedHeight, 10) : estHeight);

function isInput(el: HTMLElement) {
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

// Find the parent which is scrollable!
function getScrollParent(node: HTMLElement | null): HTMLElement {
    // If we hit the top or a null node, fall back to the document's scroller
    if (!node || node === document.body || node === document.documentElement) {
        return (document.scrollingElement as HTMLElement) || document.body;
    }

    const isScrollable = (el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        // Checking overflow-y is usually safer for vertical scrolling
        const overflowY = style.getPropertyValue("overflow-y");
        return /auto|scroll/.test(overflowY);
    };

    if (isScrollable(node) && node.scrollHeight > node.clientHeight) {
        return node;
    }

    const parent = node.parentElement;
    return getScrollParent(parent);
}

function scrollIntoViewLastFocused() {
    // Do not scroll into view if keyboard is ignored!
    if (!lastFocusedInput || lastFocusedInput?.dataset.keyboardIgnore) return;

    // Scroll the focused input into view if not visible!
    setTimeout(() => {
        const firstParent = lastFocusedInput?.parentElement ?? null;
        const scrollParent = getScrollParent(firstParent);

        if (lastFocusedInput && scrollParent) {
            const inputRect = lastFocusedInput.getBoundingClientRect();

            // If the viewport resizing is enabled, we need to scroll the
            // input into view relative to the bottom of the viewport;
            // but if the viewport resizing is disabled, we need to scroll
            // the input relative to the top of the soft keyboard!
            if (viewportResizeEnabled) {
                const windowBottom = window.innerHeight;

                // Input ended up below viewport bottom after resize
                if (inputRect.bottom > windowBottom) {
                    const distanceToScroll = inputRect.bottom - windowBottom + inputRect.height;

                    scrollParent.scrollTo({
                        top: scrollParent.scrollTop + distanceToScroll,
                        behavior: "smooth",
                    });
                }
                // Input ended up above viewport top after resize
                else if (inputRect.top < 0) {
                    const distanceToScrollUp = inputRect.top - inputRect.height;
                    scrollParent.scrollTo({
                        top: scrollParent.scrollTop + distanceToScrollUp,
                        behavior: "smooth",
                    });
                }
            } else {
                // Space between window top and top of the keyboard
                const keyboardTop = window.innerHeight - height;

                // We take input height into account in cases where keyboard
                // overlaps the input, but not fully.
                if (inputRect.bottom > keyboardTop - inputRect.height) {
                    // This is the distance that the element is below the
                    // keyboard top, plus the buffer...
                    const distanceToMove = inputRect.bottom - keyboardTop + inputRect.height + 8;

                    scrollParent.scrollTo({
                        top: scrollParent.scrollTop + distanceToMove,
                        behavior: "smooth",
                    });
                }
            }
        }
    }, SCROLL_INTO_VIEW_DELAY);
}

if (window && IS_NATIVE_APP) {
    window.addEventListener("focusin", (e) => {
        const target = e.target;
        if (target instanceof HTMLElement && isInput(target)) {
            lastFocusedInput = target;
        }
    });

    window.addEventListener("focusout", () => {
        lastFocusedInput = undefined;
    });
}

export const keyboard = {
    get visible() {
        return visible;
    },

    get currentHeight() {
        return currentHeight;
    },

    get viewportResizeEnabled() {
        return viewportResizeEnabled;
    },

    get height() {
        return height;
    },

    set visible(value: boolean) {
        visible = value;
        // Only runs if there is an input focused.
        scrollIntoViewLastFocused();
    },

    set currentHeight(value: number) {
        currentHeight = value;

        // Update height if current height of the keyboard changes. Might happen
        // if user modified/changed the soft keyboard in any way.
        if (value > 0 && value > height) {
            height = value;
            localStorage.setItem(STORAGE_KEY, height.toString());
        }
    },

    dismiss() {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && isInput(activeElement)) {
            lastFocusedInput = activeElement;
            visible = false;
            activeElement.blur();
        }
    },

    restore() {
        if (lastFocusedInput) {
            lastFocusedInput.focus();
            visible = true;
        }
    },

    enableViewportResize() {
        if (!IS_NATIVE_APP) return;

        viewportResizeEnabled = true;
        enableViewportResize().catch(console.error);
    },

    disableViewportResize() {
        if (!IS_NATIVE_APP) return;

        viewportResizeEnabled = false;
        disableViewportResize().catch(console.error);
    },
};

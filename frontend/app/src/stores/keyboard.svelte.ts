const STORAGE_KEY = "openchat_soft_keyboard_height";

let visible = $state(false);
// Is zero while the kb is hidden
let currentHeight: number = $state(0);
let lastFocusedInput: HTMLElement | undefined = $state();

// Guess the soft keyboard height based on the 38% rule. This is only required
// when we've not "seen" the keyboard yet.
let estHeight = Math.min(Math.max(window.innerHeight * 0.38, 260), 380);
let storedHeight = localStorage.getItem(STORAGE_KEY);

let height = $state(storedHeight ? parseInt(storedHeight, 10) : estHeight);

function isInput(el: HTMLElement) {
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

if (window) {
    window.addEventListener("focusin", (e) => {
        const target = e.target;
        if (target instanceof HTMLElement && isInput(target)) {
            lastFocusedInput = target;
        }
    });
}

export const keyboard = {
    get visible() {
        return visible;
    },

    get currentHeight() {
        return currentHeight;
    },

    get height() {
        return height;
    },

    set visible(value: boolean) {
        visible = value;
    },

    set currentHeight(value: number) {
        currentHeight = value;

        // Update height if current height of the keyboard changes. Might happen
        // if user modified/changed the soft keyboard in any way.
        if (value > 0 && height !== value) {
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
};

let visible = $state(false);
let lastFocusedInput: HTMLElement | undefined = $state();
let height: number | undefined = $state();

// Guess the soft keyboard height based on the 38% rule. This is only required
// when we've not "seen" the keyboard yet.
let maxHeight = Math.min(Math.max(window.innerHeight * 0.38, 260), 380);

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

    get height() {
        return height ?? 0;
    },

    get maxHeight() {
        return maxHeight ?? 0;
    },

    set visible(value: boolean) {
        visible = value;
    },

    set height(value: number) {
        height = value;
        maxHeight = value > 0 ? value : maxHeight;
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

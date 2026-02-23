let visible = $state(false);
let lastFocusedInput: HTMLElement | undefined = $state();
let maxHeight: number | undefined = $state();
let height: number | undefined = $state();

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

    set visible(value: boolean) {
        visible = value;
    },

    set height(value: number) {
        height = value;
        maxHeight = value > (maxHeight ?? 0) ? value : maxHeight;
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

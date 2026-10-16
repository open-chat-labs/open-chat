import type { ShellLayout } from "./layout";

const STORAGE_KEY = "openchat_web_right_column_open";

function stored(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) !== "false";
    } catch {
        return true;
    }
}

// Whether the right column (details, members, thread …) shows. Docked, it's a preference that
// lasts across visits (brief §4), open unless the user closed it. As a modal, below the docking
// width, it only opens when asked to and isn't remembered, so a page never loads behind a modal.
export class RightColumnState {
    #docked = $state(stored());
    #modal = $state(false);

    isOpen(mode: ShellLayout["right"]): boolean {
        return mode === "dock" ? this.#docked : this.#modal;
    }

    setOpen(mode: ShellLayout["right"], open: boolean): void {
        if (mode === "modal") {
            this.#modal = open;
            return;
        }
        this.#docked = open;
        try {
            localStorage.setItem(STORAGE_KEY, String(open));
        } catch {
            // the preference just isn't remembered
        }
    }

    toggle(mode: ShellLayout["right"]): void {
        this.setOpen(mode, !this.isOpen(mode));
    }
}

import type { Attachment } from "svelte/attachments";

// What the achievement toast places itself by (features/chit/achievementPlacement): the middle
// panel (Shell), the composer in it (a chat's own, MessageArea) and the app's toast layer while a
// toast shows (shell/Toasts). Each element says it's there with an attachment, and is forgotten
// when it goes, unless another has taken its place (a chat opened as the last one goes).

export type BottomAnchor = "middle" | "composer" | "toasts";

let middle = $state.raw<HTMLElement | undefined>();
let composer = $state.raw<HTMLElement | undefined>();
let toasts = $state.raw<HTMLElement | undefined>();

function set(name: BottomAnchor, el: HTMLElement | undefined): void {
    if (name === "middle") middle = el;
    else if (name === "composer") composer = el;
    else toasts = el;
}

/** The element for `name`, if one is there; reactive. */
export function bottomAnchor(name: BottomAnchor): HTMLElement | undefined {
    return name === "middle" ? middle : name === "composer" ? composer : toasts;
}

/** Marks an element as the anchor `name` while it's there (`{@attach bottomAnchorFor(name)}`). */
export function bottomAnchorFor(name: BottomAnchor): Attachment<HTMLElement> {
    return (el) => {
        set(name, el);
        return () => {
            if (bottomAnchor(name) === el) set(name, undefined);
        };
    };
}

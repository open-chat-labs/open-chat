import { navigate, type NavigationIntent } from "@src/utils/navigation";
import { openLinkedDialog, type LinkedDialog } from "./dialogs";

/** A linked dialog opened in another's place: the URL it was opened at, and the one it was opened from. */
export type HandOff = { to: string; from: string };

// the last linked dialog opened in another's place, so going back to that one can go back in
// history to it (a navigation's own history entries keep only the path, not the query)
let lastHandOff: HandOff | undefined;

/**
 * Opens a linked dialog in place of the one showing, if any (from the profile, Diamond; from the
 * CHIT dialog, the profile on its CHIT section). From the URL as it is: the query store's values
 * are decoded, so they can't be written back.
 */
export function openLinked(dialog: LinkedDialog): void {
    const from = currentUrl();
    const query = openLinkedDialog(new URLSearchParams(window.location.search), dialog);
    if (query === undefined) return;
    const to = `${window.location.pathname}${query}`;
    lastHandOff = { to, from };
    navigate(to, "overlay");
}

/**
 * Goes back to a linked dialog from one opened in its place (the ways to earn, back to the CHIT
 * dialog), in place over the same backdrop: back in history when this one was opened from it,
 * else to it, in this one's history entry (opened from a toast or a link, there's nothing of it
 * behind, so Back from it then leaves it for the page).
 */
export function backToLinked(dialog: LinkedDialog): void {
    const query = openLinkedDialog(new URLSearchParams(window.location.search), dialog);
    if (query === undefined) return;
    const to = `${window.location.pathname}${query}`;
    navigate(to, backIntent(lastHandOff, currentUrl(), to));
}

/**
 * How to go back to the linked dialog at `to` from the one at `current`: back in history ("dismiss")
 * only when `current` was opened from it (the last hand-off), else in place ("auto", a replace).
 */
export function backIntent(
    handOff: HandOff | undefined,
    current: string,
    to: string,
): NavigationIntent {
    return handOff !== undefined && handOff.to === current && handOff.from === to
        ? "dismiss"
        : "auto";
}

function currentUrl(): string {
    return `${window.location.pathname}${window.location.search}`;
}

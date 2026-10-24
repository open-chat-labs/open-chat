import { navigate, type NavigationIntent } from "@src/utils/navigation";
import { openLinkedDialog, type LinkedDialog } from "./dialogs";

/**
 * A linked dialog opened in another's place: the URL it was opened at, the one it was opened from,
 * and whether the URL has got there yet (it hasn't as the hand-off is made).
 */
export type HandOff = { to: string; from: string; reached?: boolean };

// the last linked dialog opened in another's place, so going back to that one can go back in
// history to it (a navigation's own history entries keep only the path, not the query). Forgotten
// once the URL leaves it (urlChanged), so the same URL reached later some other way isn't taken
// for it
let lastHandOff: HandOff | undefined;

/** The URL has changed (DialogHost follows it): a hand-off left is forgotten. */
export function urlChanged(url: string): void {
    lastHandOff = handOffAt(lastHandOff, url);
}

/**
 * What's left of a hand-off at `url`: kept while its URL shows, and on its way there (the URL can
 * be told of again as it was before the navigation lands), forgotten once that URL has been left.
 */
export function handOffAt(handOff: HandOff | undefined, url: string): HandOff | undefined {
    if (handOff === undefined) return undefined;
    if (sameUrl(handOff.to, url)) return { ...handOff, reached: true };
    return handOff.reached ? undefined : handOff;
}

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
 * Whether the linked dialog showing was opened in `dialog`'s place, so closing it can hand back to
 * `dialog` (a dialog with no exit of its own, as the puzzle's frame, keeps the backdrop that way).
 */
export function openedFrom(dialog: LinkedDialog): boolean {
    const query = openLinkedDialog(new URLSearchParams(window.location.search), dialog);
    if (query === undefined) return false;
    return (
        backIntent(lastHandOff, currentUrl(), `${window.location.pathname}${query}`) === "dismiss"
    );
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
    return handOff !== undefined && sameUrl(handOff.to, current) && sameUrl(handOff.from, to)
        ? "dismiss"
        : "auto";
}

/**
 * Whether two URLs (a path and a query) are the same once parsed: `?threads&chit` is
 * `?threads=&chit`, as the query is written back with its flags given `=`.
 */
export function sameUrl(a: string, b: string): boolean {
    const [pathA, queryA = ""] = a.split("?", 2);
    const [pathB, queryB = ""] = b.split("?", 2);
    const sorted = (query: string) => {
        const params = new URLSearchParams(query);
        params.sort();
        return params.toString();
    };
    return pathA === pathB && sorted(queryA) === sorted(queryB);
}

function currentUrl(): string {
    return `${window.location.pathname}${window.location.search}`;
}

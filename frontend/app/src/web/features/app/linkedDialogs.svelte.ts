import { navigate } from "@src/utils/navigation";
import { linkedDialog, openLinkedDialog, shownLinkedDialog, type LinkedDialog } from "./dialogs";

// Linked dialogs opened one from another (the CHIT dialog's leaderboard, the profile on its CHIT
// section from the CHIT dialog …) make a chain. Each takes the last one's place over the same
// backdrop, in the same history entry (the first one's), and only its back arrow returns to the
// one before, a step at a time. ×, the backdrop, Escape or the browser's Back close them all, the
// whole chain being one history entry, and never go a step back.

/**
 * The chain behind the dialog showing: the URLs of the dialogs it was opened from, the first one
 * first, its own URL (`at`), and whether the URL has got there yet (it hasn't as it's opened).
 */
export type Chain = { behind: string[]; at: string; reached: boolean };

// `chitOff`: whether the CHIT dialogs are hidden (DialogHost follows the setting), as a dialog behind
// may be one of them
const state = $state<{ chain: Chain | undefined; chitOff: boolean }>({
    chain: undefined,
    chitOff: false,
});

/** CHIT has been turned on or off (DialogHost follows the setting). */
export function chitTurnedOff(off: boolean): void {
    state.chitOff = off;
}

/**
 * The chain once the dialog at `from` opens the one at `to` in its place: one more behind, or,
 * opening one already behind (the CHIT dialog from the profile it opened), back to it.
 */
export function chainOpened(chain: Chain | undefined, from: string, to: string): Chain | undefined {
    const behind = chain !== undefined && sameUrl(chain.at, from) ? chain.behind : [];
    const back = behind.findIndex((url) => sameUrl(url, to));
    if (back === 0) return undefined;
    return { behind: back > 0 ? behind.slice(0, back) : [...behind, from], at: to, reached: false };
}

/** A step back along the chain: the URL to go back to and the chain there, if there's one behind. */
export function chainBack(
    chain: Chain | undefined,
): { to: string; chain: Chain | undefined } | undefined {
    if (chain === undefined || chain.behind.length === 0) return undefined;
    const to = chain.behind[chain.behind.length - 1];
    const behind = chain.behind.slice(0, -1);
    return { to, chain: behind.length === 0 ? undefined : { behind, at: to, reached: false } };
}

/**
 * Whether the dialog at `url` would show if gone back to: not a CHIT dialog once CHIT is turned off
 * (in the profile opened from the CHIT dialog's settings), which would leave no dialog over the
 * backdrop handed to it.
 */
export function shows(url: string, chitOff: boolean): boolean {
    const query = new URLSearchParams(url.split("?", 2)[1] ?? "");
    return shownLinkedDialog(linkedDialog(query), chitOff) !== undefined;
}

/**
 * What's left of the chain at `url`: kept while its dialog shows, and on its way there (the URL can
 * be told of again as it was before the navigation lands), gone once that URL has been left (the
 * dialogs closed, the browser's Back, a link).
 */
export function chainAt(chain: Chain | undefined, url: string): Chain | undefined {
    if (chain === undefined) return undefined;
    if (sameUrl(chain.at, url)) return chain.reached ? chain : { ...chain, reached: true };
    return chain.reached ? undefined : chain;
}

/** The URL has changed (DialogHost follows it). */
export function urlChanged(url: string): void {
    const next = chainAt(state.chain, url);
    if (next !== state.chain) state.chain = next;
}

/**
 * Opens a linked dialog from outside the dialogs (the rail, a toast, a link in a message): over the
 * page in a history entry of its own, which Back closes, or in place of a dialog showing, in its
 * entry. Nothing to go back to from it. From the URL as it is: the query store's values are
 * decoded, so they can't be written back.
 */
export function openLinked(dialog: LinkedDialog): void {
    const query = openLinkedDialog(new URLSearchParams(window.location.search), dialog);
    if (query === undefined) return;
    const showing = linkedDialog(new URLSearchParams(window.location.search)) !== undefined;
    state.chain = undefined;
    navigate(`${window.location.pathname}${query}`, showing ? "auto" : "overlay");
}

/**
 * Opens a linked dialog from the one showing, in its place over the same backdrop and in the same
 * history entry: its back arrow returns to this one (goBack).
 */
export function openFromDialog(dialog: LinkedDialog): void {
    const query = openLinkedDialog(new URLSearchParams(window.location.search), dialog);
    if (query === undefined) return;
    const to = `${window.location.pathname}${query}`;
    state.chain = chainOpened(state.chain, currentUrl(), to);
    navigate(to, "auto");
}

/**
 * Whether the dialog showing was opened from another, which its back arrow returns to: not when
 * that one wouldn't show now (shows), so × closes them all.
 */
export function canGoBack(): boolean {
    const chain = state.chain;
    return (
        chain !== undefined &&
        chain.behind.length > 0 &&
        sameUrl(chain.at, currentUrl()) &&
        shows(chain.behind[chain.behind.length - 1], state.chitOff)
    );
}

/** Back to the dialog the one showing was opened from, in its place over the same backdrop. */
export function goBack(): void {
    const back = chainBack(state.chain);
    if (back === undefined || !canGoBack()) return;
    state.chain = back.chain;
    navigate(back.to, "auto");
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

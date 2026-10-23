import type { ProfileCard } from "@src/logic/profile/profileCard";
import type { Component } from "svelte";

// The app's dialogs, and the screen each one shows: plugged in here as screens are in screens.ts,
// one line each, `undefined` (a placeholder) until it's built. DialogHost shows them.
//
// Two kinds:
// - linked: a query param over whatever page is open, which people link to and Back closes
//   (ROUTES.md, decision 6): ?profile, ?chit, ?hof, ?diamond;
// - local: opened by the app itself (a name clicked in a message …), kept in a DialogStack, and
//   closed before any navigation (closeModalStack) and on Back.
//
// The app event dialogs (not found, no access …) aren't in the table: DialogHost shows them on
// their own, and only closing one leaves the page.

export type LinkedDialog =
    | { kind: "profile" }
    | { kind: "diamond" }
    | { kind: "chit" }
    | { kind: "leaderboard" };

// someone's profile card, for a name clicked in a message
export type LocalDialog = { kind: "user" } & ProfileCard;

export type AppDialog = LinkedDialog | LocalDialog;

/** A dialog's screen gets the dialog it shows, and closes it with onClose. */
export type DialogProps<D extends AppDialog> = { dialog: D; onClose: () => void };

type Loader<D extends AppDialog> = () => Promise<{ default: Component<DialogProps<D>> }>;

export type Dialogs = {
    [K in AppDialog["kind"]]: Loader<Extract<AppDialog, { kind: K }>> | undefined;
};

export const dialogs: Dialogs = {
    // the user's own profile and settings (8c)
    profile: undefined,

    // Diamond membership (8e)
    diamond: undefined,

    // CHIT rewards (8d)
    chit: undefined,

    // the CHIT leaderboard (8d)
    leaderboard: undefined,

    // someone else's profile card: its Chat button so far, the rest in 4a. A dialog, not anchored
    // to the name clicked as the old desktop card was
    user: () => import("../user/UserDialogScreen.svelte"),
};

// each linked dialog's query param, in the order they win when more than one is in the URL
const PARAMS: Record<LinkedDialog["kind"], string> = {
    profile: "profile",
    diamond: "diamond",
    chit: "chit",
    leaderboard: "hof",
};

// PARAMS' keys, in its order
const LINKED_KINDS = Object.keys(PARAMS) as LinkedDialog["kind"][];

/** The linked dialog the URL's query opens, if any: one at a time. */
export function linkedDialog(query: URLSearchParams): LinkedDialog | undefined {
    const kind = LINKED_KINDS.find((k) => query.has(PARAMS[k]));
    return kind && { kind };
}

/** The query param that opens a linked dialog, which closing it drops. */
export function linkedDialogParam(dialog: LinkedDialog): string {
    return PARAMS[dialog.kind];
}

/**
 * The query that opens a linked dialog in place of the one showing (from the profile, Diamond:
 * Back returns to the profile), or undefined when it's already the one showing.
 */
export function openLinkedDialog(query: URLSearchParams, dialog: LinkedDialog): string | undefined {
    if (linkedDialog(query)?.kind === dialog.kind) return undefined;
    const rest = new URLSearchParams(query);
    LINKED_KINDS.forEach((k) => rest.delete(PARAMS[k]));
    // a flag, as withQueryStringFlag writes it: no "="
    const others = rest.toString();
    return `?${others === "" ? "" : `${others}&`}${encodeURIComponent(PARAMS[dialog.kind])}`;
}

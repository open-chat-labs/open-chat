import type { Component } from "svelte";

// The app's dialogs, and the screen each one shows: plugged in here as screens are in screens.ts,
// one line each, `undefined` (a placeholder) until it's built. DialogHost shows them.
//
// Two kinds:
// - linked: a query param over whatever page is open, which people link to and Back closes
//   (ROUTES.md, decision 6): ?profile, ?chit, ?hof, ?diamond;
// - local: opened by the app itself (a name clicked in a message …), kept in a DialogStack, and
//   closed before any navigation (closeModalStack).

export type LinkedDialog =
    | { kind: "profile" }
    | { kind: "diamond" }
    | { kind: "chit" }
    | { kind: "leaderboard" };

export type LocalDialog = {
    kind: "user";
    userId: string;
    // what the profile link that opened it allows (`<profile-link>`)
    chatButton: boolean;
    inGlobalContext: boolean;
};

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

    // someone else's profile card (4a)
    user: undefined,
};

// each linked dialog's query param, in the order they win when more than one is in the URL
const LINKED: [LinkedDialog["kind"], string][] = [
    ["profile", "profile"],
    ["diamond", "diamond"],
    ["chit", "chit"],
    ["leaderboard", "hof"],
];

/** The linked dialog the URL's query opens, if any: one at a time. */
export function linkedDialog(query: URLSearchParams): LinkedDialog | undefined {
    const found = LINKED.find(([, param]) => query.has(param));
    return found && { kind: found[0] };
}

/** The query param that opens a linked dialog, which closing it drops. */
export function linkedDialogParam(dialog: LinkedDialog): string {
    const found = LINKED.find(([kind]) => kind === dialog.kind);
    return found === undefined ? dialog.kind : found[1];
}

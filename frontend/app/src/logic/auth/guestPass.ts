import type { OpenChat, RouteParams } from "@client";

// A guest (signed out, in the app) reads Explore and public groups, communities and channels, each
// a read-only preview. What needs an account asks them to sign in, and then carries on: a page
// they were going to opens once they're signed in, and anything else leaves them where they were
// (ROUTES.md, the Guest column).

/**
 * What a guest sees in place of a page that needs an account while they're asked to sign in:
 * Explore, the one destination the guest rail has.
 */
export const GUEST_HOME = "/communities";

/** Whether a guest can open a page (`open`), or is asked to sign in first (`sign_in`). */
export type GuestAccess = "open" | "sign_in";

/**
 * What a guest can do with a route. Explore, the chat lists and previews of groups, communities and
 * channels are open; a DM, the favourites, notifications, the wallet, the profile, sharing into a
 * chat and the operators' console need an account. A chat on a /favourite URL is open: it's sent
 * on to its non-favourite URL (it can't be a guest's favourite), as the client does for anyone.
 */
export function guestRouteAccess(route: RouteParams): GuestAccess {
    switch (route.kind) {
        case "notifications_route":
        case "profile_summary_route":
        case "wallet_route":
        case "share_route":
        case "admin_route":
            return "sign_in";
        case "chat_list_route":
            return route.scope.kind === "favourite" ? "sign_in" : "open";
        case "favourites_route":
            return route.chatId === undefined ? "sign_in" : "open";
        case "global_chat_selected_route":
            return route.chatType === "direct_chat" ? "sign_in" : "open";
        default:
            return "open";
    }
}

/**
 * Asks a guest to sign in: the app's sign-in dialog opens (the identity goes to "logging_in"), and
 * once they've signed in the app goes on to `continueTo` (a path with its query), or stays where
 * it is without one.
 */
export function askToSignIn(
    client: Pick<OpenChat, "updateIdentityState">,
    continueTo?: string,
): void {
    client.updateIdentityState({
        kind: "logging_in",
        postLogin: continueTo === undefined ? undefined : { kind: "continue_to", path: continueTo },
    });
}

/**
 * For something only someone with an account can do (follow a thread, mute or favourite a chat …):
 * a guest is asked to sign in instead, staying where they are. Whether they were, so the caller
 * goes no further.
 */
export function signInFirst(
    client: Pick<OpenChat, "updateIdentityState">,
    guest: boolean,
): boolean {
    if (!guest) return false;
    askToSignIn(client);
    return true;
}

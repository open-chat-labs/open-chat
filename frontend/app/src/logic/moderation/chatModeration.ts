import {
    i18nKey,
    ownUserAvatarUrl,
    unsuspendUserMessage,
    type ChatSummary,
    type OpenChat,
    type ResourceKey,
    type ToastOutcome,
    type UserLookup,
} from "@client";
import { freezeLabel } from "./freeze";
import type { PendingToastAction } from "./pendingToast";

// What a chat's menu offers a platform moderator: a group can be frozen or unfrozen, as the old
// CurrentChatMenus offer it, and the person in a DM is suspended or unsuspended (not a bot). A
// channel offers nothing: its community is frozen from the community's own header menu (the
// user's decision, 2026-11-12), not from each of its channels as the old preview footer did.

export type ModeratorChatAction = "freeze" | "unfreeze" | "suspend" | "unsuspend";

export function moderatorChatActions(
    chat: ChatSummary,
    {
        platformModerator,
        themSuspended,
        isBot,
    }: {
        platformModerator: boolean;
        themSuspended: boolean;
        isBot: boolean;
    },
): ModeratorChatAction[] {
    if (!platformModerator) return [];
    switch (chat.kind) {
        case "group_chat":
            return [chat.frozen ? "unfreeze" : "freeze"];
        case "channel":
            return [];
        case "direct_chat":
            return isBot ? [] : [themSuspended ? "unsuspend" : "suspend"];
    }
}

/** A moderator item's words, the old menus' ("Freeze group", "Suspend user" …). */
export function moderatorChatActionLabel(action: ModeratorChatAction): ResourceKey {
    switch (action) {
        case "freeze":
        case "unfreeze":
            return freezeLabel("group", action === "unfreeze");
        case "suspend":
            return i18nKey("suspendUser");
        case "unsuspend":
            return i18nKey("unsuspendUser");
    }
}

/**
 * Who the suspend dialog names (TODO(design): no suspend dialog in the design): their display name
 * with @username under it, or their username alone when they have no display name (not twice),
 * and their own picture over their swatch. A user who isn't loaded is named by their id alone.
 */
export type Suspendee = { name: string; handle?: string; avatarUrl?: string };

export function suspendee(userId: string, users: UserLookup): Suspendee {
    const user = users.get(userId);
    if (user === undefined) return { name: userId };
    const avatarUrl = ownUserAvatarUrl(user);
    return user.displayName
        ? { name: user.displayName, handle: `@${user.username}`, avatarUrl }
        : { name: user.username, avatarUrl };
}

/**
 * How suspending a user went, naming them by their username (their user id while they're not
 * loaded): a success for a toast whose Undo is `unsuspend`; a failure for the dialog to show
 * inline, where it stays for another try.
 */
export type SuspendOutcome =
    | { kind: "suspended"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

/**
 * Suspends a user with the moderator's reason (the `suspendUser` app event's dialog). The dialog
 * stays (PendingAction) until the backend answers; the view's toast then offers Undo, which lifts
 * it (`unsuspend`).
 */
export async function suspendUser(
    client: Pick<OpenChat, "suspendUser">,
    userId: string,
    reason: string,
    users: UserLookup,
): Promise<SuspendOutcome> {
    const username = users.get(userId)?.username ?? userId;
    const success = await client.suspendUser(userId, reason);
    return success
        ? { kind: "suspended", message: i18nKey("userSuspended", { username }) }
        : { kind: "failed", message: i18nKey("suspendUserFailed", { username }) };
}

/**
 * Lifts a user's suspension at once, as the new UI's menus, the user's card and a suspension
 * toast's Undo do: said in a pending toast, naming them by their username (their user id while
 * they're not loaded), "Un-suspending {username}…", then "{username} un-suspended" or "Couldn't
 * un-suspend {username}". No Undo after it.
 */
export function unsuspend(
    client: Pick<OpenChat, "unsuspendUser">,
    userId: string,
    users: UserLookup,
): PendingToastAction {
    const username = users.get(userId)?.username ?? userId;
    return {
        pending: i18nKey("moderationToast.unsuspending", { username }),
        run: async () =>
            (await client.unsuspendUser(userId))
                ? { kind: "success", message: i18nKey("moderationToast.unsuspended", { username }) }
                : {
                      kind: "failed",
                      message: i18nKey("moderationToast.unsuspendFailed", { username }),
                  },
    };
}

/**
 * Lifts a user's suspension, the old trees' way: a toast with the old words once it's done
 * (suspending asks for a reason first: the `suspendUser` app event).
 */
export async function unsuspendUser(
    client: Pick<OpenChat, "unsuspendUser">,
    userId: string,
): Promise<ToastOutcome> {
    const success = await client.unsuspendUser(userId);
    const message = unsuspendUserMessage(success);
    return success ? { kind: "success", message } : { kind: "failed", message };
}

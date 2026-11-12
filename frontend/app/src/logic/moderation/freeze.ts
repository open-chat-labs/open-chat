import {
    i18nKey,
    type CommunityIdentifier,
    type GroupChatIdentifier,
    type MultiUserChatIdentifier,
    type OpenChat,
    type ResourceKey,
    type ToastOutcome,
} from "@client";
import type { PendingToastAction } from "./pendingToast";

// A platform moderator freezes or unfreezes a group or a community (a channel can't be frozen on
// its own: its community is). Every tree's menus and the old desktop preview footer go through
// here. In the new UI a community is frozen from its own header's menu only, not a channel's.

export type FreezeTarget =
    | { kind: "group"; id: GroupChatIdentifier }
    | { kind: "community"; id: CommunityIdentifier };

/** What freezing or unfreezing a chat acts on: the group itself, or the community a channel is in. */
export function freezeTarget(chatId: MultiUserChatIdentifier): FreezeTarget {
    switch (chatId.kind) {
        case "group_chat":
            return { kind: "group", id: chatId };
        case "channel":
            return {
                kind: "community",
                id: { kind: "community", communityId: chatId.communityId },
            };
    }
}

export type FreezeClient = Pick<
    OpenChat,
    "freezeGroup" | "unfreezeGroup" | "freezeCommunity" | "unfreezeCommunity"
>;

/**
 * Freezes (`frozen`) or unfreezes the target at once, and says which it did, or which failed: the
 * old trees' menus and preview footer, which give no reason and don't ask. Whether a success is
 * shown is the view's call: the old chat menus show only a failure. The new UI confirms first
 * (`freezeItem`, `freeze`) and unfreezes in a pending toast (`unfreeze`).
 */
export async function setFrozen(
    client: FreezeClient,
    target: FreezeTarget,
    frozen: boolean,
): Promise<ToastOutcome> {
    if (target.kind === "group") {
        const success = frozen
            ? await client.freezeGroup(target.id, undefined)
            : await client.unfreezeGroup(target.id);
        return success
            ? { kind: "success", message: i18nKey(frozen ? "chatFrozen" : "chatUnfrozen") }
            : {
                  kind: "failed",
                  message: i18nKey(frozen ? "failedToFreezeGroup" : "failedToUnfreezeGroup"),
              };
    }
    const success = frozen
        ? await client.freezeCommunity(target.id, undefined)
        : await client.unfreezeCommunity(target.id);
    return success
        ? { kind: "success", message: i18nKey(frozen ? "communityFrozen" : "communityUnfrozen") }
        : {
              kind: "failed",
              message: i18nKey(frozen ? "failedToFreezeCommunity" : "failedToUnfreezeCommunity"),
          };
}

/** The freeze item's words for what it acts on as it is now: "Freeze group", "Unfreeze community" … */
export function freezeLabel(kind: FreezeTarget["kind"], isFrozen: boolean): ResourceKey {
    const noun = kind === "group" ? "Group" : "Community";
    return i18nKey(isFrozen ? `unfreeze${noun}` : `freeze${noun}`);
}

/**
 * Freezes the target with the moderator's `reason` (from freezeReason), if any: the new UI's
 * confirm (`confirm_freeze`). `name` is the group's or the community's, for the words: a success
 * for a toast whose Undo unfreezes (`unfreeze`); a failure for the dialog to show inline, where it
 * stays for another try. The old trees' menus freeze with setFrozen.
 */
export type FreezeOutcome =
    | { kind: "frozen"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

export async function freeze(
    client: Pick<OpenChat, "freezeGroup" | "freezeCommunity">,
    target: FreezeTarget,
    name: string,
    reason: string | undefined,
): Promise<FreezeOutcome> {
    const success =
        target.kind === "group"
            ? await client.freezeGroup(target.id, reason)
            : await client.freezeCommunity(target.id, reason);
    return success
        ? { kind: "frozen", message: i18nKey("moderationToast.frozen", { name }) }
        : { kind: "failed", message: i18nKey("moderationToast.freezeFailed", { name }) };
}

/**
 * Unfreezes the target (`name`: the group's or the community's), as the new UI's menus' Unfreeze
 * and a freeze toast's Undo do: said in a pending toast, "Unfreezing {name}…", then "{name}
 * unfrozen" or "Couldn't unfreeze {name}". No Undo after it.
 */
export function unfreeze(
    client: Pick<OpenChat, "unfreezeGroup" | "unfreezeCommunity">,
    target: FreezeTarget,
    name: string,
): PendingToastAction {
    return {
        pending: i18nKey("moderationToast.unfreezing", { name }),
        run: async () => {
            const success =
                target.kind === "group"
                    ? await client.unfreezeGroup(target.id)
                    : await client.unfreezeCommunity(target.id);
            return success
                ? { kind: "success", message: i18nKey("moderationToast.unfrozen", { name }) }
                : { kind: "failed", message: i18nKey("moderationToast.unfreezeFailed", { name }) };
        },
    };
}

/**
 * What the new UI's Freeze or Unfreeze item does: freezing asks first (`confirm`: the view opens
 * the confirm, which freezes); unfreezing goes ahead at once (`unfreeze`: the view shows it in a
 * pending toast). Nothing is called yet.
 */
export type FreezeItem =
    | { kind: "confirm"; target: FreezeTarget }
    | { kind: "unfreeze"; action: PendingToastAction };

export function freezeItem(
    client: Pick<OpenChat, "unfreezeGroup" | "unfreezeCommunity">,
    target: FreezeTarget,
    name: string,
    freeze: boolean,
): FreezeItem {
    return freeze
        ? { kind: "confirm", target }
        : { kind: "unfreeze", action: unfreeze(client, target, name) };
}

/**
 * The words asking a moderator to confirm freezing the target, `name` being the community's.
 * Freezing makes it read-only (the backend refuses messages and changes while it's frozen).
 * `reasonHint` says who sees the optional reason: a group's goes into its "Chat frozen by …"
 * timeline event, which members see; a community's is kept with its own events, which the app
 * doesn't show. TODO(design): the design has no freeze confirm.
 */
export function freezeConfirmText(
    target: FreezeTarget,
    name: string,
): { title: ResourceKey; body: ResourceKey; reasonHint: ResourceKey } {
    return target.kind === "group"
        ? {
              title: i18nKey("freezeConfirm.groupTitle"),
              body: i18nKey("freezeConfirm.groupBody"),
              reasonHint: i18nKey("freezeConfirm.groupReasonHint"),
          }
        : {
              title: i18nKey("freezeConfirm.communityTitle"),
              body: i18nKey("freezeConfirm.communityBody", { name }),
              reasonHint: i18nKey("freezeConfirm.communityReasonHint"),
          };
}

/**
 * The longest freeze reason the field takes. The backend sets no limit (group_index's
 * freeze_group / freeze_community take any `reason`), so this is ours, a suspension reason's
 * (SuspendUserDialog). TODO(design)
 */
export const FREEZE_REASON_MAX_LENGTH = 512;

/** The freeze reason to send, from what the moderator typed. */
export type FreezeReason = { kind: "ok"; reason: string | undefined } | { kind: "too_long" };

/** Trims the typed reason (blank: none) and holds it to FREEZE_REASON_MAX_LENGTH. */
export function freezeReason(input: string): FreezeReason {
    const reason = input.trim();
    if (reason.length > FREEZE_REASON_MAX_LENGTH) return { kind: "too_long" };
    return { kind: "ok", reason: reason === "" ? undefined : reason };
}

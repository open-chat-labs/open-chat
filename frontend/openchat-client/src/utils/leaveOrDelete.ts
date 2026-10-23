import {
    chatIdentifiersEqual,
    i18nKey,
    ROLE_NONE,
    routeForChatIdentifier,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
    type CommunitySummary,
    type CommunityIdentifier,
    type DirectChatIdentifier,
    type Level,
    type MultiUserChatIdentifier,
    type ResourceKey,
} from "@shared";
import { routeForScope } from "./routes";

/** Leaving or deleting a group, channel, DM or community, once the user has confirmed it. */
export type LeaveOrDelete =
    | { kind: "leave"; chatId: MultiUserChatIdentifier }
    | { kind: "delete"; chatId: MultiUserChatIdentifier }
    | { kind: "delete_direct_chat"; chatId: DirectChatIdentifier; blockUser: boolean }
    | { kind: "leave_community"; id: CommunityIdentifier }
    | { kind: "delete_community"; id: CommunityIdentifier };

/** What the backend said: leaving fails differently for the last owner. */
export type LeaveOrDeleteResult = "success" | "failure" | "owner_cannot_leave";

export type LeaveOrDeleteOutcome =
    | { kind: "success"; message?: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

/**
 * Where to go while leaving or deleting: off it to its list (a community: to the default scope)
 * before the call, and back if the call fails. Undefined when the user isn't viewing it, so the
 * route never changes for a chat deleted from a list.
 */
export function leaveOrDeleteNavigation(
    action: LeaveOrDelete,
    selectedChatId: ChatIdentifier | undefined,
    scope: ChatListScope,
    defaultScope: ChatListScope,
): { away: string; back: string } | undefined {
    switch (action.kind) {
        case "leave":
        case "delete":
        case "delete_direct_chat":
            return chatIdentifiersEqual(selectedChatId, action.chatId)
                ? {
                      away: routeForScope(scope),
                      back: routeForChatIdentifier(scope.kind, action.chatId),
                  }
                : undefined;
        case "leave_community":
        case "delete_community":
            return scope.kind === "community" && scope.id.communityId === action.id.communityId
                ? { away: routeForScope(defaultScope), back: routeForScope(scope) }
                : undefined;
        default:
            return action satisfies never;
    }
}

function level(chatId: MultiUserChatIdentifier): Level {
    return chatId.kind === "channel" ? "channel" : "group";
}

/** The message for a leave or delete's result; the last owner's leave says they can't. */
export function leaveOrDeleteOutcome(
    action: LeaveOrDelete,
    result: LeaveOrDeleteResult,
): LeaveOrDeleteOutcome {
    if (result === "success") {
        return action.kind === "delete"
            ? {
                  kind: "success",
                  message: i18nKey("deleteGroupSuccess", undefined, level(action.chatId)),
              }
            : { kind: "success" };
    }
    return { kind: "failed", message: leaveOrDeleteFailureMessage(action, result) };
}

function leaveOrDeleteFailureMessage(
    action: LeaveOrDelete,
    result: Exclude<LeaveOrDeleteResult, "success">,
): ResourceKey {
    switch (action.kind) {
        case "leave":
            return i18nKey(
                result === "owner_cannot_leave" ? "ownerCantLeave" : "failedToLeaveGroup",
                undefined,
                level(action.chatId),
                true,
            );
        case "delete":
            return i18nKey("deleteGroupFailure", undefined, level(action.chatId), true);
        case "delete_direct_chat":
            return i18nKey("deleteDirectChatFailure");
        case "leave_community":
            return i18nKey("communities.errors.leaveFailed");
        case "delete_community":
            return i18nKey("communities.errors.deleteFailed");
        default:
            return action satisfies never;
    }
}

/**
 * A chat that can be taken off the list without leaving anything: a DM with no messages, or a
 * group or channel previewed but not joined (a channel only inside a community the user is in).
 */
export function canRemoveFromList(
    chat: ChatSummary,
    community: CommunitySummary | undefined,
): boolean {
    switch (chat.kind) {
        case "direct_chat":
            return chat.latestMessage === undefined;
        case "group_chat":
            return chat.membership.role === ROLE_NONE;
        case "channel":
            return (
                community !== undefined &&
                community.membership.role !== ROLE_NONE &&
                chat.membership.role === ROLE_NONE
            );
    }
}

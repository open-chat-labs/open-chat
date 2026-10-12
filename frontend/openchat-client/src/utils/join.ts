import {
    ErrorCode,
    i18nKey,
    type ClientJoinGroupResponse,
    type GateCheckFailed,
    type IdentityState,
    type JoinCommunity,
    type JoinGroup,
    type Level,
    type ResourceKey,
    type Success,
} from "@shared";

/**
 * The message to show for a join that failed. Every failure maps to one, so a failed join is
 * never silent.
 */
export function joinGroupFailureMessage(
    resp: Exclude<ClientJoinGroupResponse, Success | GateCheckFailed>,
    level: Level,
): ResourceKey {
    switch (resp.kind) {
        case "blocked":
            return i18nKey("youreBlocked");
        case "error":
            return resp.code === ErrorCode.InitiatorBlocked
                ? i18nKey("youreBlocked")
                : i18nKey("joinGroupFailed", undefined, level, true);
        case "failure":
        case "internal_error":
            return i18nKey("joinGroupFailed", undefined, level, true);
    }
}

/**
 * The group or community an anonymous user asked to join, once they have logged in and their
 * chats and communities have loaded. The caller clears the post-login state before joining, so the
 * join is replayed once.
 */
export function postLoginJoin(
    identityState: IdentityState,
    chatsInitialised: boolean,
): JoinGroup | JoinCommunity | undefined {
    if (identityState.kind !== "logged_in" || !chatsInitialised) return undefined;
    switch (identityState.postLogin?.kind) {
        case "join_group":
        case "join_community":
            return identityState.postLogin;
        default:
            return undefined;
    }
}

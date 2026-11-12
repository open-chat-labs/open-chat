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
 * The group or community an anonymous user asked to join, once they have logged in and their own
 * chats and communities have loaded (`ownChatsLoaded`, not the anonymous session's that stand in
 * after a sign-up). The caller clears the post-login state before joining, so the join is replayed
 * once.
 */
export function postLoginJoin(
    identityState: IdentityState,
    ownChatsLoaded: boolean,
): JoinGroup | JoinCommunity | undefined {
    if (identityState.kind !== "logged_in" || !ownChatsLoaded) return undefined;
    switch (identityState.postLogin?.kind) {
        case "join_group":
        case "join_community":
            return identityState.postLogin;
        default:
            return undefined;
    }
}

/**
 * Whether an anonymous user who asked to create a community has now logged in, so creating it
 * picks up where it left off. The caller clears the post-login state first, so it runs once.
 */
export function postLoginCreateCommunity(identityState: IdentityState): boolean {
    return (
        identityState.kind === "logged_in" && identityState.postLogin?.kind === "create_community"
    );
}

/**
 * The page a guest was going to when they were asked to sign in (one that needs an account), once
 * they have logged in. The caller clears the post-login state before going there, so it's gone to
 * once.
 */
export function postLoginPath(identityState: IdentityState): string | undefined {
    return identityState.kind === "logged_in" && identityState.postLogin?.kind === "continue_to"
        ? identityState.postLogin.path
        : undefined;
}

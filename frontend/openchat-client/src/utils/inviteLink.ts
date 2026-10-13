import {
    i18nKey,
    type CommunityIdentifier,
    type DisableInviteCodeResponse,
    type EnableInviteCodeResponse,
    type InviteCodeResponse,
    type InviteLink,
    type InviteLinkOutcome,
    type MultiUserChatIdentifier,
    type ResetInviteCodeResponse,
    routeForChatIdentifier,
} from "@shared";

/** The link a code-returning invite link operation leaves behind, or `failure` if it failed */
export function inviteCodeResult(
    resp: InviteCodeResponse | EnableInviteCodeResponse | ResetInviteCodeResponse,
    failure: string,
): InviteLinkOutcome {
    switch (resp.kind) {
        case "success":
            return resp.code === undefined
                ? { kind: "disabled" }
                : { kind: "enabled", code: resp.code };
        case "error":
        case "offline":
        case "failure":
            return { kind: "failed", message: i18nKey(failure) };
        default:
            return resp satisfies never;
    }
}

export function disableInviteCodeResult(resp: DisableInviteCodeResponse): InviteLinkOutcome {
    switch (resp.kind) {
        case "success":
            return { kind: "disabled" };
        case "error":
        case "offline":
        case "failure":
            return { kind: "failed", message: i18nKey("invite.errorDisablingLink") };
        default:
            return resp satisfies never;
    }
}

/**
 * The URL to share for a group, channel or community, if it has one: public, or private with its link enabled.
 * A private link only works with its invite code, so the code comes from the link itself.
 */
export function inviteLinkUrl(
    origin: string,
    id: CommunityIdentifier | MultiUserChatIdentifier,
    referrer: string,
    link: InviteLink | undefined,
): string | undefined {
    let qs = `/?ref=${referrer}`;
    switch (link?.kind) {
        case "public":
            break;
        case "enabled":
            qs += `&code=${link.code}`;
            break;
        default:
            return undefined;
    }
    switch (id.kind) {
        case "community":
            return `${origin}/community/${id.communityId}${qs}`;
        case "channel":
            return `${origin}${routeForChatIdentifier("community", id)}${qs}`;
        case "group_chat":
            return `${origin}${routeForChatIdentifier("chats", id)}${qs}`;
    }
}

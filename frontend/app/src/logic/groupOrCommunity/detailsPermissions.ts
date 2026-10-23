import type { CommunitySummary, MultiUserChat, OpenChat, VersionedRules } from "@client";

/** What a chat's or community's details panel offers the viewer. */
export type DetailsPermissions = { canEdit: boolean; canDelete: boolean; canInvite: boolean };

const nothing: DetailsPermissions = { canEdit: false, canDelete: false, canInvite: false };

/**
 * A group's or channel's details: nothing for a guest, nor in a frozen chat or community. A
 * private channel's members are added, not invited.
 */
export function chatDetailsPermissions(
    client: OpenChat,
    chat: MultiUserChat,
    community: CommunitySummary | undefined,
    anon: boolean,
): DetailsPermissions {
    const frozen =
        client.isChatFrozen(chat.id) ||
        (community !== undefined && client.isCommunityFrozen(community.id));
    if (anon || frozen) return nothing;
    return {
        canEdit: client.canEditGroupDetails(chat.id),
        canDelete: client.canDeleteGroup(chat.id),
        canInvite:
            client.canInviteUsers(chat.id) &&
            (chat.kind !== "channel" || !client.isChatPrivate(chat)),
    };
}

/** A community's details: nothing for a guest, nor while it's frozen. */
export function communityDetailsPermissions(
    client: OpenChat,
    community: CommunitySummary,
    anon: boolean,
): DetailsPermissions {
    if (anon || client.isCommunityFrozen(community.id)) return nothing;
    return {
        canEdit: client.canEditCommunity(community.id),
        canDelete: client.canDeleteCommunity(community.id),
        canInvite: client.canInviteUsers(community.id),
    };
}

/**
 * A chat's rules as its details show them: combined with its community's, and only to someone
 * who can send in it ("" otherwise).
 */
export function chatRulesText(
    client: OpenChat,
    chat: MultiUserChat,
    chatRules: VersionedRules | undefined,
    communityRules: VersionedRules | undefined,
): string {
    return client.canSendMessage(chat.id, "any")
        ? client.combineRulesText(chatRules, communityRules)
        : "";
}

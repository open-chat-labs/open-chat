import {
    hasOwnerRights,
    ROLE_NONE,
    type CommunitySummary,
    type MultiUserChat,
    type OpenChat,
    type VersionedRules,
} from "@client";

/**
 * What a chat's or community's details panel offers the viewer. `canInvite` is inviting by link or
 * by name; `canOpenInvite` is opening the invite dialog at all, which also covers adding members to
 * a private channel and a public chat's member sharing its link. User groups are a community's.
 */
export type DetailsPermissions = {
    canEdit: boolean;
    canDelete: boolean;
    canInvite: boolean;
    canOpenInvite: boolean;
    canManageUserGroups: boolean;
    /** A group's owner can convert it to a community, or import it into one they own. */
    canConvert: boolean;
    canImport: boolean;
};

const nothing: DetailsPermissions = {
    canEdit: false,
    canDelete: false,
    canInvite: false,
    canOpenInvite: false,
    canManageUserGroups: false,
    canConvert: false,
    canImport: false,
};

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
    const canInviteUsers = client.canInviteUsers(chat.id);
    return {
        canEdit: client.canEditGroupDetails(chat.id),
        canDelete: client.canDeleteGroup(chat.id),
        canInvite: canInviteUsers && (chat.kind !== "channel" || !client.isChatPrivate(chat)),
        // as the old header menu offered it (`public || canInviteUsers`), and adding members
        canOpenInvite: chat.public || canInviteUsers || client.canAddMembers(chat.id),
        canManageUserGroups: false,
        canConvert: chat.kind === "group_chat" && client.canConvertGroupToCommunity(chat.id),
        canImport: chat.kind === "group_chat" && client.canImportToCommunity(chat.id),
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
        canOpenInvite: client.canInviteUsers(community.id),
        canManageUserGroups: client.canManageUserGroups(community.id),
        canConvert: false,
        canImport: false,
    };
}

/** A part of a chat's settings someone may see but not change. */
export type ReadOnlySetting = "gates" | "rules" | "permissions" | "disappearing" | "visibility";

/**
 * What a chat's settings dialog is for this viewer: the About page when they can't edit the chat,
 * else the editor with the parts their role can't change read-only. Permissions, disappearing
 * messages and who can see the chat are the owner's, as the backend has it.
 */
export type ManageAccess = { kind: "about" } | { kind: "edit"; readOnly: ReadOnlySetting[] };

export function chatManageAccess(
    client: OpenChat,
    chat: MultiUserChat,
    community: CommunitySummary | undefined,
    anon: boolean,
): ManageAccess {
    if (!chatDetailsPermissions(client, chat, community, anon).canEdit) return { kind: "about" };
    const readOnly: ReadOnlySetting[] = [];
    if (!client.canChangePermissions(chat.id)) readOnly.push("permissions");
    if (!hasOwnerRights(chat.membership.role)) readOnly.push("disappearing", "visibility");
    return { kind: "edit", readOnly };
}

/**
 * The same for a community: its permissions and who can see it are the owner's
 * (`canChangeCommunityPermissions`, and owner rights for visibility). A community has no history or
 * disappearing messages to lock.
 */
export function communityManageAccess(
    client: OpenChat,
    community: CommunitySummary,
    anon: boolean,
): ManageAccess {
    if (!communityDetailsPermissions(client, community, anon).canEdit) return { kind: "about" };
    const readOnly: ReadOnlySetting[] = [];
    if (!client.canChangeCommunityPermissions(community.id)) readOnly.push("permissions");
    if (!hasOwnerRights(community.membership.role)) readOnly.push("visibility");
    return { kind: "edit", readOnly };
}

/** What a community's menu offers: a member may leave, and the rest needs it not to be frozen. */
export type CommunityMenuPermissions = {
    canLeave: boolean;
    canDelete: boolean;
    canEdit: boolean;
    canInvite: boolean;
    canCreateChannel: boolean;
};

export function communityMenuPermissions(
    client: OpenChat,
    community: CommunitySummary,
): CommunityMenuPermissions {
    const member = community.membership.role !== ROLE_NONE;
    const acting = member && !client.isCommunityFrozen(community.id);
    return {
        canLeave: member,
        canDelete: acting && client.canDeleteCommunity(community.id),
        canEdit: acting && client.canEditCommunity(community.id),
        canInvite: acting && client.canInviteUsers(community.id),
        canCreateChannel: acting && client.canCreateChannel(community.id),
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

import type { OptionUpdate } from "./optionUpdate";

export const allRoles = ["none", "owner", "admin", "moderator", "member"] as const;
export const chatRoles = allRoles;
type ChatRolesType = typeof allRoles;
export type ChatPermissionRole = ChatRolesType[number];
export type PermissionRole = ChatPermissionRole;

export const communityRoles = ["owner", "admin", "member"] as const;
type CommunityRolesType = typeof communityRoles;
export type CommunityPermissionRole = CommunityRolesType[number];

export type MemberRole = "admin" | "moderator" | "member" | "owner" | "none";

export const messagePermissionsList = ["text", "image", "video", "audio", "file", "poll", "crypto", "giphy", "prize", "memeFighter", "p2pSwap"] as const;
type MessagePermissionsType = typeof messagePermissionsList;
export type MessagePermission = MessagePermissionsType[number];

export type Permissioned<T> = {
    permissions: T;
};

export type HasMembershipRole = {
    membership: {
        role: MemberRole;
    };
};

export type ChatPermissions = {
    changeRoles: ChatPermissionRole;
    updateGroup: ChatPermissionRole;
    inviteUsers: ChatPermissionRole;
    removeMembers: ChatPermissionRole;
    deleteMessages: ChatPermissionRole;
    pinMessages: ChatPermissionRole;
    reactToMessages: ChatPermissionRole;
    mentionAllMembers: ChatPermissionRole;
    messagePermissions: MessagePermissions;
    threadPermissions: MessagePermissions | undefined;
};

export type MessagePermissions = {
    default: ChatPermissionRole;
    text?: ChatPermissionRole;
    image?: ChatPermissionRole;
    video?: ChatPermissionRole;
    audio?: ChatPermissionRole;
    file?: ChatPermissionRole;
    poll?: ChatPermissionRole;
    crypto?: ChatPermissionRole;
    giphy?: ChatPermissionRole;
    prize?: ChatPermissionRole;
    memeFighter?: ChatPermissionRole;
    p2pSwap?: ChatPermissionRole;
};

export type OptionalChatPermissions = {
    changeRoles?: ChatPermissionRole;
    updateGroup?: ChatPermissionRole;
    inviteUsers?: ChatPermissionRole;
    removeMembers?: ChatPermissionRole;
    deleteMessages?: ChatPermissionRole;
    pinMessages?: ChatPermissionRole;
    reactToMessages?: ChatPermissionRole;
    mentionAllMembers?: ChatPermissionRole;
    messagePermissions: OptionalMessagePermissions | undefined;
    threadPermissions: OptionUpdate<OptionalMessagePermissions>;
};

export type OptionalMessagePermissions = {
    default: ChatPermissionRole | undefined;
    text: OptionUpdate<ChatPermissionRole>;
    image: OptionUpdate<ChatPermissionRole>;
    video: OptionUpdate<ChatPermissionRole>;
    audio: OptionUpdate<ChatPermissionRole>;
    file: OptionUpdate<ChatPermissionRole>;
    poll: OptionUpdate<ChatPermissionRole>;
    crypto: OptionUpdate<ChatPermissionRole>;
    giphy: OptionUpdate<ChatPermissionRole>;
    prize: OptionUpdate<ChatPermissionRole>;
    memeFighter: OptionUpdate<ChatPermissionRole>;
    p2pSwap: OptionUpdate<ChatPermissionRole>;
};

export type CommunityPermissions = {
    changeRoles: CommunityPermissionRole;
    updateDetails: CommunityPermissionRole;
    inviteUsers: CommunityPermissionRole;
    removeMembers: CommunityPermissionRole;
    createPublicChannel: CommunityPermissionRole;
    createPrivateChannel: CommunityPermissionRole;
    manageUserGroups: CommunityPermissionRole;
};

export function defaultOptionalChatPermissions(): OptionalChatPermissions {
    return {
        messagePermissions: undefined,
        threadPermissions: undefined,
    };
}

export function defaultOptionalMessagePermissions(): OptionalMessagePermissions {
    return {
        default: undefined,
        text: undefined,
        image: undefined,
        video: undefined,
        audio: undefined,
        file: undefined,
        poll: undefined,
        crypto: undefined,
        giphy: undefined,
        prize: undefined,
        memeFighter: undefined,
        p2pSwap: undefined,
    };
}

export type PermissionsByRole = Record<ChatPermissionRole, Set<string>>;

export const allRoles = ["owner", "admin", "moderator", "member", "none"] as const;
export const chatRoles = allRoles;
type ChatRolesType = typeof allRoles;
export type ChatPermissionRole = ChatRolesType[number];
export type PermissionRole = ChatPermissionRole;

export const communityRoles = ["owner", "admin", "member"] as const;
type CommunityRolesType = typeof communityRoles;
export type CommunityPermissionRole = CommunityRolesType[number];

export type MemberRole = "admin" | "moderator" | "member" | "owner" | "none";

export type Permissioned<T> = {
    permissions: T;
};

export type HasMembershipRole = {
    membership: {
        role: MemberRole;
    };
};

export type ChatPermissions = {
    changePermissions: ChatPermissionRole;
    changeRoles: ChatPermissionRole;
    removeMembers: ChatPermissionRole;
    blockUsers: ChatPermissionRole;
    deleteMessages: ChatPermissionRole;
    updateGroup: ChatPermissionRole;
    pinMessages: ChatPermissionRole;
    inviteUsers: ChatPermissionRole;
    createPolls: ChatPermissionRole;
    sendMessages: ChatPermissionRole;
    reactToMessages: ChatPermissionRole;
    replyInThread: ChatPermissionRole;
};

export type CommunityPermissions = {
    changeRoles: CommunityPermissionRole;
    inviteUsers: CommunityPermissionRole;
    removeMembers: CommunityPermissionRole;
    blockUsers: CommunityPermissionRole;
    updateDetails: CommunityPermissionRole;
    createPublicChannel: CommunityPermissionRole;
    createPrivateChannel: CommunityPermissionRole;
};

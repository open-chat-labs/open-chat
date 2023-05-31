import type { Gated } from "../access";
import type { DataContent } from "../data";

export type Community = Gated & {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    channelCount: number;
    unreadCount: number;
    avatar: DataContent;
    banner: DataContent;
    isPublic: boolean;
    permissions: CommunityPermissions;
};

export const communityRoles = ["owner", "admins", "members"] as const;
type RolesType = typeof communityRoles;
export type CommunityPermissionRole = RolesType[number];

export type CommunityPermissions = {
    changePermissions: CommunityPermissionRole;
    changeRoles: CommunityPermissionRole;
    inviteUsers: CommunityPermissionRole;
    removeMembers: CommunityPermissionRole;
    updateDetails: CommunityPermissionRole;
    createPublicChannel: CommunityPermissionRole;
    createPrivateChannel: CommunityPermissionRole;
};

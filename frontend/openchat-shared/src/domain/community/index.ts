import type { AccessControlled } from "../access";
import type { DataContent } from "../data";
import type { HasIdentity } from "../identity";
import type { CommunityPermissionRole, Permissioned } from "../permission";

export type Community = HasIdentity &
    AccessControlled &
    Permissioned<CommunityPermissions> & {
        name: string;
        description: string;
        memberCount: number;
        channelCount: number;
        unreadCount: number;
        avatar: DataContent;
        banner: DataContent;
    };

export type CommunityPermissions = {
    changePermissions: CommunityPermissionRole;
    changeRoles: CommunityPermissionRole;
    inviteUsers: CommunityPermissionRole;
    removeMembers: CommunityPermissionRole;
    updateDetails: CommunityPermissionRole;
    createPublicChannel: CommunityPermissionRole;
    createPrivateChannel: CommunityPermissionRole;
};

// TODO - not sure if this really needs to be a thing yet
export type DefaultChannel = {
    name: string;
    createdAt: number;
};

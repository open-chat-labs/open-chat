import type { AccessControlled, AccessRules } from "../access";
import type { Member } from "../chat";
import type { DataContent } from "../data";
import type { HasIdentity } from "../identity";
import type { CommunityPermissionRole, Permissioned } from "../permission";
import type { HasLevel } from "../structure";

export type Community = HasIdentity &
    AccessControlled &
    HasLevel &
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

export type CommunitySpecificState = {
    members: Member[];
    blockedUsers: Set<string>;
    invitedUsers: Set<string>;
    rules?: AccessRules;
};

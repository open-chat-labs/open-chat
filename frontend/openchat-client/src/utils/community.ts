import type { CommunitySummary, MemberRole } from "openchat-shared";
import { hasOwnerRights, isPermitted } from "./permissions";

export function canChangeRoles(
    { membership, permissions }: CommunitySummary,
    currRole: MemberRole,
    newRole: MemberRole,
): boolean {
    if (currRole === newRole) {
        return false;
    }

    switch (newRole) {
        case "owner":
            return hasOwnerRights(membership.role);
        default:
            return isPermitted(membership.role, permissions.changeRoles);
    }
}

export function canEditCommunity({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.updateDetails);
}

export function canCreatePublicChannel({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.createPublicChannel);
}

export function canCreatePrivateChannel({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.createPrivateChannel);
}

export function canManageUserGroups({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.manageUserGroups);
}

export function canChangeCommunityRoles({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.changeRoles);
}

export function canChangeCommunityPermissions({ membership }: CommunitySummary): boolean {
    return hasOwnerRights(membership.role);
}

export function isCommunityLapsed({ membership }: CommunitySummary): boolean {
    return membership.lapsed;
}

export function canDeleteCommunity({ membership }: CommunitySummary): boolean {
    return hasOwnerRights(membership.role);
}

export function canBlockUsers(community: CommunitySummary): boolean {
    return (
        community.public &&
        isPermitted(community.membership.role, community.permissions.removeMembers)
    );
}

export function canUnblockUsers(community: CommunitySummary): boolean {
    return (
        community.public &&
        isPermitted(community.membership.role, community.permissions.removeMembers)
    );
}

export function canInviteUsers(community: CommunitySummary): boolean {
    return isPermitted(community.membership.role, community.permissions.inviteUsers);
}

export function canRemoveMembers(community: CommunitySummary): boolean {
    return isPermitted(community.membership.role, community.permissions.removeMembers);
}

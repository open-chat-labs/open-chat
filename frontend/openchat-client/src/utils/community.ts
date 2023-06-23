import type { CommunitySummary, MemberRole } from "openchat-shared";
import { hasOwnerRights, isPermitted } from "./permissions";

export function canChangeRoles(
    { membership, permissions }: CommunitySummary,
    currRole: MemberRole,
    newRole: MemberRole
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

export function canBlockUsers({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.blockUsers);
}

export function canUnblockUsers({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.blockUsers);
}

export function canInviteUsers({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.inviteUsers);
}

export function canRemoveMembers({ membership, permissions }: CommunitySummary): boolean {
    return isPermitted(membership.role, permissions.removeMembers);
}

import type {
    CommunityMap,
    CommunitySummary,
    LocalCommunitySummaryUpdates,
    MemberRole,
} from "openchat-shared";
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

export function mergeLocalUpdates(
    server: CommunityMap<CommunitySummary>,
    localUpdates: CommunityMap<LocalCommunitySummaryUpdates>
): CommunityMap<CommunitySummary> {
    if (Object.keys(localUpdates).length === 0) return server;

    const merged = server.clone();

    for (const [chatId, localUpdate] of localUpdates.entries()) {
        if (localUpdate.added !== undefined) {
            const current = merged.get(chatId);
            if (current === undefined || current.membership.role === "none") {
                merged.set(chatId, localUpdate.added);
            }
        }
        if (localUpdate.removedAtTimestamp) {
            const community = merged.get(chatId);
            if (
                community !== undefined &&
                community.membership.joined < localUpdate.removedAtTimestamp
            ) {
                merged.delete(chatId);
            }
        }
    }

    return merged;
}

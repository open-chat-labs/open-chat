import {
    type AccessControlled,
    type CommunityAndRules,
    type CommunityChanges,
    type CommunitySummary,
    type CreateCommunityResponse,
    ErrorCode,
    type GroupChangeConfirmation,
    type HasMembershipRole,
    i18nKey,
    type MemberRole,
    type ResourceKey,
    ROLE_NONE,
    ROLE_OWNER,
    stripSuspendedGate,
    type UpdateCommunityOutcome,
    type UpdateCommunityResponse,
} from "@shared";
import { hasAccessGateChanged } from "./group.svelte";
import { mergeKeepingOnlyChanged } from "./object";
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
        case ROLE_OWNER:
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

// A community the user hasn't joined (or whose membership has lapsed) hides its channels'
// messages unless it is public and ungated (a suspended unique person gate counts as no gate)
export function isPrivateCommunityPreview(
    community: (HasMembershipRole & Pick<AccessControlled, "public" | "gateConfig">) | undefined,
): boolean {
    return (
        community !== undefined &&
        (community.membership.role === ROLE_NONE || community.membership.lapsed) &&
        (!community.public || stripSuspendedGate(community.gateConfig.gate).kind !== "no_gate")
    );
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

/**
 * What the user has changed about a community they are editing, holding only the fields that differ.
 * A community with no changes gives an empty object.
 */
export function communityChanges(
    { community: original, rules: originalRules }: CommunityAndRules,
    { community: candidate, rules }: CommunityAndRules,
): CommunityChanges {
    const changes: CommunityChanges = {};
    if (candidate.name !== original.name) changes.name = candidate.name;
    if (candidate.description !== original.description) {
        changes.description = candidate.description;
    }
    if (rules.enabled !== originalRules.enabled || rules.text !== originalRules.text) {
        changes.rules = rules;
    }
    if (
        Object.keys(mergeKeepingOnlyChanged(original.permissions, candidate.permissions)).length > 0
    ) {
        changes.permissions = candidate.permissions;
    }
    if (candidate.avatar?.blobUrl !== original.avatar?.blobUrl) {
        changes.avatar = candidate.avatar?.blobData;
    }
    if (candidate.banner?.blobUrl !== original.banner?.blobUrl) {
        changes.banner = candidate.banner?.blobData;
    }
    if (hasAccessGateChanged(candidate.gateConfig, original.gateConfig)) {
        changes.gateConfig = candidate.gateConfig;
    }
    if (candidate.public !== original.public) changes.isPublic = candidate.public;
    if (candidate.primaryLanguage !== original.primaryLanguage) {
        changes.primaryLanguage = candidate.primaryLanguage;
    }
    return changes;
}

// The first of the changes the user has yet to confirm, in the order they are asked. Only making a
// community private needs confirming, not making it public.
export function communityChangeConfirmationNeeded(
    original: CommunitySummary,
    changes: CommunityChanges,
    confirmed: GroupChangeConfirmation[],
): GroupChangeConfirmation | undefined {
    if (changes.name !== undefined && original.verified && !confirmed.includes("verified_name")) {
        return "verified_name";
    }
    if (changes.isPublic === false && !confirmed.includes("visibility")) {
        return "visibility";
    }
    return undefined;
}

function communityFailure(
    resp: Exclude<UpdateCommunityResponse | CreateCommunityResponse, { kind: "success" }>,
    fallback: string,
): ResourceKey {
    if (resp.kind === "offline") return i18nKey("offlineError");
    if (resp.kind === "error" && resp.code === ErrorCode.NameTaken) {
        return i18nKey("communities.errors.name_taken");
    }
    return i18nKey(fallback);
}

export function communityUpdateResult(resp: UpdateCommunityResponse): UpdateCommunityOutcome {
    switch (resp.kind) {
        case "success":
            return { kind: "success" };
        case "error":
        case "offline":
            return {
                kind: "failed",
                message: communityFailure(resp, "communities.errors.saveFailed"),
            };
        default:
            return resp satisfies never;
    }
}

export function communityCreationFailure(
    resp: Exclude<CreateCommunityResponse, { kind: "success" }>,
): ResourceKey {
    return communityFailure(resp, "communities.errors.failure");
}

import {
    ErrorCode,
    i18nKey,
    type CreateUserGroupResponse,
    type ResourceKey,
    type UpdateUserGroupResponse,
} from "@shared";

export type UserGroupSaveOutcome = { kind: "success" } | { kind: "failed"; message: ResourceKey };

/**
 * The members to add and remove for a user group edit: the picked ids against the group's members.
 * Builds new sets, so the group's own set (the store's) is never changed.
 */
export function userGroupMemberChanges(
    members: ReadonlySet<string>,
    memberIds: readonly string[],
): { toAdd: Set<string>; toRemove: Set<string> } {
    const picked = new Set(memberIds);
    return {
        toAdd: picked.difference(members),
        toRemove: new Set(members).difference(picked),
    };
}

/** A user group create's or update's response as an outcome: name taken and the member limit get their own messages. */
export function userGroupSaveOutcome(
    resp: CreateUserGroupResponse | UpdateUserGroupResponse,
    creating: boolean,
): UserGroupSaveOutcome {
    switch (resp.kind) {
        case "success":
            return { kind: "success" };
        case "error":
            if (resp.code === ErrorCode.NameTaken) {
                return {
                    kind: "failed",
                    message: i18nKey("communities.errors.userGroupNameTaken"),
                };
            }
            if (resp.code === ErrorCode.TooManyUsers) {
                // The canister sends the limit as the error's message
                return {
                    kind: "failed",
                    message: i18nKey("communities.errors.userGroupTooManyMembers", {
                        max: resp.message,
                    }),
                };
            }
            break;
        case "failure":
        case "offline":
            break;
        default:
            return resp satisfies never;
    }
    return {
        kind: "failed",
        message: i18nKey(
            creating
                ? "communities.errors.createGroupFailed"
                : "communities.errors.updateGroupFailed",
        ),
    };
}

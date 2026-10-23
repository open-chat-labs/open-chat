import {
    compareRoles,
    i18nKey,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_OWNER,
    type ExternalBot,
    type FullMember,
    type Member,
    type MemberRole,
    type MessageFormatter,
    type ReadonlySet,
    type ResourceKey,
    type UserLookup,
    type UserSummary,
} from "@shared";
import { roleAsText } from "./permissions";

/** The members whose user is held, each with their display name in the chat or community. */
export function knownMembers(users: UserLookup, members: Iterable<Member>): FullMember[] {
    const known: FullMember[] = [];
    for (const m of members) {
        const user = users.get(m.userId);
        if (user) {
            known.push({
                ...user,
                ...m,
                displayName: m.displayName ?? user.displayName,
            });
        }
    }
    return known;
}

/** The held users among `ids`. */
export function usersFromIds(users: UserLookup, ids: ReadonlySet<string>): UserSummary[] {
    const found: UserSummary[] = [];
    for (const id of ids) {
        const user = users.get(id);
        if (user) {
            found.push(user);
        }
    }
    return found;
}

export function memberMatchesSearch(
    searchTermLower: string,
    user: UserSummary | ExternalBot,
): boolean {
    if (searchTermLower === "") return true;
    if (user.kind === "external_bot") {
        return (
            user.name.toLowerCase().includes(searchTermLower) ||
            (user.definition.description !== undefined &&
                user.definition.description.toLocaleLowerCase().includes(searchTermLower))
        );
    }

    if (user.username === undefined) return true;
    return (
        user.username.toLowerCase().includes(searchTermLower) ||
        (user.displayName !== undefined && user.displayName.toLowerCase().includes(searchTermLower))
    );
}

/** Highest role first. */
export function compareMembers(a: FullMember, b: FullMember): number {
    return b.role - a.role;
}

/** The message to show when changing a member's role from `oldRole` to `newRole` fails. */
export function roleChangeFailureMessage(
    newRole: MemberRole,
    oldRole: MemberRole,
    formatter: MessageFormatter,
): ResourceKey {
    const promotion = compareRoles(newRole, oldRole) > 0;
    return i18nKey(promotion ? "promoteFailed" : "demoteFailed", {
        role: formatter(roleAsText(newRole)),
    });
}

/** What the viewer may do to a member, as the chat's or community's permissions allow. */
export type MemberPermissions = {
    promote: (from: MemberRole, to: MemberRole) => boolean;
    demote: (from: MemberRole, to: MemberRole) => boolean;
    remove: boolean;
    block: boolean;
};

export type MemberActions = {
    canPromoteToOwner: boolean;
    canPromoteToAdmin: boolean;
    canDemoteToAdmin: boolean;
    canPromoteToModerator: boolean;
    canDemoteToModerator: boolean;
    canDemoteToMember: boolean;
    canRemoveMember: boolean;
    canBlockUser: boolean;
};

/**
 * The role changes, removal and blocking offered for a member: exactly what the permissions
 * allow, except that on your own row you can only step down (never promote yourself, make
 * yourself owner, or remove or block yourself).
 */
export function memberActions(
    role: MemberRole,
    isMe: boolean,
    can: MemberPermissions,
): MemberActions {
    return {
        canPromoteToOwner: !isMe && can.promote(role, ROLE_OWNER),
        canPromoteToAdmin: !isMe && can.promote(role, ROLE_ADMIN),
        canDemoteToAdmin: can.demote(role, ROLE_ADMIN),
        canPromoteToModerator: !isMe && can.promote(role, ROLE_MODERATOR),
        canDemoteToModerator: can.demote(role, ROLE_MODERATOR),
        canDemoteToMember: can.demote(role, ROLE_MEMBER),
        canRemoveMember: !isMe && can.remove,
        canBlockUser: !isMe && can.block,
    };
}

/** The roles a member can be given, from `memberActions`. */
export function memberRoleChoices(actions: MemberActions): MemberRole[] {
    const roles: MemberRole[] = [];
    if (actions.canPromoteToOwner) roles.push(ROLE_OWNER);
    if (actions.canPromoteToAdmin || actions.canDemoteToAdmin) roles.push(ROLE_ADMIN);
    if (actions.canPromoteToModerator || actions.canDemoteToModerator) roles.push(ROLE_MODERATOR);
    if (actions.canDemoteToMember) roles.push(ROLE_MEMBER);
    return roles;
}

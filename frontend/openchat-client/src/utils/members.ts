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

// A group's or channel's members by role, and what the ⋯ on each offers (the native design's
// Members screen, plan 10): role items up to your own role, and only where your role meets "Change
// member roles"; Remove (and Block) only where it meets "Remove / block members"; with neither, the
// ⋯ says why. What the permissions allow is `memberActions`', as the web's panel has it.

/** A role section of the members list, highest first: Owners, Admins, Moderators, Members. */
export type MemberSectionId = "owners" | "admins" | "moderators" | "members";

export type MemberSection<M> = { id: MemberSectionId; role: MemberRole; members: M[] };

const SECTIONS: [MemberSectionId, MemberRole][] = [
    ["owners", ROLE_OWNER],
    ["admins", ROLE_ADMIN],
    ["moderators", ROLE_MODERATOR],
    ["members", ROLE_MEMBER],
];

/** What a members list row needs to be sorted into its section. */
export type SectionMember = { userId: string; role: MemberRole; name: string };

/**
 * The members in their role sections, highest role first, leaving out empty ones. In each, you
 * come first, then the others by name.
 */
export function memberSections<M extends SectionMember>(
    members: readonly M[],
    me: string,
): MemberSection<M>[] {
    return SECTIONS.flatMap(([id, role]) => {
        const held = members
            .filter((m) => sectionRole(m.role) === role)
            .sort((a, b) =>
                a.userId === me
                    ? -1
                    : b.userId === me
                      ? 1
                      : a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
            );
        return held.length === 0 ? [] : [{ id, role, members: held }];
    });
}

// a role the sections don't name (none) is a plain member's
function sectionRole(role: MemberRole): MemberRole {
    return SECTIONS.some(([, r]) => r === role) ? role : ROLE_MEMBER;
}

/** What a member's ⋯ offers you. */
export type MemberMenu =
    // no ⋯: your own row, or someone at or above your role
    | { kind: "none" }
    // a ⋯ that says, in a toast, that your role can't do anything to them here
    | { kind: "not_allowed" }
    // the roles you can give them (up to your own), and whether you can remove or block them
    | { kind: "actions"; roles: MemberRole[]; remove: boolean; block: boolean };

/**
 * Whether a member's row has a ⋯ for you with `myRole`: only members below you do. It's
 * `memberMenu`'s "none" without the permissions, cheap enough for every row of a large group; the
 * menu itself is worked out when it's opened.
 */
export function memberHasMenu(
    myRole: MemberRole,
    member: { role: MemberRole; isMe: boolean },
): boolean {
    return !member.isMe && compareRoles(member.role, myRole) < 0;
}

/**
 * A member's ⋯, for you with `myRole`: only on members below you; the role choices `actions`
 * allows that aren't above your own role (several owners are allowed, so an owner can make
 * another); remove and block as `actions` allows them.
 */
export function memberMenu(
    myRole: MemberRole,
    member: { role: MemberRole; isMe: boolean },
    actions: MemberActions,
): MemberMenu {
    if (!memberHasMenu(myRole, member)) return { kind: "none" };
    const roles = memberRoleChoices(actions).filter((role) => compareRoles(role, myRole) <= 0);
    const remove = actions.canRemoveMember;
    const block = actions.canBlockUser;
    if (roles.length === 0 && !remove && !block) return { kind: "not_allowed" };
    return { kind: "actions", roles, remove, block };
}

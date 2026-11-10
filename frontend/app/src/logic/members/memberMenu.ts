import {
    compareRoles,
    memberRoleChoices,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_OWNER,
    type MemberActions,
    type MemberRole,
} from "@client";

// A group's or channel's members by role, and what the ⋯ on each offers (the native design's
// Members screen, plan 10): role items up to your own role, and only where your role meets "Change
// member roles"; Remove (and Block) only where it meets "Remove / block members"; with neither, the
// ⋯ says why. What the permissions allow is `memberActions`' (@client), as the web's panel has it.

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
 * A member's ⋯, for you with `myRole`: only on members below you; the role choices `actions`
 * allows that aren't above your own role (several owners are allowed, so an owner can make
 * another); remove and block as `actions` allows them.
 */
export function memberMenu(
    myRole: MemberRole,
    member: { role: MemberRole; isMe: boolean },
    actions: MemberActions,
): MemberMenu {
    if (member.isMe || compareRoles(member.role, myRole) >= 0) return { kind: "none" };
    const roles = memberRoleChoices(actions).filter((role) => compareRoles(role, myRole) <= 0);
    const remove = actions.canRemoveMember;
    const block = actions.canBlockUser;
    if (roles.length === 0 && !remove && !block) return { kind: "not_allowed" };
    return { kind: "actions", roles, remove, block };
}

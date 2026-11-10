import {
    memberActions,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type MemberActions,
    type MemberPermissions,
    type MemberRole,
} from "@client";
import { describe, expect, test } from "vitest";
import { memberMenu, memberSections } from "./memberMenu";

// a group's default permissions: changing roles is an admin's, removing and blocking a
// moderator's; making someone an owner is an owner's (the client's canChangeRoles)
function permissions(
    myRole: MemberRole,
    changeRoles: MemberRole = ROLE_ADMIN,
    removeMembers: MemberRole = ROLE_MODERATOR,
): MemberPermissions {
    const canChange = (to: MemberRole) =>
        to === ROLE_OWNER ? myRole === ROLE_OWNER : myRole >= changeRoles;
    return {
        promote: (from, to) => to > from && canChange(to),
        demote: (from, to) => to < from && canChange(to),
        remove: myRole >= removeMembers,
        block: myRole >= removeMembers,
    };
}

function actionsOn(role: MemberRole, can: MemberPermissions, isMe = false): MemberActions {
    return memberActions(role, isMe, can);
}

describe("memberSections", () => {
    const m = (userId: string, role: MemberRole, name: string) => ({ userId, role, name });

    test("puts the members in role sections, highest first, without empty ones", () => {
        const sections = memberSections(
            [
                m("a", ROLE_MEMBER, "Ann"),
                m("b", ROLE_OWNER, "Bob"),
                m("c", ROLE_MODERATOR, "Cat"),
                m("d", ROLE_MEMBER, "Dan"),
            ],
            "x",
        );
        expect(sections.map((s) => s.id)).toEqual(["owners", "moderators", "members"]);
        expect(sections[2].members.map((x) => x.userId)).toEqual(["a", "d"]);
    });

    test("lists you first in your section, then the others by name", () => {
        const [section] = memberSections(
            [m("z", ROLE_MEMBER, "zoe"), m("me", ROLE_MEMBER, "Yan"), m("b", ROLE_MEMBER, "Ben")],
            "me",
        );
        expect(section.members.map((x) => x.userId)).toEqual(["me", "b", "z"]);
    });

    test("counts a member without a role as a member", () => {
        const sections = memberSections([m("a", ROLE_NONE, "Ann")], "x");
        expect(sections.map((s) => s.id)).toEqual(["members"]);
    });
});

describe("memberMenu", () => {
    test("has no ⋯ on your own row or anyone at or above your role", () => {
        const can = permissions(ROLE_ADMIN);
        expect(memberMenu(ROLE_ADMIN, { role: ROLE_ADMIN, isMe: true }, actionsOn(ROLE_ADMIN, can, true))).toEqual({ kind: "none" });
        expect(memberMenu(ROLE_ADMIN, { role: ROLE_ADMIN, isMe: false }, actionsOn(ROLE_ADMIN, can))).toEqual({ kind: "none" });
        expect(memberMenu(ROLE_ADMIN, { role: ROLE_OWNER, isMe: false }, actionsOn(ROLE_OWNER, can))).toEqual({ kind: "none" });
        // a plain member has no one below them
        const member = permissions(ROLE_MEMBER);
        expect(memberMenu(ROLE_MEMBER, { role: ROLE_MEMBER, isMe: false }, actionsOn(ROLE_MEMBER, member))).toEqual({ kind: "none" });
    });

    test("offers an owner every role, owner included, and removing", () => {
        const can = permissions(ROLE_OWNER);
        expect(memberMenu(ROLE_OWNER, { role: ROLE_MEMBER, isMe: false }, actionsOn(ROLE_MEMBER, can))).toEqual({
            kind: "actions",
            roles: [ROLE_OWNER, ROLE_ADMIN, ROLE_MODERATOR],
            remove: true,
            block: true,
        });
        expect(memberMenu(ROLE_OWNER, { role: ROLE_ADMIN, isMe: false }, actionsOn(ROLE_ADMIN, can))).toEqual({
            kind: "actions",
            roles: [ROLE_OWNER, ROLE_MODERATOR, ROLE_MEMBER],
            remove: true,
            block: true,
        });
    });

    test("offers an admin roles up to admin, never owner", () => {
        const can = permissions(ROLE_ADMIN);
        expect(memberMenu(ROLE_ADMIN, { role: ROLE_MODERATOR, isMe: false }, actionsOn(ROLE_MODERATOR, can))).toEqual({
            kind: "actions",
            roles: [ROLE_ADMIN, ROLE_MEMBER],
            remove: true,
            block: true,
        });
    });

    // the client lets anyone whose role meets "Change member roles" give any role but owner, so a
    // moderator allowed to change roles could make an admin: the ⋯ stops at their own role
    test("never offers a role above your own", () => {
        const can = permissions(ROLE_MODERATOR, ROLE_MODERATOR);
        expect(memberMenu(ROLE_MODERATOR, { role: ROLE_MEMBER, isMe: false }, actionsOn(ROLE_MEMBER, can))).toEqual({
            kind: "actions",
            roles: [ROLE_MODERATOR],
            remove: true,
            block: true,
        });
    });

    test("offers only removing where your role can't change roles", () => {
        const can = permissions(ROLE_MODERATOR);
        expect(memberMenu(ROLE_MODERATOR, { role: ROLE_MEMBER, isMe: false }, actionsOn(ROLE_MEMBER, can))).toEqual({
            kind: "actions",
            roles: [],
            remove: true,
            block: true,
        });
    });

    test("says why when your role can do neither", () => {
        const can = permissions(ROLE_MODERATOR, ROLE_ADMIN, ROLE_ADMIN);
        expect(memberMenu(ROLE_MODERATOR, { role: ROLE_MEMBER, isMe: false }, actionsOn(ROLE_MEMBER, can))).toEqual({
            kind: "not_allowed",
        });
    });
});

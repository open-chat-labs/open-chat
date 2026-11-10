import {
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type AccessGateConfig,
    type MemberRole,
} from "@shared";
import { describe, expect, test } from "vitest";
import {
    hasAccessGates,
    listedUserMenu,
    memberActions,
    memberHasMenu,
    memberMenu,
    memberRoleChoices,
    memberSections,
    memberTabs,
    roleChangeFailureMessage,
    type MemberActions,
    type MemberPermissions,
} from "./members";

const formatter = (id: string) => `<${id}>`;

describe("roleChangeFailureMessage", () => {
    // 4a invariant 6: a failed role change says promote or demote by compareRoles, with the role's name
    test("a failed role change says promote or demote by comparing roles, naming the translated new role", () => {
        expect(roleChangeFailureMessage(ROLE_ADMIN, ROLE_MEMBER, formatter)).toMatchObject({
            key: "promoteFailed",
            params: { role: "<admin>" },
        });
        expect(roleChangeFailureMessage(ROLE_MODERATOR, ROLE_OWNER, formatter)).toMatchObject({
            key: "demoteFailed",
            params: { role: "<moderator>" },
        });
    });
});

describe("memberActions", () => {
    // 4a invariant 2: the role choices offered are exactly those canPromote / canDemote allow, and
    // you can't make yourself owner or remove yourself
    test("offers exactly the role changes the permissions allow, and only stepping down for yourself", () => {
        const allowed = new Set([
            `${ROLE_MEMBER}>${ROLE_OWNER}`,
            `${ROLE_MEMBER}>${ROLE_MODERATOR}`,
            `${ROLE_OWNER}<${ROLE_ADMIN}`,
            `${ROLE_ADMIN}<${ROLE_MEMBER}`,
        ]);
        const can: MemberPermissions = {
            promote: (from, to) => allowed.has(`${from}>${to}`),
            demote: (from, to) => allowed.has(`${from}<${to}`),
            remove: true,
            block: true,
        };
        expect(memberRoleChoices(memberActions(ROLE_MEMBER, false, can))).toEqual([
            ROLE_OWNER,
            ROLE_MODERATOR,
        ]);
        expect(memberRoleChoices(memberActions(ROLE_OWNER, false, can))).toEqual([ROLE_ADMIN]);
        expect(memberActions(ROLE_MEMBER, false, can)).toMatchObject({
            canRemoveMember: true,
            canBlockUser: true,
        });

        // on your own row: no promotions (not even to moderator), no remove or block, but you can
        // still step down
        const me = memberActions(ROLE_MEMBER, true, can);
        expect(memberRoleChoices(me)).toEqual([]);
        expect(me).toMatchObject({ canRemoveMember: false, canBlockUser: false });
        expect(memberRoleChoices(memberActions(ROLE_OWNER, true, can))).toEqual([ROLE_ADMIN]);
        expect(memberRoleChoices(memberActions(ROLE_ADMIN, true, can))).toEqual([ROLE_MEMBER]);
    });
});

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
        expect(
            memberMenu(
                ROLE_ADMIN,
                { role: ROLE_ADMIN, isMe: true },
                actionsOn(ROLE_ADMIN, can, true),
            ),
        ).toEqual({ kind: "none" });
        expect(
            memberMenu(ROLE_ADMIN, { role: ROLE_ADMIN, isMe: false }, actionsOn(ROLE_ADMIN, can)),
        ).toEqual({ kind: "none" });
        expect(
            memberMenu(ROLE_ADMIN, { role: ROLE_OWNER, isMe: false }, actionsOn(ROLE_OWNER, can)),
        ).toEqual({ kind: "none" });
        // a plain member has no one below them
        const member = permissions(ROLE_MEMBER);
        expect(
            memberMenu(
                ROLE_MEMBER,
                { role: ROLE_MEMBER, isMe: false },
                actionsOn(ROLE_MEMBER, member),
            ),
        ).toEqual({ kind: "none" });
    });

    test("offers an owner every role, owner included, and removing", () => {
        const can = permissions(ROLE_OWNER);
        expect(
            memberMenu(ROLE_OWNER, { role: ROLE_MEMBER, isMe: false }, actionsOn(ROLE_MEMBER, can)),
        ).toEqual({
            kind: "actions",
            roles: [ROLE_OWNER, ROLE_ADMIN, ROLE_MODERATOR],
            remove: true,
            block: true,
        });
        expect(
            memberMenu(ROLE_OWNER, { role: ROLE_ADMIN, isMe: false }, actionsOn(ROLE_ADMIN, can)),
        ).toEqual({
            kind: "actions",
            roles: [ROLE_OWNER, ROLE_MODERATOR, ROLE_MEMBER],
            remove: true,
            block: true,
        });
    });

    test("offers an admin roles up to admin, never owner", () => {
        const can = permissions(ROLE_ADMIN);
        expect(
            memberMenu(
                ROLE_ADMIN,
                { role: ROLE_MODERATOR, isMe: false },
                actionsOn(ROLE_MODERATOR, can),
            ),
        ).toEqual({
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
        expect(
            memberMenu(
                ROLE_MODERATOR,
                { role: ROLE_MEMBER, isMe: false },
                actionsOn(ROLE_MEMBER, can),
            ),
        ).toEqual({
            kind: "actions",
            roles: [ROLE_MODERATOR],
            remove: true,
            block: true,
        });
    });

    test("offers only removing where your role can't change roles", () => {
        const can = permissions(ROLE_MODERATOR);
        expect(
            memberMenu(
                ROLE_MODERATOR,
                { role: ROLE_MEMBER, isMe: false },
                actionsOn(ROLE_MEMBER, can),
            ),
        ).toEqual({
            kind: "actions",
            roles: [],
            remove: true,
            block: true,
        });
    });

    test("says why when your role can do neither", () => {
        const can = permissions(ROLE_MODERATOR, ROLE_ADMIN, ROLE_ADMIN);
        expect(
            memberMenu(
                ROLE_MODERATOR,
                { role: ROLE_MEMBER, isMe: false },
                actionsOn(ROLE_MEMBER, can),
            ),
        ).toEqual({
            kind: "not_allowed",
        });
    });
});

describe("memberHasMenu", () => {
    // the rows show a ⋯ from this alone, without working out the permissions: it has to agree
    // with the menu that's opened
    test("is the menu's own whether there's a ⋯ at all", () => {
        const roles: MemberRole[] = [
            ROLE_NONE,
            ROLE_MEMBER,
            ROLE_MODERATOR,
            ROLE_ADMIN,
            ROLE_OWNER,
        ];
        for (const mine of roles) {
            const can = permissions(mine);
            for (const theirs of roles) {
                for (const isMe of [false, true]) {
                    const member = { role: theirs, isMe };
                    expect(memberHasMenu(mine, member)).toBe(
                        memberMenu(mine, member, actionsOn(theirs, can, isMe)).kind !== "none",
                    );
                }
            }
        }
    });
});

describe("the Members screen's tabs", () => {
    const noGate: AccessGateConfig = { gate: { kind: "no_gate" }, expiry: undefined };
    const chitGate: AccessGateConfig = {
        gate: { kind: "chit_earned_gate", minEarned: 1000 },
        expiry: undefined,
    };
    const uniquePerson: AccessGateConfig = {
        gate: { kind: "unique_person_gate" },
        expiry: undefined,
    };

    test("a group or community has gates of its own, or a channel its community's", () => {
        expect(hasAccessGates(noGate)).toBe(false);
        expect(hasAccessGates(chitGate)).toBe(true);
        expect(hasAccessGates(noGate, noGate)).toBe(false);
        expect(hasAccessGates(noGate, chitGate)).toBe(true);
        expect(hasAccessGates(chitGate, noGate)).toBe(true);
    });

    test("a lone unique-person gate is no gate: it's suspended, so no one lapses from it", () => {
        expect(hasAccessGates(uniquePerson)).toBe(false);
        expect(hasAccessGates(noGate, uniquePerson)).toBe(false);
        expect(
            hasAccessGates({
                gate: {
                    kind: "composite_gate",
                    operator: "and",
                    gates: [
                        { kind: "unique_person_gate" },
                        { kind: "chit_earned_gate", minEarned: 5 },
                    ],
                },
                expiry: undefined,
            }),
        ).toBe(true);
    });

    test("regular members see no tabs, whatever the gates", () => {
        for (const role of [ROLE_NONE, ROLE_MEMBER] as MemberRole[]) {
            expect(memberTabs(role, true)).toEqual([]);
            expect(memberTabs(role, false)).toEqual([]);
        }
    });

    test("owners, admins and moderators see Lapsed only where there are gates", () => {
        for (const role of [ROLE_MODERATOR, ROLE_ADMIN, ROLE_OWNER] as MemberRole[]) {
            expect(memberTabs(role, true)).toEqual(["members", "lapsed", "blocked"]);
            expect(memberTabs(role, false)).toEqual(["members", "blocked"]);
        }
    });

    test("a lapsed member's ⋯ removes and a blocked user's unblocks, only with Remove / block members", () => {
        const can = { canRemove: true, canUnblock: true };
        const cannot = { canRemove: false, canUnblock: false };
        expect(listedUserMenu("lapsed", can)).toEqual({ kind: "action", action: "remove" });
        expect(listedUserMenu("blocked", can)).toEqual({ kind: "action", action: "unblock" });
        expect(listedUserMenu("lapsed", cannot)).toEqual({ kind: "not_allowed" });
        expect(listedUserMenu("blocked", cannot)).toEqual({ kind: "not_allowed" });
        // unblocking is for a public chat's (canUnblockUsers), which removing isn't
        expect(listedUserMenu("blocked", { canRemove: true, canUnblock: false })).toEqual({
            kind: "not_allowed",
        });
        expect(listedUserMenu("lapsed", { canRemove: true, canUnblock: false })).toEqual({
            kind: "action",
            action: "remove",
        });
    });
});

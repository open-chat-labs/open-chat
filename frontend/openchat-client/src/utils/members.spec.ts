import { ROLE_ADMIN, ROLE_MEMBER, ROLE_MODERATOR, ROLE_OWNER } from "@shared";
import { describe, expect, test } from "vitest";
import {
    memberActions,
    memberRoleChoices,
    roleChangeFailureMessage,
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
        const allowed = new Set([`${ROLE_MEMBER}>${ROLE_ADMIN}`, `${ROLE_MEMBER}>${ROLE_OWNER}`]);
        const can: MemberPermissions = {
            promote: (from, to) => allowed.has(`${from}>${to}`),
            demote: (from, to) =>
                allowed.has(`${from}<${to}`) || (from === ROLE_ADMIN && to === ROLE_MEMBER),
            remove: true,
            block: true,
        };
        expect(memberRoleChoices(memberActions(ROLE_MEMBER, false, can))).toEqual([
            ROLE_OWNER,
            ROLE_ADMIN,
        ]);
        expect(memberActions(ROLE_MEMBER, false, can)).toMatchObject({
            canRemoveMember: true,
            canBlockUser: true,
        });

        const me = memberActions(ROLE_MEMBER, true, can);
        expect(memberRoleChoices(me)).toEqual([]);
        expect(me).toMatchObject({ canRemoveMember: false, canBlockUser: false });
        // stepping down is still offered on your own row
        expect(memberRoleChoices(memberActions(ROLE_ADMIN, true, can))).toEqual([ROLE_MEMBER]);
    });
});

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

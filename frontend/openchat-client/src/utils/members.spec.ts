import { ROLE_ADMIN, ROLE_MEMBER, ROLE_MODERATOR, ROLE_OWNER } from "@shared";
import { describe, expect, test } from "vitest";
import { roleChangeFailureMessage } from "./members";

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

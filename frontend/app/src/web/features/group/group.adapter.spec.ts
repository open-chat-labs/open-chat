import { ROLE_ADMIN, ROLE_MEMBER, ROLE_OWNER, type FullMember, type MemberActions } from "@client";
import { describe, expect, test } from "vitest";
import { memberPerson, panelHeader } from "./group.adapter";

const noActions: MemberActions = {
    canPromoteToOwner: false,
    canPromoteToAdmin: false,
    canDemoteToAdmin: false,
    canPromoteToModerator: false,
    canDemoteToModerator: false,
    canDemoteToMember: false,
    canRemoveMember: false,
    canBlockUser: false,
};

describe("the group panel adapter", () => {
    // 4a invariant 5: member counts come from the summary's memberCount, not the members held
    test("the member count is the summary's", () => {
        const header = panelHeader({
            name: "Big group",
            about: "",
            avatarUrl: undefined,
            isPublic: true,
            memberCount: 12_345,
            viewerRole: ROLE_MEMBER,
        });
        expect(header.memberTotal).toBe(12_345);
    });

    // 4a invariant 2: a member's row offers the roles memberActions allows, and nothing more
    test("a member's row carries exactly the actions it was given", () => {
        const member = { userId: "u", username: "alice", role: ROLE_MEMBER } as FullMember;
        const person = memberPerson(member, "me", {
            ...noActions,
            canPromoteToAdmin: true,
            canPromoteToOwner: true,
            canRemoveMember: true,
        });
        expect(person.actions).toEqual({ roles: ["OWNER", "ADMIN"], remove: true, block: false });
        expect(memberPerson(member, "me", noActions).actions).toEqual({
            roles: [],
            remove: false,
            block: false,
        });
        expect(
            memberPerson({ ...member, role: ROLE_OWNER } as FullMember, "me", noActions).tag,
        ).toBe("OWNER");
        expect(
            memberPerson(
                { ...member, role: ROLE_ADMIN, userId: "me" } as FullMember,
                "me",
                noActions,
            ).tag,
        ).toBe("YOU");
    });
});

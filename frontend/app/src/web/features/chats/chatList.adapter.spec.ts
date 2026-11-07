import { communityHeaderMenu } from "./chatList.adapter";

describe("a community's header menu", () => {
    const ids = (can: { canCreateChannel: boolean; canManageUserGroups: boolean }) =>
        communityHeaderMenu({
            canLeave: true,
            canDelete: false,
            canEdit: true,
            canInvite: true,
            ...can,
            label: (key) => key,
        }).map((item) => item.id);

    // 4b invariant 7: New user group only for someone who may manage user groups
    test("offers New user group only to someone who may manage them", () => {
        expect(ids({ canCreateChannel: true, canManageUserGroups: false })).not.toContain(
            "newUserGroup",
        );
        expect(ids({ canCreateChannel: true, canManageUserGroups: true })).toContain(
            "newUserGroup",
        );
    });

    // 4b invariant 7: New channel and Add embedded channel only for someone who can create one
    test("offers the new channel items only to someone who can create a channel", () => {
        const without = ids({ canCreateChannel: false, canManageUserGroups: true });
        expect(without).not.toContain("newChannel");
        expect(without).not.toContain("embedChannel");
        expect(ids({ canCreateChannel: true, canManageUserGroups: true })).toEqual(
            expect.arrayContaining(["newChannel", "embedChannel"]),
        );
    });
});

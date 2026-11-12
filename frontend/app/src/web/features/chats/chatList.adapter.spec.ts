import { buildUserAvatarUrl, ownUserAvatarUrl, type BotMatch, type UserSummary } from "@client";
import { botAvatarUrl } from "@src/logic/chats/chatSearch";
import { communityHeaderMenu, foundRows } from "./chatList.adapter";

describe("the search's rows for what isn't in the list", () => {
    const user = { userId: "u1", username: "lucy", displayName: "Lucy" } as UserSummary;
    const bot = { id: "b1", name: "Helper", definition: { description: "Helps" } } as BotMatch;
    const rows = foundRows({
        found: { users: [user], bots: [bot] },
        userName: (u) => u.displayName ?? u.username,
        userSuspended: (u) => u.suspended,
        userAvatar: (u) => `user:${u.userId}`,
        botAvatar: (b) => `bot:${b.id}`,
    });

    test("are people, then bots, in no section of the list's (they're the panel's People)", () => {
        expect(rows.map(({ row }) => [row.title, row.preview, row.section, row.avatarUrl])).toEqual(
            [
                ["Lucy", "@lucy", undefined, "user:u1"],
                ["Helper", "Helps", undefined, "bot:b1"],
            ],
        );
    });

    test("have ids no chat has, and no menu", () => {
        expect(rows.map(({ row }) => row.id)).toEqual(["found:user:u1", "found:bot:b1"]);
        expect(rows.every(({ row }) => row.menu?.length === 0)).toBe(true);
    });

    test("have their own pictures, else none (the swatch), but a bot the bot picture", () => {
        const pattern = "https://{canisterId}.raw.icp0.io/{blobType}/{blobId}";
        const person = (userId: string, avatarId?: bigint) =>
            ({
                userId,
                username: userId,
                blobUrl: buildUserAvatarUrl(pattern, userId, avatarId),
            }) as UserSummary;
        const avatars = (found: Parameters<typeof foundRows>[0]["found"]) =>
            foundRows({
                found,
                userName: (u) => u.username,
                userSuspended: () => false,
                // as the chat list has them (ChatsScreen)
                userAvatar: ownUserAvatarUrl,
                botAvatar: botAvatarUrl,
            }).map(({ row }) => row.avatarUrl);

        expect(
            avatars({
                users: [person("lucy", 3n), person("tom")],
                bots: [bot, { ...bot, id: "b2", avatarUrl: "b2.png" }],
            }),
        ).toEqual([
            buildUserAvatarUrl(pattern, "lucy", 3n),
            undefined,
            "/assets/bot_avatar.svg",
            "b2.png",
        ]);
    });

    test("mark a suspended person as a DM's row is, as they are now; others and bots aren't", () => {
        // u2 was suspended when found and has been un-suspended since; u1 the other way round
        const now = new Map([
            ["u1", true],
            ["u2", false],
        ]);
        const found = foundRows({
            found: { users: [user, { ...user, userId: "u2", suspended: true }], bots: [bot] },
            userName: (u) => u.username,
            userSuspended: (u) => now.get(u.userId) ?? u.suspended,
            userAvatar: () => undefined,
            botAvatar: () => "",
        });
        expect(found.map(({ row }) => row.suspended ?? false)).toEqual([true, false, false]);
    });

    test("start a chat with the person or bot", () => {
        expect(rows.map(({ target }) => target)).toEqual([
            { kind: "chat_with", userId: "u1" },
            { kind: "chat_with", userId: "b1" },
        ]);
    });
});

describe("a community's header menu", () => {
    const ids = (
        can: { canCreateChannel: boolean; canManageUserGroups: boolean },
        moderation?: { frozen: boolean },
    ) =>
        communityHeaderMenu({
            canLeave: true,
            canDelete: false,
            canEdit: true,
            canInvite: true,
            ...can,
            moderation,
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

    // the old desktop community menu: Freeze or Unfreeze community for platform moderators only,
    // as the community is now
    test("offers a platform moderator Freeze or Unfreeze community, last", () => {
        const can = { canCreateChannel: false, canManageUserGroups: false };
        expect(ids(can).some((id) => id.includes("reeze"))).toBe(false);
        expect(ids(can, { frozen: false }).at(-1)).toBe("freezeCommunity");
        expect(ids(can, { frozen: true }).at(-1)).toBe("unfreezeCommunity");
    });
});

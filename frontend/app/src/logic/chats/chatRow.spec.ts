import {
    buildUserAvatarUrl,
    MessageContextMap,
    type ChannelIdentifier,
    type ChatSummary,
    type CommunitySummary,
    type NervousSystemDetails,
    type TypersByKey,
    type UserLookup,
    type UserSummary,
} from "@client";
import {
    chatAvatarUrl,
    chatRow,
    groupAvatarLookups,
    listed,
    liveRow,
    rowContext,
    swatchFor,
    type RowContext,
    type RowContextInputs,
} from "./chatRow";

const membership = { notificationsMuted: false, archived: false, joined: 0n };

function dm(userId: string, latest?: { sender: string; text: string; at: bigint }): ChatSummary {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: { kind: "direct_chat", userId },
        dateCreated: 1n,
        eventsTtlLastUpdated: 0n,
        membership,
        latestMessage: latest && {
            timestamp: latest.at,
            event: { sender: latest.sender, content: { kind: "text_content", text: latest.text } },
        },
    } as unknown as ChatSummary;
}

function group(
    groupId: string,
    name: string,
    latest?: { sender: string; text: string },
): ChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        name,
        eventsTtlLastUpdated: 0n,
        membership,
        latestMessage: latest && {
            timestamp: 5n,
            event: { sender: latest.sender, content: { kind: "text_content", text: latest.text } },
        },
    } as unknown as ChatSummary;
}

const ctx: RowContext = {
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    // the preview line itself is latestMessagePreview's (app/src/logic/chats)
    preview: (chat) =>
        (chat.latestMessage?.event.content as { text: string } | undefined)?.text ?? "",
    date: (timestamp) => `t${timestamp}`,
    unread: () => 0,
    mentions: () => 0,
    readOnly: () => false,
    avatar: (chat) => `avatar:${chat.kind}`,
    pinned: new Set<string>(),
};

describe("a chat list row", () => {
    test("for a DM is the other user, with their latest message as it is", () => {
        expect(chatRow(dm("alice", { sender: "alice", text: "hi", at: 7n }), ctx)).toMatchObject({
            id: "alice",
            title: "Alice",
            preview: "hi",
            time: "t7",
            kind: "user",
        });
    });

    test("for a group is its name and kind", () => {
        expect(chatRow(group("g1", "Hikers"), ctx)).toMatchObject({
            title: "Hikers",
            kind: "group",
        });
    });

    test("is locked for a private group, not a public one or a direct chat", () => {
        const g = group("g1", "Hikers");
        expect(chatRow({ ...g, public: false } as ChatSummary, ctx).locked).toBe(true);
        expect(chatRow({ ...g, public: true } as ChatSummary, ctx).locked).toBe(false);
        expect(chatRow(dm("bob"), ctx).locked).toBe(false);
    });

    test("is pinned (in the Pinned section), selected and unread as the context says", () => {
        const row = chatRow(dm("bob"), {
            ...ctx,
            pinned: new Set(["bob"]),
            selected: "bob",
            unread: () => 3,
        });
        expect(row).toMatchObject({
            pinned: true,
            section: "Pinned",
            selected: true,
            unreadCount: 3,
        });
        expect(chatRow(dm("alice"), ctx)).toMatchObject({
            pinned: false,
            section: "Chats",
            selected: false,
        });
    });

    test("marks a forwarded latest message, unless it was deleted or has expired", () => {
        const forwarded = (deleted: boolean, expiresAt?: number): ChatSummary => {
            const chat = dm("alice", { sender: "alice", text: "hi", at: 7n });
            const latest = chat.latestMessage!;
            return {
                ...chat,
                latestMessage: {
                    ...latest,
                    expiresAt,
                    event: {
                        ...latest.event,
                        forwarded: true,
                        content: deleted
                            ? { kind: "deleted_content", deletedBy: "alice", timestamp: 8n }
                            : latest.event.content,
                    },
                },
            };
        };
        expect(chatRow(forwarded(false), ctx).previewIcon).toBe("forward");
        expect(chatRow(dm("alice", { sender: "alice", text: "hi", at: 7n }), ctx).previewIcon).toBe(
            undefined,
        );
        expect(chatRow(forwarded(true), ctx).previewIcon).toBe(undefined);
        expect(chatRow(forwarded(false, 5), ctx, 10).previewIcon).toBe(undefined);
    });

    test("shows a call going on and muted notifications", () => {
        const live = {
            ...dm("bob"),
            videoCallInProgress: { messageIndex: 1 },
        } as unknown as ChatSummary;
        expect(chatRow(live, ctx).liveCall).toBe("video");
        const muted = {
            ...dm("bob"),
            membership: { ...membership, notificationsMuted: true },
        } as ChatSummary;
        expect(chatRow(muted, ctx).muted).toBe(true);
        expect(chatRow(dm("bob"), ctx)).toMatchObject({ liveCall: "", muted: false });
    });

    test("has the avatar the context gives the chat", () => {
        expect(chatRow(dm("alice"), ctx).avatarUrl).toBe("avatar:direct_chat");
        expect(chatRow(group("g1", "Hikers"), ctx).avatarUrl).toBe("avatar:group_chat");
    });

    test("has the unread mentions the context counts", () => {
        expect(chatRow(group("g1", "Hikers"), { ...ctx, mentions: () => 2 }).mentions).toBe(2);
    });

    test("has no avatar or mentions when the list doesn't ask for them", () => {
        const without: RowContext = { ...ctx, avatar: undefined, mentions: undefined };
        expect(chatRow(group("g1", "Hikers"), { ...without, unread: () => 3 })).toMatchObject({
            avatarUrl: undefined,
            mentions: 0,
            unreadCount: 3,
        });
    });

    test("gets the same swatch for the same chat, from the design's", () => {
        expect(swatchFor("alice")).toBe(swatchFor("alice"));
        expect(["violet", "blue", "teal", "amber", "plum"]).toContain(swatchFor("bob"));
    });
});

describe("a chat whose latest message has disappeared", () => {
    const expiring = (expiresAt: number) => {
        const chat = dm("alice", { sender: "alice", text: "secret", at: 7n });
        return { ...chat, latestMessage: { ...chat.latestMessage!, expiresAt } } as ChatSummary;
    };
    const unread = { ...ctx, unread: () => 3, mentions: () => 1 };

    // L1 invariant 2: a row's unread and mention counts are 0 once its latest message has expired
    test("shows no unread count once it has gone", () => {
        expect(chatRow(expiring(1_000), unread, 2_000).unreadCount).toBe(0);
        expect(chatRow(expiring(3_000), unread, 2_000).unreadCount).toBe(3);
    });

    test("shows no unread mentions once it has gone", () => {
        expect(chatRow(expiring(1_000), unread, 2_000).mentions).toBe(0);
        expect(chatRow(expiring(3_000), unread, 2_000).mentions).toBe(1);
    });
});

describe("a chat the user can't read into", () => {
    // L1 invariant 5: a read-only chat's row shows no unread or mention count
    test("shows no unread count or mentions", () => {
        const readOnly = { ...ctx, unread: () => 3, mentions: () => 1, readOnly: () => true };
        expect(chatRow(group("g1", "Hikers"), readOnly)).toMatchObject({
            unreadCount: 0,
            mentions: 0,
        });
    });
});

describe("a row's live state", () => {
    const users = new Map([["alice", { userId: "alice", username: "alice" }]]) as never;
    const formatter = (key: string, options?: { values?: Record<string, unknown> }) =>
        `${key}:${JSON.stringify(options?.values ?? {})}`;
    const typing = (chatId: ChatSummary["id"], userIds: string[]): TypersByKey => {
        const typers: TypersByKey = new MessageContextMap();
        typers.set({ chatId }, new Set(userIds));
        return typers;
    };
    const nobody: TypersByKey = new MessageContextMap();

    test("says who's typing in place of the preview: one by name, more by number", () => {
        const g = group("g1", "Hikers");
        const live = (typers: TypersByKey) =>
            liveRow(g, { formatter, users, typers, online: new Set<string>() }).typing;
        expect(live(nobody)).toBeUndefined();
        expect(live(typing(g.id, ["alice"]))).toBe('memberIsTyping:{"username":"alice"}');
        expect(live(typing(g.id, ["alice", "bob"]))).toBe('membersAreTyping:{"number":2}');
    });

    test("shows a DM's other user online; a group never", () => {
        const online = new Set(["alice"]);
        const inputs = { formatter, users, typers: nobody, online };
        expect(liveRow(dm("alice"), inputs).online).toBe(true);
        expect(liveRow(dm("bob"), inputs).online).toBe(false);
        expect(liveRow(group("alice", "Alice's group"), inputs).online).toBe(false);
    });
});

describe("whether a chat is in the list", () => {
    const archived = {
        ...group("g1", "Archive"),
        membership: { ...membership, archived: true },
    } as ChatSummary;
    const users = new Map([
        ["alice", { userId: "alice", username: "alice_w", displayName: "Wanda" }],
    ]) as never;
    const withDescription = { ...group("g2", "Open"), description: "weekend walks" } as ChatSummary;

    test("leaves archived chats out until there's a search", () => {
        expect(listed(withDescription, "", users)).toBe(true);
        expect(listed(archived, "  ", users)).toBe(false);
        expect(listed({ ...archived, description: "" } as ChatSummary, "arch", users)).toBe(true);
    });

    /** Invariant: the new list searches as the old one does (chatMatchesSearch). */
    test("searching, matches a group's description and a DM's username or display name", () => {
        expect(listed(withDescription, " WALKS ", users)).toBe(true);
        expect(listed(dm("alice"), "alice_", users)).toBe(true);
        expect(listed(dm("alice"), "wan", users)).toBe(true);
        expect(listed(withDescription, "closed", users)).toBe(false);
    });
});

describe("a chat's own picture", () => {
    const pattern = "https://{canisterId}.raw.icp0.io/{blobType}/{blobId}";
    const user = (userId: string, avatarId?: bigint) =>
        ({
            kind: "user",
            userId,
            // as the client loads a user: their avatar, else a generated identicon
            blobUrl: buildUserAvatarUrl(pattern, userId, avatarId),
        }) as UserSummary;
    // as the client loads a bot with no avatar of its own
    const helper = { kind: "bot", userId: "helper", blobUrl: "/assets/bot_avatar.svg" };
    const users = new Map([
        ["alice", user("alice", 7n)],
        ["bob", user("bob")],
        ["helper", helper as UserSummary],
    ]) as unknown as UserLookup;

    const community = (communityId: string, blobUrl?: string) =>
        ({ id: { kind: "community", communityId }, avatar: { blobUrl } }) as CommunitySummary;
    const channel = (communityId: string, channelId: number, blobUrl?: string) =>
        ({
            kind: "channel",
            id: { kind: "channel", communityId, channelId },
            blobUrl,
        }) as unknown as ChatSummary;
    const groupWith = (blobUrl?: string, governanceCanisterId?: string) =>
        ({
            kind: "group_chat",
            id: { kind: "group_chat", groupId: "g1" },
            blobUrl,
            subtype: governanceCanisterId && { kind: "governance_proposals", governanceCanisterId },
        }) as unknown as ChatSummary;

    // the client knows c1's community (with an avatar) and c2's (without one)
    const communities = new Map([
        ["c1", community("c1", "c1.png")],
        ["c2", community("c2")],
    ]);
    const client = {
        tryGetNervousSystem: (id: string | undefined) =>
            id === "sns1" ? ({ token: { logo: "sns1.png" } } as NervousSystemDetails) : undefined,
        getCommunityForChannel: (id: ChannelIdentifier) => communities.get(id.communityId),
    };
    const groups = groupAvatarLookups(client, community("scope", "scope.png"));

    test("for a DM is the user's avatar, none for a user without one or not loaded", () => {
        expect(chatAvatarUrl(dm("alice"), users, groups)).toBe(users.get("alice")!.blobUrl);
        expect(chatAvatarUrl(dm("alice"), users, groups)).toMatch(/^https:/);
        // the client's identicon isn't the user's own picture
        expect(chatAvatarUrl(dm("bob"), users, groups)).toBeUndefined();
        expect(chatAvatarUrl(dm("carol"), users, groups)).toBeUndefined();
    });

    test("for a DM with a bot is the bot's picture", () => {
        expect(chatAvatarUrl(dm("helper"), users, groups)).toBe("/assets/bot_avatar.svg");
    });

    test("for a group is its avatar, else none", () => {
        expect(chatAvatarUrl(groupWith("g1.png"), users, groups)).toBe("g1.png");
        expect(chatAvatarUrl(groupWith(), users, groups)).toBeUndefined();
    });

    test("for a proposals chat is its avatar, else its SNS's logo, else none", () => {
        expect(chatAvatarUrl(groupWith("g1.png", "sns1"), users, groups)).toBe("g1.png");
        expect(chatAvatarUrl(groupWith(undefined, "sns1"), users, groups)).toBe("sns1.png");
        expect(chatAvatarUrl(groupWith(undefined, "sns2"), users, groups)).toBeUndefined();
    });

    test("for a channel is its avatar, else its community's, else none", () => {
        expect(chatAvatarUrl(channel("c1", 1, "ch.png"), users, groups)).toBe("ch.png");
        expect(chatAvatarUrl(channel("c1", 1), users, groups)).toBe("c1.png");
        // a community with no avatar gives none, not its identicon
        expect(chatAvatarUrl(channel("c2", 1), users, groups)).toBeUndefined();
    });

    test("for a channel whose community the client doesn't know is the list's community's", () => {
        expect(chatAvatarUrl(channel("c3", 1), users, groups)).toBe("scope.png");
        expect(chatAvatarUrl(channel("c3", 1), users, groupAvatarLookups(client))).toBeUndefined();
    });
});

describe("a list's row context", () => {
    const client: Parameters<typeof rowContext>[0] = {
        displayName: () => "",
        getContentAsText: () => "",
        formatMessageDate: () => "",
        unreadMessageCount: () => 0,
        isMessageRead: () => false,
        isChatReadOnly: () => false,
        tryGetNervousSystem: () => undefined,
        getCommunityForChannel: () => undefined,
    };
    const inputs: RowContextInputs = {
        formatter: (key) => key,
        me: "me",
        users: new Map<string, UserSummary>(),
        translations: new Map<bigint, string>(),
        bridgedUsers: { get: () => undefined },
        pinned: [],
    };

    test("leaves the mentions and pictures out unless the list asks for them", () => {
        const ctx = rowContext(client, inputs);
        expect(ctx.mentions).toBeUndefined();
        expect(ctx.avatar).toBeUndefined();
    });

    test("counts the mentions and looks the pictures up for a list that asks", () => {
        const ctx = rowContext(client, { ...inputs, withMentionsAndAvatars: true });
        expect(ctx.mentions).toBeTypeOf("function");
        expect(ctx.avatar).toBeTypeOf("function");
    });
});

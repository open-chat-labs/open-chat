import {
    CommunityMap,
    defaultChatPermissions,
    defaultChatRules,
    emptyChatMetrics,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type AccessGate,
    type BridgedUserId,
    type BridgedUserSummary,
    type CandidateGroupChat,
    type ChannelSummary,
    type ChatEvent,
    type ChatIdentifier,
    type CommunitySummary,
    type EventWrapper,
    type GroupChatSummary,
    type Message,
    type MultiUserChatIdentifier,
    type PollConfig,
    type PollContent,
    type PollVotes,
    type UserLookup,
    type UserSummary,
} from "@shared";
import { localUpdates } from "../state";
import { currentChatVisit, startChatVisit } from "../state/selectedChat";
import {
    addVoteToPoll,
    buildBridgedUserAvatarUrl,
    buildIdenticonUrl,
    disappearingMessagesUpdate,
    eventsTTLUpdate,
    getMembersString,
    groupChatFromCandidate,
    isPreviewingOrLapsed,
    mergeChatMetrics,
    mergeUnconfirmedThreadsIntoSummary,
    navigationAfterArchivingOpenChat,
    sameUser,
    sortByTimestampThenEventIndex,
    startTyping,
    stopTyping,
    userCanDeleteMessage,
} from "./chat";
import { rtcConnectionsManager } from "./rtcConnectionsManager";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const defaultGroupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "whatever",
    description: "whatever",
    id: { kind: "group_chat", groupId: "abc" },
    lastUpdated: BigInt(0),
    latestMessage: undefined,
    public: true,
    historyVisible: false,
    minVisibleEventIndex: 0,
    minVisibleMessageIndex: 0,
    latestEventIndex: 0,
    latestMessageIndex: undefined,
    memberCount: 10,
    permissions: {
        changeRoles: ROLE_ADMIN,
        removeMembers: ROLE_MODERATOR,
        deleteMessages: ROLE_MODERATOR,
        updateGroup: ROLE_ADMIN,
        pinMessages: ROLE_ADMIN,
        inviteUsers: ROLE_ADMIN,
        addMembers: ROLE_ADMIN,
        reactToMessages: ROLE_MEMBER,
        tipMessages: ROLE_MEMBER,
        mentionAllMembers: ROLE_MEMBER,
        startVideoCall: ROLE_ADMIN,
        messagePermissions: {
            default: ROLE_MEMBER,
        },
        threadPermissions: undefined,
    },
    metrics: emptyChatMetrics(),
    subtype: undefined,
    previewed: false,
    frozen: false,
    dateLastPinned: undefined,
    dateReadPinned: undefined,
    gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
    level: "group",
    eventsTTL: undefined,
    eventsTtlLastUpdated: BigInt(0),
    membership: {
        lapsed: false,
        archived: false,
        mentions: [],
        notificationsMuted: false,
        atEveryoneMuted: false,
        role: ROLE_ADMIN,
        readByMeUpTo: undefined,
        joined: BigInt(0),
        myMetrics: emptyChatMetrics(),
        rulesAccepted: false,
        latestThreads: [
            {
                threadRootMessageIndex: 1,
                lastUpdated: BigInt(0),
                latestEventIndex: 3,
                latestMessageIndex: 3,
            },
        ],
    },
    localUserIndex: "",
    isInvited: false,
    messagesVisibleToNonMembers: false,
    verified: false,
};

function createUser(userId: string, username: string): UserSummary {
    return {
        kind: "user",
        userId,
        username,
        displayName: undefined,
        updated: BigInt(0),
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        totalChitEarned: 0,
        hideOnlineStatus: false,
    };
}

describe("thread utils", () => {
    test("merge unconfirmed thread message into summary", () => {
        localUpdates.clearAll();
        localUpdates.addUnconfirmed(
            { chatId: { kind: "group_chat", groupId: "abc" }, threadRootMessageIndex: 1 },
            {
                index: 4,
                timestamp: BigInt(0),
                event: {
                    kind: "message",
                    messageId: BigInt(0),
                    messageIndex: 5,
                    sender: "",
                    content: { kind: "placeholder_content" },
                    reactions: [],
                    tips: {},
                    edited: false,
                    forwarded: false,
                    deleted: false,
                    blockLevelMarkdown: false,
                    ogPreviews: [],
                    messagePreviews: [],
                },
            },
        );
        const chat = { ...defaultGroupChat };
        mergeUnconfirmedThreadsIntoSummary(chat);
        expect(chat.membership.latestThreads[0].latestEventIndex).toEqual(4);
        expect(chat.membership.latestThreads[0].latestMessageIndex).toEqual(5);
    });
});

describe("merging metrics", () => {
    test("merging with empty leaves unchanged", () => {
        const metrics = {
            ...emptyChatMetrics(),
            audioMessages: 10,
            edits: 30,
            cryptoMessages: 40,
        };
        expect(mergeChatMetrics(metrics, emptyChatMetrics())).toMatchObject(metrics);
    });
    test("merging non-empty adds values", () => {
        const metrics = {
            ...emptyChatMetrics(),
            audioMessages: 10,
            edits: 30,
            cryptoMessages: 40,
        };
        expect(mergeChatMetrics(metrics, metrics)).toMatchObject({
            audioMessages: 20,
            edits: 60,
            cryptoMessages: 80,
        });
    });
});

describe("updating poll votes", () => {
    const config: PollConfig = {
        allowMultipleVotesPerUser: true,
        allowUserToChangeVote: true,
        text: "Who's the best",
        showVotesBeforeEndDate: true,
        endDate: BigInt(Date.now() + 1000 * 60 * 60 * 24),
        anonymous: false,
        options: ["me", "you", "neither"],
    };

    const singleVote: PollConfig = {
        ...config,
        allowMultipleVotesPerUser: false,
    };

    const anonVotes: PollVotes = {
        total: { kind: "anonymous_poll_votes", votes: { 0: 1, 1: 0, 2: 10 } },
        user: [0],
    };

    const anonVotesNoPrev: PollVotes = {
        ...anonVotes,
        user: [],
    };

    const visibleVotes: PollVotes = {
        total: { kind: "visible_poll_votes", votes: { 0: ["abcdef"], 1: [] } },
        user: [0],
    };

    const visibleVotesNoPrev: PollVotes = {
        total: { kind: "visible_poll_votes", votes: { 0: ["123456"], 1: [] } },
        user: [],
    };

    const hiddenVotes: PollVotes = {
        total: { kind: "hidden_poll_votes", votes: 3 },
        user: [0],
    };

    const hiddenVotesNoPrev: PollVotes = {
        ...hiddenVotes,
        user: [],
    };

    const poll: PollContent = { kind: "poll_content", votes: anonVotes, config, ended: false };

    function clonePoll(poll: PollContent): PollContent {
        return JSON.parse(JSON.stringify(poll));
    }

    describe("adding a vote", () => {
        describe("when multiple votes are allowed", () => {
            test("when I have already voted", () => {
                const updated = addVoteToPoll("abcdef", 0, clonePoll(poll));
                expect(updated).toEqual(anonVotes);
            });
            test("when votes are anonymous", () => {
                const updated = addVoteToPoll("abcdef", 1, clonePoll(poll));
                expect(updated.user).toEqual([0, 1]);
                expect(updated.total.votes).toEqual({ 0: 1, 1: 1, 2: 10 });
            });
            test("when votes are hidden", () => {
                const updated = addVoteToPoll(
                    "abcdef",
                    1,
                    clonePoll({ ...poll, votes: hiddenVotes }),
                );
                expect(updated.user).toEqual([0, 1]);
                expect(updated.total.votes).toEqual(4);
            });
            test("when votes are visible", () => {
                const updated = addVoteToPoll(
                    "abcdef",
                    1,
                    clonePoll({ ...poll, votes: visibleVotes }),
                );
                expect(updated.user).toEqual([0, 1]);
                expect(updated.total.votes).toEqual({ 0: ["abcdef"], 1: ["abcdef"] });
            });
        });
        describe("when only one vote is allowed", () => {
            describe("when user has previously voted", () => {
                test("when I have already voted", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        0,
                        clonePoll({ ...poll, config: singleVote }),
                    );
                    expect(updated).toEqual(anonVotes);
                });
                test("when votes are anonymous", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        1,
                        clonePoll({ ...poll, config: singleVote }),
                    );
                    expect(updated.user).toEqual([1]);
                    expect(updated.total.votes).toEqual({ 0: 0, 1: 1, 2: 10 });
                });
                test("when votes are hidden", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        1,
                        clonePoll({
                            ...poll,
                            config: singleVote,
                            votes: hiddenVotes,
                        }),
                    );
                    expect(updated.user).toEqual([1]);
                    expect(updated.total.votes).toEqual(3);
                });
                test("when votes are visible", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        1,
                        clonePoll({
                            ...poll,
                            config: singleVote,
                            votes: visibleVotes,
                        }),
                    );
                    expect(updated.user).toEqual([1]);
                    expect(updated.total.votes).toEqual({ 0: [], 1: ["abcdef"] });
                });
            });

            describe("when user has not previously voted", () => {
                test("when votes are anonymous", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        1,
                        clonePoll({
                            ...poll,
                            votes: anonVotesNoPrev,
                            config: singleVote,
                        }),
                    );
                    expect(updated.user).toEqual([1]);
                    expect(updated.total.votes).toEqual({ 0: 1, 1: 1, 2: 10 });
                });
                test("when votes are hidden", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        1,
                        clonePoll({
                            ...poll,
                            config: singleVote,
                            votes: hiddenVotesNoPrev,
                        }),
                    );
                    expect(updated.user).toEqual([1]);
                    expect(updated.total.votes).toEqual(4);
                });
                test("when votes are visible", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        1,
                        clonePoll({
                            ...poll,
                            config: singleVote,
                            votes: visibleVotesNoPrev,
                        }),
                    );
                    expect(updated.user).toEqual([1]);
                    expect(updated.total.votes).toEqual({ 0: ["123456"], 1: ["abcdef"] });
                });
            });
        });
    });
});

describe("get members string for group chat", () => {
    const withFewerThanSix = ["a", "b", "c", "d", "z"];
    const withUnknown = ["a", "b", "x", "d", "z"];
    const withMoreThanSix = ["a", "b", "c", "d", "e", "f", "g", "z"];
    const lookup: UserLookup = new Map([
        ["a", createUser("a", "Mr A")],
        ["b", createUser("b", "Mr B")],
        ["c", createUser("c", "Mr C")],
        ["d", createUser("d", "Mr D")],
        ["e", createUser("e", "Mr E")],
        ["f", createUser("f", "Mr F")],
        ["g", createUser("g", "Mr G")],
        ["z", createUser("z", "Mr Z")],
    ]);

    const user = lookup.get("z") as UserSummary;

    test("up to five members get listed", () => {
        const members = getMembersString(
            user.userId,
            lookup,
            withFewerThanSix,
            "Unknown User",
            "You",
        );
        expect(members).toEqual("**Mr A**, **Mr B**, **Mr C**, **Mr D** and **You**");
    });
    test("with unknown users", () => {
        const members = getMembersString(user.userId, lookup, withUnknown, "Unknown User", "You");
        expect(members).toEqual("**Mr A**, **Mr B**, **Mr D**, **You** and **Unknown User**");
    });
    test("with more than 5 members", () => {
        const members = getMembersString(
            user.userId,
            lookup,
            withMoreThanSix,
            "Unknown User",
            "You",
        );
        expect(members).toEqual("8 members");
    });
});

describe("sortByTimestampThenEventIndex", () => {
    const ev = (index: number, timestamp: bigint | number) =>
        ({ index, timestamp, event: { kind: "empty" } }) as unknown as EventWrapper<ChatEvent>;

    test("orders by timestamp, then by event index", () => {
        expect([ev(3, 20n), ev(2, 10n), ev(1, 10n)].sort(sortByTimestampThenEventIndex)).toEqual([
            ev(1, 10n),
            ev(2, 10n),
            ev(3, 20n),
        ]);
    });

    // Invariant: the sort never throws. An event carrying a number timestamp (source still
    // unknown) hit `a.timestamp - b.timestamp` and took the whole events store down with
    // "Cannot mix BigInt and other types" (Rollbar #31919).
    test("tolerates a number timestamp among bigints", () => {
        expect([ev(2, 20n), ev(1, 10), ev(3, 30n)].sort(sortByTimestampThenEventIndex)).toEqual([
            ev(1, 10),
            ev(2, 20n),
            ev(3, 30n),
        ]);
    });
});

describe("sameUser", () => {
    const message = (sender: string, timestamp: bigint, discordId?: string, telegramId?: string) =>
        ({
            index: 0,
            timestamp,
            event: {
                kind: "message",
                sender,
                senderContext:
                    discordId !== undefined
                        ? {
                              kind: "bot",
                              finalised: true,
                              bridgedFrom: { kind: "discord", id: discordId },
                          }
                        : telegramId !== undefined
                          ? {
                                kind: "bot",
                                finalised: true,
                                bridgedFrom: { kind: "telegram", id: telegramId },
                            }
                          : undefined,
            },
        }) as unknown as EventWrapper<ChatEvent>;

    test("groups messages from the same sender", () => {
        expect(sameUser(message("a", 0n), message("a", 1000n))).toBe(true);
        expect(sameUser(message("a", 0n), message("b", 1000n))).toBe(false);
    });

    // A bridge bot sends every message it relays from another platform
    test("groups a bridge bot's messages by their authors", () => {
        expect(sameUser(message("bot", 0n, "1"), message("bot", 1000n, "1"))).toBe(true);
        expect(sameUser(message("bot", 0n, "1"), message("bot", 1000n, "2"))).toBe(false);
        expect(sameUser(message("bot", 0n), message("bot", 1000n, "1"))).toBe(false);
        expect(
            sameUser(message("bot", 0n, undefined, "1"), message("bot", 1000n, undefined, "1")),
        ).toBe(true);
        // The same id on different platforms is a different author
        expect(sameUser(message("bot", 0n, "1"), message("bot", 1000n, undefined, "1"))).toBe(
            false,
        );
    });
});

/** Invariant: archiving the open chat leaves it, on every tree and screen width. */
describe("where archiving the open chat goes", () => {
    const go = (...args: Parameters<typeof navigationAfterArchivingOpenChat>) =>
        navigationAfterArchivingOpenChat(...args).url;
    const group = (groupId: string, archived = false): GroupChatSummary => ({
        ...defaultGroupChat,
        id: { kind: "group_chat", groupId },
        membership: { ...defaultGroupChat.membership, archived },
    });
    const archived = { kind: "group_chat", groupId: "a" } as const;
    const chats = { kind: "chats" } as const;

    test("is the next unarchived chat on a wide screen, never the archived one", () => {
        // the list may not have marked it archived yet
        expect(go(archived, chats, [group("a"), group("b", true), group("c")], false)).toBe(
            "/chats/group/c",
        );
    });

    test("is the scope's list on a narrow screen, or with no other chat to open", () => {
        expect(go(archived, chats, [group("a"), group("b")], true)).toBe("/chats");
        expect(go(archived, chats, [group("a", true)], false)).toBe("/chats");
    });

    test("replaces the archived chat's history entry when going to another chat, so Back can't reopen and un-archive it", () => {
        expect(
            navigationAfterArchivingOpenChat(archived, chats, [group("a"), group("c")], false)
                .intent,
        ).toBe("auto");
        // going to the list steps back to it, which leaves the archived chat ahead, not behind
        expect(
            navigationAfterArchivingOpenChat(archived, chats, [group("a"), group("c")], true)
                .intent,
        ).toBeUndefined();
    });
});

describe("a new chat's member count", () => {
    const channelId: MultiUserChatIdentifier = { kind: "channel", communityId: "c", channelId: 1 };
    const groupId: MultiUserChatIdentifier = { kind: "group_chat", groupId: "g" };

    function candidate(
        id: MultiUserChatIdentifier,
        isPublic: boolean,
        gate: AccessGate,
    ): CandidateGroupChat {
        const level = id.kind === "channel" ? "channel" : "group";
        return {
            id,
            kind: "candidate_group_chat",
            name: "New",
            description: "",
            rules: { ...defaultChatRules(level), newVersion: false },
            members: [],
            permissions: defaultChatPermissions(),
            gateConfig: { gate, expiry: undefined },
            public: isPublic,
            frozen: false,
            historyVisible: true,
            level,
            membership: { role: ROLE_OWNER, lapsed: false },
            verified: false,
        };
    }

    test("a public channel with no gate starts with all the community's members", () => {
        const chat = groupChatFromCandidate(
            channelId,
            candidate(channelId, true, { kind: "no_gate" }),
            4,
        );
        expect(chat.memberCount).toEqual(4);
        expect(chat.level).toEqual("channel");
    });

    test("a gated or private channel starts with just its creator", () => {
        const gated = candidate(channelId, true, { kind: "diamond_gate" });
        const unlisted = candidate(channelId, false, { kind: "no_gate" });
        expect(groupChatFromCandidate(channelId, gated, 4).memberCount).toEqual(1);
        expect(groupChatFromCandidate(channelId, unlisted, 4).memberCount).toEqual(1);
    });

    test("a group starts with just its creator", () => {
        const group = groupChatFromCandidate(
            groupId,
            candidate(groupId, true, { kind: "no_gate" }),
            undefined,
        );
        expect(group.memberCount).toEqual(1);
        expect(group.level).toEqual("group");
    });

    test("an unknown community's channel starts with just its creator", () => {
        const channel = candidate(channelId, true, { kind: "no_gate" });
        expect(groupChatFromCandidate(channelId, channel, undefined).memberCount).toEqual(1);
    });
});

describe("who typing is sent to", () => {
    const send = vi.spyOn(rtcConnectionsManager, "sendMessage").mockImplementation(() => {});

    beforeEach(() => send.mockClear());
    afterAll(() => {
        startChatVisit(undefined);
        send.mockRestore();
    });

    function recipients(): string[][] {
        return send.mock.calls.map(([userIds]) => userIds);
    }

    test("in a DM, typing and stopping typing go to the other user before they have sent anything", () => {
        const dm: ChatIdentifier = { kind: "direct_chat", userId: "them" };
        startChatVisit(dm);

        startTyping(dm, "me");
        stopTyping(dm, "me");

        expect(recipients()).toEqual([["them"], ["them"]]);
    });

    test("in a group, typing and stopping typing go to the users seen in the loaded events", () => {
        const group: ChatIdentifier = { kind: "group_chat", groupId: "g" };
        startChatVisit(group);
        currentChatVisit()?.addUserIds(["a", "b"]);

        startTyping(group, "me");
        stopTyping(group, "me");

        expect(recipients()).toEqual([
            ["a", "b"],
            ["a", "b"],
        ]);
    });
});

describe("bridged user avatars", () => {
    const avatars = "https://avatars.example.com";
    const telegramId: BridgedUserId = { kind: "telegram", id: "123456789" };
    const telegram = (photoId?: string): BridgedUserSummary => ({
        user: {
            kind: "telegram",
            profile: { id: telegramId.id, displayName: "Nelly Smith", photoId },
        },
        updated: 0n,
    });

    test("a Telegram user with no photo gets a generated avatar", () => {
        const url = buildBridgedUserAvatarUrl(telegramId, telegram(), avatars);
        expect(url).toEqual(buildIdenticonUrl("telegram:123456789"));
        expect(url).not.toEqual(buildIdenticonUrl("123456789"));
    });

    test("a Telegram user's photo is used if they have one", () => {
        expect(
            buildBridgedUserAvatarUrl(telegramId, telegram("AQADtLwxG5a_QEZ-"), avatars),
        ).toEqual("https://avatars.example.com/telegram/123456789/AQADtLwxG5a_QEZ-.jpg");
    });

    test("until the profile loads, it's the unknown user's avatar", () => {
        expect(buildBridgedUserAvatarUrl(telegramId, undefined, avatars)).toEqual(
            "/assets/unknownUserAvatar.svg",
        );
    });

    test("a Twitch user's profile image is used, or a generated avatar without one", () => {
        const twitchId: BridgedUserId = { kind: "twitch", id: "141981764" };
        const twitch = (profileImage?: string): BridgedUserSummary => ({
            user: {
                kind: "twitch",
                profile: { id: twitchId.id, login: "nelly", displayName: "Nelly", profileImage },
            },
            updated: 0n,
        });
        expect(
            buildBridgedUserAvatarUrl(
                twitchId,
                twitch("jtv_user_pictures/abc-profile_image-300x300.png"),
                avatars,
            ),
        ).toEqual("https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png");
        expect(buildBridgedUserAvatarUrl(twitchId, twitch(), avatars)).toEqual(
            buildIdenticonUrl("twitch:141981764"),
        );
    });

    test("a Discord user with no avatar keeps Discord's default", () => {
        const discordId: BridgedUserId = { kind: "discord", id: "80351110224678912" };
        expect(buildBridgedUserAvatarUrl(discordId, undefined, avatars)).toMatch(
            /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/,
        );
    });
});

describe("eventsTTLUpdate", () => {
    // turning disappearing messages off must clear the chat's TTL, and leaving them off sends nothing
    test("sets the new TTL, clears one that was on, and sends nothing when it stays off", () => {
        expect(eventsTTLUpdate(3_600_000n, undefined)).toEqual({ value: 3_600_000n });
        expect(eventsTTLUpdate(undefined, 3_600_000n)).toBe("set_to_none");
        expect(eventsTTLUpdate(undefined, undefined)).toBeUndefined();
    });
});

describe("disappearingMessagesUpdate", () => {
    // a panel's choice is saved as that many milliseconds, and turning off clears the TTL
    test("saves the chosen length in milliseconds, and clears the TTL when turned off", () => {
        expect(disappearingMessagesUpdate(true, 3_600_000, undefined)).toEqual({
            value: 3_600_000n,
        });
        expect(disappearingMessagesUpdate(true, 86_400_000, 3_600_000n)).toEqual({
            value: 86_400_000n,
        });
        expect(disappearingMessagesUpdate(false, 3_600_000, 3_600_000n)).toBe("set_to_none");
    });
});

describe("previewing or lapsed", () => {
    const channel: ChannelSummary = {
        ...defaultGroupChat,
        kind: "channel",
        id: { kind: "channel", communityId: "c", channelId: 1 },
        level: "channel",
        isInvited: false,
        messagesVisibleToNonMembers: false,
    };

    function communities(lapsed: boolean): CommunityMap<CommunitySummary> {
        const community: CommunitySummary = {
            kind: "community",
            id: { kind: "community", communityId: "c" },
            name: "",
            description: "",
            memberCount: 0,
            avatar: {},
            banner: {},
            gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
            public: true,
            permissions: {
                changeRoles: ROLE_ADMIN,
                updateDetails: ROLE_ADMIN,
                inviteUsers: ROLE_ADMIN,
                removeMembers: ROLE_ADMIN,
                createPublicChannel: ROLE_ADMIN,
                createPrivateChannel: ROLE_ADMIN,
                manageUserGroups: ROLE_ADMIN,
            },
            historyVisible: true,
            frozen: false,
            level: "community",
            lastUpdated: BigInt(0),
            latestEventIndex: 0,
            channels: [channel],
            membership: {
                role: ROLE_MEMBER,
                joined: BigInt(0),
                archived: false,
                pinned: [],
                index: 0,
                displayName: undefined,
                rulesAccepted: false,
                lapsed,
            },
            primaryLanguage: "en",
            metrics: emptyChatMetrics(),
            userGroups: new Map(),
            localUserIndex: "",
            isInvited: false,
            verified: false,
            moderationFlags: 0,
        };
        return CommunityMap.fromList([community]);
    }

    test("a member of the chat and its community is neither", () => {
        expect(isPreviewingOrLapsed(defaultGroupChat, new CommunityMap())).toBe(false);
        expect(isPreviewingOrLapsed(channel, communities(false))).toBe(false);
    });

    test("previewing the chat", () => {
        const group: GroupChatSummary = {
            ...defaultGroupChat,
            membership: { ...defaultGroupChat.membership, role: ROLE_NONE },
        };
        expect(isPreviewingOrLapsed(group, new CommunityMap())).toBe(true);
        const previewed: ChannelSummary = {
            ...channel,
            membership: { ...channel.membership, role: ROLE_NONE },
        };
        expect(isPreviewingOrLapsed(previewed, communities(false))).toBe(true);
    });

    test("lapsed from the chat", () => {
        const group = {
            ...defaultGroupChat,
            membership: { ...defaultGroupChat.membership, lapsed: true },
        };
        expect(isPreviewingOrLapsed(group, new CommunityMap())).toBe(true);
        const lapsed = { ...channel, membership: { ...channel.membership, lapsed: true } };
        expect(isPreviewingOrLapsed(lapsed, communities(false))).toBe(true);
    });

    test("lapsed from the channel's community", () => {
        expect(isPreviewingOrLapsed(channel, communities(true))).toBe(true);
    });
});

describe("who can delete a message", () => {
    type Deletable = Pick<Message, "sender" | "senderContext" | "content">;
    const text: Message["content"] = { kind: "text_content", text: "hi" };
    const message = (sender: string): Deletable => ({ sender, content: text });
    const botResponse = (initiator: string): Deletable => ({
        sender: "bot",
        senderContext: {
            kind: "bot",
            finalised: true,
            command: { name: "joke", args: [], initiator },
        },
        content: text,
    });

    test("its sender", () => {
        expect(userCanDeleteMessage(message("me"), true, "me", false)).toBe(true);
        expect(userCanDeleteMessage(message("them"), true, "me", false)).toBe(false);
    });

    test("the user who used the command a bot responded to", () => {
        expect(userCanDeleteMessage(botResponse("me"), true, "me", false)).toBe(true);
        expect(userCanDeleteMessage(botResponse("them"), true, "me", false)).toBe(false);
    });

    test("not the user who used the command while the response is a local placeholder", () => {
        expect(userCanDeleteMessage(botResponse("me"), false, "me", false)).toBe(false);
        // Unchanged for a user's own unconfirmed messages and for those who can delete anyone's
        expect(userCanDeleteMessage(message("me"), false, "me", false)).toBe(true);
        expect(userCanDeleteMessage(botResponse("me"), false, "me", true)).toBe(true);
    });

    test("anyone who can delete other users' messages", () => {
        expect(userCanDeleteMessage(message("them"), true, "me", true)).toBe(true);
        expect(userCanDeleteMessage(botResponse("them"), true, "me", true)).toBe(true);
    });

    test("no one while a call is in progress", () => {
        const call = (ended?: bigint): Deletable => ({
            sender: "me",
            content: { kind: "video_call_content", participants: [], ended, callType: "default" },
        });
        expect(userCanDeleteMessage(call(), true, "me", true)).toBe(false);
        expect(userCanDeleteMessage(call(1n), true, "me", false)).toBe(true);
    });
});

import {
    emptyChatMetrics,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    type ChatEvent,
    type EventWrapper,
    type GroupChatSummary,
    type PollConfig,
    type PollContent,
    type PollVotes,
    type UserLookup,
    type UserSummary,
} from "@shared";
import { localUpdates } from "../state";
import {
    addVoteToPoll,
    getMembersString,
    mergeChatMetrics,
    mergeUnconfirmedThreadsIntoSummary,
    navigationAfterArchivingOpenChat,
    sameUser,
    sortByTimestampThenEventIndex,
} from "./chat";

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

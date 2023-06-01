import {
    GroupChatSummary,
    PollConfig,
    PollVotes,
    PollContent,
    PartialUserSummary,
    UserLookup,
    UserSummary,
    emptyChatMetrics,
} from "openchat-shared";
import {
    addVoteToPoll,
    getMembersString,
    mergeChatMetrics,
    mergeUnconfirmedThreadsIntoSummary,
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
    chatId: "abc",
    lastUpdated: BigInt(0),
    readByMeUpTo: undefined,
    latestMessage: undefined,
    public: true,
    historyVisible: false,
    joined: BigInt(0),
    minVisibleEventIndex: 0,
    minVisibleMessageIndex: 0,
    latestEventIndex: 0,
    notificationsMuted: false,
    memberCount: 10,
    myRole: "admin",
    mentions: [],
    permissions: {
        changePermissions: "admins",
        changeRoles: "admins",
        removeMembers: "moderators",
        blockUsers: "moderators",
        deleteMessages: "moderators",
        updateGroup: "admins",
        pinMessages: "admins",
        inviteUsers: "admins",
        createPolls: "members",
        sendMessages: "members",
        reactToMessages: "members",
        replyInThread: "members",
    },
    metrics: emptyChatMetrics(),
    myMetrics: emptyChatMetrics(),
    latestThreads: [
        {
            threadRootMessageIndex: 1,
            lastUpdated: BigInt(0),
            latestEventIndex: 3,
            latestMessageIndex: 3,
        },
    ],
    subtype: undefined,
    archived: false,
    previewed: false,
    frozen: false,
    dateLastPinned: undefined,
    dateReadPinned: undefined,
    gate: { kind: "no_gate" },
};

function createUser(userId: string, username: string): PartialUserSummary {
    return {
        kind: "user",
        userId,
        username,
        updated: BigInt(0),
        suspended: false,
        diamond: false,
    };
}

describe("thread utils", () => {
    test("merge unconfirmed thread message into summary", () => {
        const chat = mergeUnconfirmedThreadsIntoSummary(defaultGroupChat, {
            abc_1: {
                messages: [
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
                            edited: false,
                            forwarded: false,
                            deleted: false,
                        },
                    },
                ],
                messageIds: new Set(),
            },
        });
        expect(chat.latestThreads[0].latestEventIndex).toEqual(4);
        expect(chat.latestThreads[0].latestMessageIndex).toEqual(5);
    });
});

describe("merging metrics", () => {
    test("merging with empty leaves unchanged", () => {
        const metrics = {
            ...emptyChatMetrics(),
            audioMessages: 10,
            cyclesMessages: 20,
            edits: 30,
            icpMessages: 40,
        };
        expect(mergeChatMetrics(metrics, emptyChatMetrics())).toMatchObject(metrics);
    });
    test("merging non-empty adds values", () => {
        const metrics = {
            ...emptyChatMetrics(),
            audioMessages: 10,
            cyclesMessages: 20,
            edits: 30,
            icpMessages: 40,
        };
        expect(mergeChatMetrics(metrics, metrics)).toMatchObject({
            audioMessages: 20,
            cyclesMessages: 40,
            edits: 60,
            icpMessages: 80,
        });
    });
});

describe("updating poll votes", () => {
    const config: PollConfig = {
        allowMultipleVotesPerUser: true,
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
                    clonePoll({ ...poll, votes: hiddenVotes })
                );
                expect(updated.user).toEqual([0, 1]);
                expect(updated.total.votes).toEqual(4);
            });
            test("when votes are visible", () => {
                const updated = addVoteToPoll(
                    "abcdef",
                    1,
                    clonePoll({ ...poll, votes: visibleVotes })
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
                        clonePoll({ ...poll, config: singleVote })
                    );
                    expect(updated).toEqual(anonVotes);
                });
                test("when votes are anonymous", () => {
                    const updated = addVoteToPoll(
                        "abcdef",
                        1,
                        clonePoll({ ...poll, config: singleVote })
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
                        })
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
                        })
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
                        })
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
                        })
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
                        })
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
    const lookup: UserLookup = {
        a: createUser("a", "Mr A"),
        b: createUser("b", "Mr B"),
        c: createUser("c", "Mr C"),
        d: createUser("d", "Mr D"),
        e: createUser("e", "Mr E"),
        f: createUser("f", "Mr F"),
        g: createUser("g", "Mr G"),
        z: createUser("z", "Mr Z"),
    };

    const user = lookup.z as UserSummary;

    test("up to five members get listed", () => {
        const members = getMembersString(user, lookup, withFewerThanSix, "Unknown User", "You");
        expect(members).toEqual("**Mr A**, **Mr B**, **Mr C**, **Mr D** and **You**");
    });
    test("with unknown users", () => {
        const members = getMembersString(user, lookup, withUnknown, "Unknown User", "You");
        expect(members).toEqual("**Mr A**, **Mr B**, **Mr D**, **You** and **Unknown User**");
    });
    test("with more than 5 members", () => {
        const members = getMembersString(user, lookup, withMoreThanSix, "Unknown User", "You");
        expect(members).toEqual("8 members");
    });
});

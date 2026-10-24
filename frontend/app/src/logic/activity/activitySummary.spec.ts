import type { Message, MessageActivityEvent, PollContent, SenderContext } from "@client";
import { activitySummary, isByRelayedAuthor, type SummaryNames } from "./activitySummary";

const names: SummaryNames = {
    me: "me",
    username: "Alice",
    displayName: (id) => ({ me: "you", bob: "Bob", carol: "Carol" })[id] ?? id,
};

function summary(activity: MessageActivityEvent["activity"], message: Partial<Message>) {
    const event = { activity, userId: "alice" } as MessageActivityEvent;
    const { key, params } = activitySummary(
        event,
        { reactions: [], tips: {}, ...message } as Message,
        names,
    );
    return { key, params };
}

describe("an activity's summary", () => {
    const reaction = (userIds: string[]) =>
        summary("reaction", { reactions: [{ reaction: "👍", userIds: new Set(userIds) }] });

    test("counts the others who reacted, leaving out the reader", () => {
        expect(reaction(["alice", "me"])).toEqual({
            key: "activity.reactionOne",
            params: { username: "Alice" },
        });
        expect(reaction(["alice", "bob"])).toEqual({
            key: "activity.reactionTwo",
            params: { username: "Alice", other: "Bob" },
        });
        expect(reaction(["alice", "bob", "carol"])).toEqual({
            key: "activity.reactionN",
            params: { username: "Alice", n: 2 },
        });
    });

    test("counts the others who tipped", () => {
        const tips = { ledger: { alice: 1n, bob: 2n } } as Message["tips"];
        expect(summary("tip", { tips })).toEqual({
            key: "activity.tipTwo",
            params: { username: "Alice", other: "Bob" },
        });
    });

    test("counts a poll's other voters", () => {
        const content: PollContent = {
            kind: "poll_content",
            votes: { total: { kind: "anonymous_poll_votes", votes: { 0: 2, 1: 1 } }, user: [] },
            config: {
                allowMultipleVotesPerUser: false,
                allowUserToChangeVote: true,
                showVotesBeforeEndDate: true,
                anonymous: true,
                options: ["yes", "no"],
            },
            ended: false,
        };
        expect(summary("poll_vote", { content })).toEqual({
            key: "activity.pollVoteN",
            params: { username: "Alice", number: 2 },
        });
        // the only voter: no "and others"
        const alone: PollContent = {
            ...content,
            votes: { ...content.votes, total: { kind: "anonymous_poll_votes", votes: { 0: 1 } } },
        };
        expect(summary("poll_vote", { content: alone })).toEqual({
            key: "activity.pollVote",
            params: { username: "Alice" },
        });
    });
});

describe("whether an activity is by a message's relayed author", () => {
    const fromTelegram: SenderContext = {
        kind: "bot",
        finalised: true,
        bridgedFrom: { kind: "telegram", id: "1234" },
    };
    const byBot = (
        activity: MessageActivityEvent["activity"],
        message: Partial<Message> = { sender: "bridge-bot", senderContext: fromTelegram },
    ) =>
        isByRelayedAuthor(
            { activity, userId: "bridge-bot" } as MessageActivityEvent,
            message as Message,
        );

    test("is when the bot relayed the reply, mention or transfer the activity is for", () => {
        expect(byBot("quote_reply")).toBe(true);
        expect(byBot("mention")).toBe(true);
        expect(byBot("crypto")).toBe(true);
    });

    test("isn't for a reaction or a tip, whose message is the reader's", () => {
        expect(byBot("reaction")).toBe(false);
        expect(byBot("tip")).toBe(false);
    });

    test("isn't when the message wasn't relayed, or someone else sent it", () => {
        expect(byBot("quote_reply", { sender: "bridge-bot" })).toBe(false);
        expect(byBot("quote_reply", { sender: "alice", senderContext: fromTelegram })).toBe(false);
        expect(
            isByRelayedAuthor(
                { activity: "quote_reply", userId: "bridge-bot" } as MessageActivityEvent,
                undefined,
            ),
        ).toBe(false);
    });
});

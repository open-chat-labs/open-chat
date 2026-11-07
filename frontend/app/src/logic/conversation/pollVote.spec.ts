import type { ChatSummary, PollContent } from "@client";
import { describe, expect, test, vi } from "vitest";
import { votePoll } from "./pollVote";

function poll(user: number[] = []): PollContent {
    return {
        kind: "poll_content",
        votes: { total: { kind: "anonymous_poll_votes", votes: {} }, user },
        config: {
            allowMultipleVotesPerUser: false,
            allowUserToChangeVote: true,
            showVotesBeforeEndDate: true,
            anonymous: true,
            options: ["a", "b"],
        },
        ended: false,
    };
}

const group = { kind: "group_chat", id: { kind: "group_chat", groupId: "g" } } as ChatSummary;
const dm = { kind: "direct_chat", id: { kind: "direct_chat", userId: "u" } } as ChatSummary;
const msg = { sender: "alice", messageId: 9n, messageIndex: 4 };

function client(voted: boolean) {
    return {
        isChatReadOnly: vi.fn(() => false),
        registerPollVote: vi.fn(async () => voted),
    };
}

describe("a vote on a poll", () => {
    test("registers the answer added, and says when it didn't go through", async () => {
        const ok = client(true);
        expect(await votePoll(ok, group, "me", msg, poll(), [1])).toBe("voted");
        expect(ok.registerPollVote).toHaveBeenCalledWith(group.id, undefined, 9n, 4, 1, "register");
        expect(await votePoll(client(false), group, "me", msg, poll(), [1])).toBe("failed");
    });

    test("takes back the answer removed", async () => {
        const ok = client(true);
        await votePoll(ok, group, "me", msg, poll([0]), []);
        expect(ok.registerPollVote).toHaveBeenCalledWith(group.id, undefined, 9n, 4, 0, "delete");
    });

    test("sends nothing in a DM, or when nothing changed", async () => {
        const ok = client(true);
        expect(await votePoll(ok, dm, "me", msg, poll(), [1])).toBe("none");
        expect(await votePoll(ok, group, "me", msg, poll([1]), [1])).toBe("none");
        expect(ok.registerPollVote).not.toHaveBeenCalled();
    });
});

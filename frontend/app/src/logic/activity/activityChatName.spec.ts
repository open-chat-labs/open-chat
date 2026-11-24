import type { ChatSummary, MessageContext } from "@client";
import { activityChatName, type ChatNameLookups } from "./activityChatName";

const lookups: ChatNameLookups = {
    displayName: (userId) => `name of ${userId}`,
    communityName: ({ communityId }) => (communityId === "c1" ? "Community" : undefined),
    thread: "Thread",
};

const dm = {
    kind: "direct_chat",
    id: { kind: "direct_chat", userId: "alice" },
    them: { kind: "direct_chat", userId: "alice" },
} as unknown as ChatSummary;
const group = {
    kind: "group_chat",
    id: { kind: "group_chat", groupId: "g1" },
    name: "Group",
} as unknown as ChatSummary;
const channel = (communityId: string) =>
    ({
        kind: "channel",
        id: { kind: "channel", communityId, channelId: "1" },
        name: "general",
    }) as unknown as ChatSummary;

const at = (chat: ChatSummary, thread?: number): MessageContext => ({
    chatId: chat.id,
    threadRootMessageIndex: thread,
});

describe("an activity's chat name", () => {
    test("names the person for a DM, and the group for a group", () => {
        expect(activityChatName(dm, at(dm), lookups)).toBe("name of alice");
        expect(activityChatName(group, at(group), lookups)).toBe("Group");
    });

    test("names a channel after its community, or alone while that isn't loaded", () => {
        expect(activityChatName(channel("c1"), at(channel("c1")), lookups)).toBe(
            "Community > general",
        );
        expect(activityChatName(channel("c2"), at(channel("c2")), lookups)).toBe("general");
    });

    test("adds the thread for a message in one", () => {
        expect(activityChatName(group, at(group, 4), lookups)).toBe("Group > Thread");
    });

    test("is nothing while the chat isn't loaded", () => {
        expect(activityChatName(undefined, at(group), lookups)).toBeUndefined();
    });
});

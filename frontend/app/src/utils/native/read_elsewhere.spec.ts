import type { ChatSummary } from "@client";
import { describe, expect, test } from "vitest";
import {
    notificationContexts,
    readElsewhere,
    readMarks,
    type NotificationContext,
} from "./read_elsewhere";

const dm = (senderId: string, latestMessageIndex: number, unread: number): NotificationContext => ({
    id: { kind: "dms", senderId },
    latestMessageIndex,
    unread,
});

describe("a chat with unread messages keeps its notifications; a chat read elsewhere loses them on resume", () => {
    test("read since the last check: released; still unread: kept", () => {
        const before = readMarks([dm("alice", 5, 2), dm("bob", 5, 2)]);
        const now = [dm("alice", 5, 0), dm("bob", 6, 3)];
        expect(readElsewhere(before, now)).toEqual([{ kind: "dms", senderId: "alice" }]);
    });

    test("a message that arrived and was read elsewhere between checks: released", () => {
        expect(readElsewhere(readMarks([dm("alice", 5, 0)]), [dm("alice", 7, 0)])).toEqual([
            { kind: "dms", senderId: "alice" },
        ]);
    });

    test("a thread read elsewhere is released alone, its chat's unread messages keep theirs", () => {
        const group = (latest: number, threadLatest: number) =>
            ({
                kind: "group_chat",
                id: { kind: "group_chat", groupId: "g1" },
                latestMessage: { event: { messageIndex: latest } },
                membership: {
                    latestThreads: [{ threadRootMessageIndex: 3, latestMessageIndex: threadLatest }],
                },
            }) as unknown as ChatSummary;
        const unreadInChat = () => 1;
        const before = readMarks(notificationContexts([group(9, 4)], unreadInChat, () => 1));
        const now = notificationContexts([group(9, 6)], unreadInChat, () => 0);
        expect(readElsewhere(before, now)).toEqual([
            { kind: "group", groupId: "g1", threadIndex: 3 },
        ]);
    });
});

describe("only chats that could have gained a notification since the last check are released", () => {
    test("a read chat unchanged since the last check, or one the check never saw: left alone", () => {
        const before = readMarks([dm("alice", 5, 0)]);
        expect(readElsewhere(before, [dm("alice", 5, 0), dm("bob", 9, 0)])).toEqual([]);
    });
});

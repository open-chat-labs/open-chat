import type { ChatSummary, EventWrapper, Message, ThreadPreview } from "@client";
import { describe, expect, test, vi } from "vitest";
import { threadListGroups, threadSummaryProps, type ThreadListContext } from "./thread.adapter";

function message(messageIndex: number, sender: string, fields: Partial<Message> = {}) {
    return {
        index: messageIndex,
        timestamp: BigInt(messageIndex),
        event: {
            kind: "message",
            messageId: BigInt(messageIndex),
            messageIndex,
            sender,
            content: { kind: "text_content", text: `m${messageIndex}` },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
            ...fields,
        },
    } as unknown as EventWrapper<Message>;
}

const words = {
    userName: (id: string) => ({ alice: "Alice Smith", bob: "Bob" })[id] ?? id,
    contentText: (content: Message["content"]) =>
        content.kind === "text_content" ? content.text : content.kind,
    date: (timestamp: bigint) => `d${timestamp}`,
};

describe("threadSummaryProps", () => {
    test("the root's author, text and time, those in the thread and its replies", () => {
        const root = message(4, "alice", {
            thread: {
                participantIds: new Set(["alice", "bob"]),
                followedByMe: true,
                numberOfReplies: 3,
                latestEventIndex: 2,
                latestEventTimestamp: 9n,
            },
        });
        const props = threadSummaryProps(root, words);
        expect(props.root).toMatchObject({ author: "Alice Smith", text: "m4", time: "d4" });
        expect(props.faces).toHaveLength(2);
        expect(props.replyCount).toBe(3);
    });

    test("a thread just started has no replies or faces yet", () => {
        const props = threadSummaryProps(message(4, "alice"), words);
        expect(props.faces).toEqual([]);
        expect(props.replyCount).toBe(0);
    });
});

describe("threadListGroups", () => {
    const g1 = { kind: "group_chat" as const, groupId: "g1" };
    const g2 = { kind: "group_chat" as const, groupId: "g2" };
    const chats = new Map([
        ["g1", { kind: "group_chat", id: g1, name: "Readers" } as ChatSummary],
        ["g2", { kind: "group_chat", id: g2, name: "Writers" } as ChatSummary],
    ]);
    const preview = (chatId: typeof g1, root: number, totalReplies = 2): ThreadPreview => ({
        chatId,
        rootMessage: message(root, "alice"),
        latestReplies: [],
        totalReplies,
    });

    function context(fields: Partial<ThreadListContext> = {}): ThreadListContext {
        return {
            ...words,
            chat: (id) => chats.get(id.kind === "group_chat" ? id.groupId : ""),
            replies: (n) => `${n} replies`,
            unread: () => 0,
            selected: () => false,
            open: vi.fn(),
            ...fields,
        };
    }

    test("groups the threads by chat, in the order they come", () => {
        const groups = threadListGroups(
            [preview(g1, 1), preview(g2, 2), preview(g1, 3)],
            context(),
        );
        expect(groups.map((g) => [g.name, g.threads.map((t) => t.text)])).toEqual([
            ["Readers", ["m1", "m3"]],
            ["Writers", ["m2"]],
        ]);
    });

    test("each thread is its root, its replies and what's unread", () => {
        const [group] = threadListGroups(
            [preview(g1, 1, 5)],
            context({ unread: () => 2, selected: () => true }),
        );
        expect(group.threads[0]).toMatchObject({
            author: "Alice Smith",
            time: "d1",
            text: "m1",
            count: "5 replies",
            unread: 2,
            selected: true,
        });
    });

    test("a thread with nothing unread shows no count", () => {
        const [group] = threadListGroups([preview(g1, 1)], context());
        expect(group.threads[0].unread).toBeUndefined();
    });

    test("opening a thread opens that thread", () => {
        const open = vi.fn();
        const thread = preview(g1, 1);
        const [group] = threadListGroups([thread], context({ open }));
        group.threads[0].onOpen?.();
        expect(open).toHaveBeenCalledWith(thread);
    });

    test("leaves out a thread whose chat isn't in the list any more", () => {
        const gone = { kind: "group_chat" as const, groupId: "gone" };
        expect(threadListGroups([preview(gone, 1)], context())).toEqual([]);
    });
});

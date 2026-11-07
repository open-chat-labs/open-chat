import type { EventWrapper, Message } from "@client";
import { vi } from "vitest";
import { runMessageAction, type MessageMenuTarget } from "./messageMenu";

const chatId = { kind: "group_chat" as const, groupId: "g" };

const evt: EventWrapper<Message> = {
    index: 3,
    timestamp: 7n,
    event: {
        kind: "message",
        messageId: 42n,
        messageIndex: 2,
        sender: "me",
        content: { kind: "text_content", text: "hi" },
        reactions: [],
        tips: {},
        edited: false,
        forwarded: false,
        deleted: false,
        blockLevelMarkdown: false,
        ogPreviews: [],
        messagePreviews: [],
    },
};

function fakeClient() {
    return {
        blockUser: vi.fn(async () => true),
        cancelMessageReminder: vi.fn(async () => true),
        deleteFailedMessage: vi.fn(async () => {}),
        deleteMessage: vi.fn(async () => true),
        followThread: vi.fn(async () => true),
        getContentAsText: vi.fn(() => "hi"),
        pinMessage: vi.fn(async () => true),
        replyPrivately: vi.fn(async () => undefined),
        retrySendMessage: vi.fn(async () => ({ kind: "failure" as const })),
        revealBlockedMessage: vi.fn(),
        revealDeletedMessage: vi.fn(async () => true),
        translateMessage: vi.fn(async () => true),
        undeleteMessage: vi.fn(async () => true),
        unpinMessage: vi.fn(async () => true),
        untranslate: vi.fn(),
    };
}

function target(
    client: ReturnType<typeof fakeClient>,
    fields: Partial<MessageMenuTarget> = {},
): MessageMenuTarget {
    return {
        client,
        context: { chatId },
        scope: "chats",
        evt,
        failed: false,
        me: "me",
        users: new Map(),
        formatter: (key) => key,
        locale: "en",
        diamond: true,
        confirmDelete: false,
        ...fields,
    };
}

describe("a message's actions in the conversation", () => {
    // invariant 5
    test("deleting a failed message only removes it locally, never calls deleteMessage", async () => {
        const client = fakeClient();
        const dialog = await runMessageAction("delete", target(client, { failed: true, confirmDelete: true }));
        expect(dialog).toBeUndefined();
        expect(client.deleteFailedMessage).toHaveBeenCalledWith(chatId, 42n, undefined);
        expect(client.deleteMessage).not.toHaveBeenCalled();
    });

    test("deleting asks first while the setting says to, and deletes straight away otherwise", async () => {
        const asking = fakeClient();
        expect(await runMessageAction("delete", target(asking, { confirmDelete: true }))).toEqual({
            kind: "delete",
            evt,
        });
        expect(asking.deleteMessage).not.toHaveBeenCalled();

        const straight = fakeClient();
        await runMessageAction("delete_for_me", target(straight));
        expect(straight.deleteMessage).toHaveBeenCalledWith(chatId, undefined, 42n);
    });

    test("reporting and setting a reminder ask why and when first", async () => {
        expect(await runMessageAction("report", target(fakeClient()))).toEqual({
            kind: "report",
            evt,
        });
        expect(await runMessageAction("remind", target(fakeClient()))).toEqual({
            kind: "remind",
            evt,
        });
    });

    test("forwarding asks where to first", async () => {
        expect(await runMessageAction("forward", target(fakeClient()))).toEqual({
            kind: "forward",
            evt,
        });
    });

    test("retrying resends the failed message itself", async () => {
        const client = fakeClient();
        await runMessageAction("retry", target(client, { failed: true }));
        expect(client.retrySendMessage).toHaveBeenCalledWith({ chatId }, evt);
    });

    test("pinning and unpinning go by the message's index", async () => {
        const client = fakeClient();
        await runMessageAction("pin", target(client));
        await runMessageAction("unpin", target(client));
        expect(client.pinMessage).toHaveBeenCalledWith(chatId, 2);
        expect(client.unpinMessage).toHaveBeenCalledWith(chatId, 2);
    });

    test("in a thread, a message is deleted, revealed and retried in the thread", async () => {
        const client = fakeClient();
        const context = { chatId, threadRootMessageIndex: 9 };
        await runMessageAction("delete", target(client, { context }));
        expect(client.deleteMessage).toHaveBeenCalledWith(chatId, 9, 42n);
        await runMessageAction("delete", target(client, { context, failed: true }));
        expect(client.deleteFailedMessage).toHaveBeenCalledWith(chatId, 42n, 9);
        await runMessageAction("retry", target(client, { context, failed: true }));
        expect(client.retrySendMessage).toHaveBeenCalledWith(context, evt);
    });

    test("following from a thread's message follows the thread's root", async () => {
        const client = fakeClient();
        const root = { ...evt.event, messageId: 1n, messageIndex: 9 };
        await runMessageAction(
            "unfollow_thread",
            target(client, { context: { chatId, threadRootMessageIndex: 9 }, threadRoot: root }),
        );
        expect(client.followThread).toHaveBeenCalledWith(chatId, root, false);
    });

    test("translating isn't asked of the client for someone without Diamond", async () => {
        const client = fakeClient();
        await runMessageAction("translate", target(client, { diamond: false }));
        expect(client.translateMessage).not.toHaveBeenCalled();
    });
});

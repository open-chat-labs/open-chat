import { i18nKey, type DirectChatIdentifier, type EventWrapper, type Message } from "@client";
import { vi } from "vitest";
import { rowMessageContext } from "./threadTimeline";
import { toastStore } from "@src/stores/toast";
import { buildMessageUrl } from "@src/utils/share";
import { messageAction, undeleteMessage, type MessageActionTarget } from "./messageAction";

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
        replyPrivately: vi.fn(async (): Promise<DirectChatIdentifier | undefined> => undefined),
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
    fields: Partial<MessageActionTarget> = {},
): MessageActionTarget {
    return {
        client,
        context: { chatId },
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

describe("a message's actions", () => {
    // invariant 5
    test("deleting a failed message only removes it locally, never calls deleteMessage", async () => {
        const client = fakeClient();
        const outcome = await messageAction(
            "delete",
            target(client, { failed: true, confirmDelete: true }),
        );
        expect(outcome).toEqual({ kind: "done" });
        expect(client.deleteFailedMessage).toHaveBeenCalledWith(chatId, 42n, undefined);
        expect(client.deleteMessage).not.toHaveBeenCalled();
    });

    test("deleting asks first while the setting says to, and deletes straight away otherwise", async () => {
        const asking = fakeClient();
        expect(await messageAction("delete", target(asking, { confirmDelete: true }))).toEqual({
            kind: "ask",
            dialog: { kind: "delete", evt },
        });
        expect(asking.deleteMessage).not.toHaveBeenCalled();

        const straight = fakeClient();
        expect(await messageAction("delete_for_me", target(straight))).toEqual({
            kind: "deleted",
            ok: true,
        });
        expect(straight.deleteMessage).toHaveBeenCalledWith(chatId, undefined, 42n);
    });

    test("reporting and setting a reminder ask why and when first", async () => {
        expect(await messageAction("report", target(fakeClient()))).toEqual({
            kind: "ask",
            dialog: { kind: "report", evt },
        });
        expect(await messageAction("remind", target(fakeClient()))).toEqual({
            kind: "ask",
            dialog: { kind: "remind", evt },
        });
    });

    test("forwarding asks where to first", async () => {
        expect(await messageAction("forward", target(fakeClient()))).toEqual({
            kind: "ask",
            dialog: { kind: "forward", evt },
        });
    });

    test("retrying resends the failed message itself", async () => {
        const client = fakeClient();
        await messageAction("retry", target(client, { failed: true }));
        expect(client.retrySendMessage).toHaveBeenCalledWith({ chatId }, evt);
    });

    test("pinning and unpinning go by the message's index", async () => {
        const client = fakeClient();
        await messageAction("pin", target(client));
        await messageAction("unpin", target(client));
        expect(client.pinMessage).toHaveBeenCalledWith(chatId, 2);
        expect(client.unpinMessage).toHaveBeenCalledWith(chatId, 2);
    });

    test("in a thread, a message is deleted, revealed and retried in the thread", async () => {
        const client = fakeClient();
        const context = { chatId, threadRootMessageIndex: 9 };
        await messageAction("delete", target(client, { context }));
        expect(client.deleteMessage).toHaveBeenCalledWith(chatId, 9, 42n);
        await messageAction("delete", target(client, { context, failed: true }));
        expect(client.deleteFailedMessage).toHaveBeenCalledWith(chatId, 42n, 9);
        await messageAction("retry", target(client, { context, failed: true }));
        expect(client.retrySendMessage).toHaveBeenCalledWith(context, evt);
    });

    test("in a thread, its root is deleted, undeleted and revealed in the chat", async () => {
        const client = fakeClient();
        // the root heads the thread's list, but it's the chat's message
        const context = rowMessageContext(chatId, evt.event, evt.event);
        const inThread = { context, threadRoot: evt.event };
        await messageAction("delete", target(client, inThread));
        expect(client.deleteMessage).toHaveBeenCalledWith(chatId, undefined, 42n);
        await messageAction("undelete", target(client, inThread));
        expect(client.undeleteMessage).toHaveBeenCalledWith(chatId, undefined, evt.event);
        const deleted = { ...evt, event: { ...evt.event, deleted: true } };
        await messageAction("reveal", target(client, { ...inThread, evt: deleted }));
        expect(client.revealDeletedMessage).toHaveBeenCalledWith(chatId, 42n, undefined);
    });

    test("following from a thread's message follows the thread's root", async () => {
        const client = fakeClient();
        const root = { ...evt.event, messageId: 1n, messageIndex: 9 };
        await messageAction(
            "unfollow_thread",
            target(client, { context: { chatId, threadRootMessageIndex: 9 }, threadRoot: root }),
        );
        expect(client.followThread).toHaveBeenCalledWith(chatId, root, false);
    });

    test("translating isn't asked of the client for someone without Diamond", async () => {
        const client = fakeClient();
        expect(await messageAction("translate", target(client, { diamond: false }))).toEqual({
            kind: "upgrade",
        });
        expect(client.translateMessage).not.toHaveBeenCalled();
    });

    test("a failure comes back with what to say, for the view to show", async () => {
        const client = fakeClient();
        client.pinMessage.mockResolvedValue(false);
        expect(await messageAction("pin", target(client))).toEqual({
            kind: "failed",
            message: i18nKey("pinMessageFailed"),
        });
    });

    test("a private reply opens the sender's DM, or says it couldn't be made", async () => {
        const client = fakeClient();
        expect(await messageAction("reply_privately", target(client))).toEqual({
            kind: "not_found",
        });
        const dm = { kind: "direct_chat" as const, userId: "them" };
        client.replyPrivately.mockResolvedValue(dm);
        expect(await messageAction("reply_privately", target(client))).toEqual({
            kind: "open_chat",
            chatId: dm,
        });
    });

    test("starting a thread opens the message's thread", async () => {
        expect(await messageAction("start_thread", target(fakeClient()))).toEqual({
            kind: "open_thread",
            threadRootMessageIndex: 2,
        });
    });

    test("a delete's Undo restores the message as deleted, wherever it is", async () => {
        const client = fakeClient();
        const context = { chatId, threadRootMessageIndex: 9 };
        expect(await undeleteMessage(client, context, evt.event)).toBe(true);
        expect(client.undeleteMessage).toHaveBeenCalledWith(chatId, 9, {
            ...evt.event,
            deleted: true,
        });
    });

    describe("a link copied and a message shared", () => {
        // the browser's clipboard and share sheet, as each test has them
        function browser(fields: Partial<Pick<Navigator, "clipboard" | "share">>) {
            for (const [key, value] of Object.entries(fields)) {
                Object.defineProperty(navigator, key, { value, configurable: true });
            }
        }

        afterEach(() => {
            browser({ clipboard: undefined, share: undefined });
            vi.restoreAllMocks();
        });

        test("copying a link says whether the clipboard took it, for the view to show", async () => {
            const toasts = vi.spyOn(toastStore, "showSuccessToast");
            const url = buildMessageUrl(chatId, 2, undefined);
            const writeText = vi.fn(async () => {});
            browser({ clipboard: { writeText } as unknown as Clipboard });
            expect(await messageAction("copy_url", target(fakeClient()))).toEqual({
                kind: "link_copied",
                ok: true,
                url,
            });
            expect(writeText).toHaveBeenCalledWith(url);

            writeText.mockRejectedValue(new Error("denied"));
            expect(await messageAction("copy_url", target(fakeClient()))).toEqual({
                kind: "link_copied",
                ok: false,
                url,
            });
            expect(toasts).not.toHaveBeenCalled();
        });

        test("sharing says whether it could; the share sheet dismissed isn't a failure", async () => {
            const toasts = vi.spyOn(toastStore, "showFailureToast");
            vi.spyOn(console, "log").mockImplementation(() => {});
            const share = vi.fn(async () => {});
            browser({ share });
            const shared = () => messageAction("share", target(fakeClient()));
            expect(await shared()).toEqual({ kind: "shared", ok: true });
            expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: "hi" }));

            share.mockRejectedValue(new DOMException("dismissed", "AbortError"));
            expect(await shared()).toEqual({ kind: "shared", ok: true });

            share.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
            expect(await shared()).toEqual({ kind: "shared", ok: false });
            expect(toasts).not.toHaveBeenCalled();
        });
    });
});

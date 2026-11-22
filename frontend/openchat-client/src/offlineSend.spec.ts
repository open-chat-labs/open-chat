import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

// The constructor starts an auth client against IndexedDB; keep it inert
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: () => new Promise(() => {}) },
}));

import {
    CommonResponses,
    ChatMap,
    ROLE_MEMBER,
    anonymousUser,
    subscribe,
    type AttachmentContent,
    type GroupChatIdentifier,
    type GroupChatSummary,
    type Message,
    type EventWrapper,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, localUpdates, serverGroupChatsStore } from "./state";
import { mostRecentStore } from "./stores/throttling";
import { WorkerAgent } from "./workerAgent";

// A message sent without a connection: with `queueOfflineSends` (the new UIs) it waits, queued,
// to go once the app is back online; a backend failure is failed, with Retry; and without the
// flag (the old UIs) an offline send fails with Retry rather than vanishing (#10591).

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

function config(queueOfflineSends: boolean): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
        queueOfflineSends,
    } as unknown as OpenChatConfig;
}

const chatId: GroupChatIdentifier = { kind: "group_chat", groupId: "aaaaa-aa" };
const context = { chatId };

function group(): GroupChatSummary {
    return {
        kind: "group_chat",
        id: chatId,
        name: "g",
        description: "",
        public: true,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        latestEventIndex: 0,
        latestMessageIndex: undefined,
        latestMessage: undefined,
        membership: {
            role: ROLE_MEMBER,
            archived: false,
            lapsed: false,
            rulesAccepted: true,
            latestThreads: [],
            mentions: [],
        },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        permissions: {},
        level: "group",
        lastUpdated: 0n,
        memberCount: 2,
        frozen: false,
        historyVisible: true,
    } as unknown as GroupChatSummary;
}

const transfer = {
    kind: "crypto_content",
    transfer: { kind: "pending", ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai", amountE8s: 1n },
} as unknown as AttachmentContent;

type Handlers = {
    onResult: (value: unknown, final: boolean) => void;
    onError?: (reason?: unknown) => void;
};

describe("a message sent without a connection", () => {
    let client: OpenChat;
    // each send that reached the worker, with what answers it
    let sends: { req: WorkerRequest; handlers: Handlers }[];
    // the other requests that reached the worker
    let requests: WorkerRequest[];
    let online: boolean;
    let failedToasts: number;
    let unsubscribe: (() => void) | undefined;

    function make(queueOfflineSends: boolean) {
        client = new OpenChat(config(queueOfflineSends));
    }

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        online = true;
        vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        sends = [];
        requests = [];
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => ({
            subscribe: (handlers: Handlers) => {
                if (req.kind === "sendMessage") sends.push({ req, handlers });
            },
        })) as never);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            requests.push(req);
            return Promise.resolve(undefined);
        }) as never);
        const groups = new ChatMap<GroupChatSummary>();
        groups.set(chatId, group());
        serverGroupChatsStore.set(groups);
        failedToasts = 0;
        unsubscribe = subscribe("sendMessageFailed", () => failedToasts++);
    });

    afterEach(() => {
        unsubscribe?.();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        mostRecentStore.set([]);
        serverGroupChatsStore.set(new ChatMap());
        localUpdates.clearAll();
        localUpdates.draftMessages.delete(context);
    });

    async function send(attachment?: AttachmentContent): Promise<bigint> {
        void client.sendMessage(context, "hello", false, attachment, []);
        await vi.advanceTimersByTimeAsync(0);
        const req = sends[sends.length - 1].req;
        if (req.kind !== "sendMessage") throw new Error("not a send");
        return req.event.event.messageId;
    }

    function lastSend(): Handlers {
        return sends[sends.length - 1].handlers;
    }

    async function answer(value: unknown) {
        lastSend().onResult(value, true);
        await vi.advanceTimersByTimeAsync(0);
    }

    async function fail(error: unknown) {
        lastSend().onError?.(error);
        await vi.advanceTimersByTimeAsync(0);
    }

    function failedMessage(messageId: bigint): EventWrapper<Message> | undefined {
        return localUpdates
            .failedMessagesForContext(context)
            .find((e) => e.event.messageId === messageId);
    }

    function recorded(messageId: bigint): { queued: boolean } | undefined {
        const req = requests.findLast(
            (r) => r.kind === "recordFailedMessage" && r.event.event.messageId === messageId,
        );
        return req?.kind === "recordFailedMessage" ? { queued: req.queued } : undefined;
    }

    describe("in the new UIs (queueOfflineSends)", () => {
        beforeEach(() => make(true));

        test("the agent's offline answer queues it: still shown, as queued, no failure", async () => {
            online = false;
            const id = await send();
            await answer([CommonResponses.offline(), {} as Message]);
            expect(failedMessage(id)).toBeDefined();
            expect(localUpdates.isQueued(context, id)).toBe(true);
            expect(localUpdates.isUnconfirmed(context, id)).toBe(false);
            expect(recorded(id)).toEqual({ queued: true });
            expect(failedToasts).toBe(0);
        });

        test("still shown long after the unconfirmed message would have timed out", async () => {
            online = false;
            const id = await send();
            await answer([CommonResponses.offline(), {} as Message]);
            await vi.advanceTimersByTimeAsync(120_000);
            expect(failedMessage(id)).toBeDefined();
            expect(localUpdates.isQueued(context, id)).toBe(true);
        });

        test("going offline mid-send queues it", async () => {
            const id = await send();
            online = false;
            await fail({ name: "HttpError", message: "Request timed out" });
            expect(localUpdates.isQueued(context, id)).toBe(true);
            expect(failedToasts).toBe(0);
        });

        test("a request that got no response queues it, the app still saying online", async () => {
            const id = await send();
            await fail({ name: "HttpError", message: "Failed to fetch HTTP request: TypeError" });
            expect(localUpdates.isQueued(context, id)).toBe(true);
        });

        test("a backend failure while online fails it, with Retry", async () => {
            const id = await send();
            await fail({ name: "HttpError", message: "Call was rejected: IC0503" });
            expect(failedMessage(id)).toBeDefined();
            expect(localUpdates.isQueued(context, id)).toBe(false);
            expect(failedToasts).toBe(1);
        });

        test("Retry while offline puts it back in the queue: nothing lost", async () => {
            const id = await send();
            await fail({ name: "HttpError", message: "Call was rejected: IC0503" });
            const index = failedMessage(id)!.index;
            online = false;
            void client.retrySendMessage(context, failedMessage(id)!);
            await vi.advanceTimersByTimeAsync(0);
            // in the failed copy's place, so it stays among the chat's events
            expect(localUpdates.unconfirmedMessages(context).map((e) => e.index)).toEqual([index]);
            await vi.advanceTimersByTimeAsync(0);
            await answer([CommonResponses.offline(), {} as Message]);
            await vi.advanceTimersByTimeAsync(120_000);
            expect(failedMessage(id)).toBeDefined();
            expect(localUpdates.isQueued(context, id)).toBe(true);
        });

        test("a deleted queued message is gone, from the device too", async () => {
            online = false;
            const id = await send();
            await answer([CommonResponses.offline(), {} as Message]);
            await client.deleteFailedMessage(chatId, id);
            expect(failedMessage(id)).toBeUndefined();
            expect(localUpdates.isQueued(context, id)).toBe(false);
            expect(requests.some((r) => r.kind === "deleteFailedMessage")).toBe(true);
        });

        test("deleting the first of two queued messages keeps the second, in its place (#10591)", async () => {
            online = false;
            const first = await send();
            const second = await send();
            for (const { handlers } of sends) {
                handlers.onResult([CommonResponses.offline(), {} as Message], true);
            }
            await vi.advanceTimersByTimeAsync(0);
            const firstIndex = failedMessage(first)!.index;
            expect(failedMessage(second)!.index).toBe(firstIndex + 1);

            await client.deleteFailedMessage(chatId, first);

            expect(failedMessage(first)).toBeUndefined();
            expect(localUpdates.isQueued(context, second)).toBe(true);
            // moved into the deleted one's place, so the chat goes on showing it
            expect(failedMessage(second)!.index).toBe(firstIndex);
            // and kept on the device there, still queued
            const kept = requests.findLast(
                (r) => r.kind === "recordFailedMessage" && r.event.event.messageId === second,
            );
            expect(kept?.kind === "recordFailedMessage" && kept.event.index).toBe(firstIndex);
            expect(kept?.kind === "recordFailedMessage" && kept.queued).toBe(true);
            // only the deleted one leaves the device
            const removed = requests.filter((r) => r.kind === "deleteFailedMessage");
            expect(removed.map((r) => r.kind === "deleteFailedMessage" && r.messageId)).toEqual([
                first,
            ]);
        });

        test("a crypto transfer isn't queued, nor posted: the draft holding it stays", async () => {
            online = false;
            const outcome = client.sendMessage(context, "hello", false, transfer, []);
            await vi.advanceTimersByTimeAsync(0);
            expect(await outcome).toEqual({ kind: "failed" });
            expect(sends).toHaveLength(0);
            expect(localUpdates.allQueuedMessages()).toEqual([]);
        });

        test("a crypto transfer from its dialog says the device is offline", async () => {
            online = false;
            const outcome = await client.sendCryptoTransfer(
                context,
                transfer.kind === "crypto_content"
                    ? (transfer.transfer as Parameters<OpenChat["sendCryptoTransfer"]>[1])
                    : (undefined as never),
                "",
            );
            expect(outcome).toEqual({
                kind: "failed",
                message: expect.objectContaining({ key: "offlineError" }),
            });
            expect(sends).toHaveLength(0);
        });
    });

    describe("in the old UIs", () => {
        beforeEach(() => make(false));

        test("the agent's offline answer fails it, with Retry, rather than it vanishing", async () => {
            online = false;
            const id = await send();
            await answer([CommonResponses.offline(), {} as Message]);
            await vi.advanceTimersByTimeAsync(120_000);
            expect(failedMessage(id)).toBeDefined();
            expect(localUpdates.isQueued(context, id)).toBe(false);
            expect(failedToasts).toBe(1);
        });

        test("a request that got no response fails it, as before", async () => {
            const id = await send();
            await fail({ name: "HttpError", message: "Failed to fetch HTTP request: TypeError" });
            expect(failedMessage(id)).toBeDefined();
            expect(localUpdates.isQueued(context, id)).toBe(false);
        });
    });
});

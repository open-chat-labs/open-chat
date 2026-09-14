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
    ChatMap,
    Stream,
    subscribe,
    type ChatEvent,
    type EventsResponse,
    type GroupChatSummary,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { routeStore, serverEventsStore, serverGroupChatsStore } from "./state";
import { WorkerAgent } from "./workerAgent";

// Invariants from #9358 (chat selection focused message jitter):
//   1. a message window load announces its target before any of its events
//      are applied: loadEventWindow publishes loadingMessageWindow with the
//      context and message index
//   4. (client side) a window load that ends without a window publishes
//      loadedMessageWindow with an undefined message index, so the list can
//      reveal itself

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

const chatId = { kind: "group_chat" as const, groupId: "aaaaa-aa" };

function groupChat(): GroupChatSummary {
    return {
        kind: "group_chat",
        id: chatId,
        name: "g",
        description: "",
        public: true,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        latestEventIndex: 40,
        latestMessageIndex: 20,
        latestMessage: messageEvent(20, 40),
        membership: { role: 1, archived: false, lapsed: false },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        permissions: {},
        level: "group",
        eventsTTL: undefined,
        eventsTtlLastUpdated: 0n,
        lastUpdated: 0n,
        memberCount: 1,
        subtype: undefined,
        frozen: false,
        dateLastPinned: undefined,
        messagesVisibleToNonMembers: false,
        localUserIndex: "",
        isInvited: false,
        historyVisible: true,
        blobReference: undefined,
        blobData: undefined,
    } as unknown as GroupChatSummary;
}

function messageEvent(messageIndex: number, index: number) {
    return {
        index,
        timestamp: BigInt(1000 + index),
        expiresAt: undefined,
        event: {
            kind: "message",
            messageIndex,
            messageId: BigInt(100 + messageIndex),
            sender: "user1",
            content: { kind: "text_content", text: `m${messageIndex}` },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
        },
    };
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
    } as unknown as OpenChatConfig;
}

describe("loadEventWindow announces its target (#9358)", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        // the events of a window go to the selected chat's store
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId,
            chatType: "group_chat",
            open: false,
        });
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatId, groupChat());
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        serverEventsStore.set([]);
    });

    // invariant 1
    test("publishes loadingMessageWindow before the window's events are applied", async () => {
        const order: string[] = [];
        const unsubs = [
            subscribe("loadingMessageWindow", ({ context, messageIndex }) => {
                order.push(`announce:${context.chatId.kind}:${messageIndex}`);
            }),
            serverEventsStore.subscribe((events) => {
                if (events.length > 0) order.push(`events:${events.length}`);
            }),
        ];
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(() => {
            order.push("stream");
            const resp: EventsResponse<ChatEvent> = {
                events: [messageEvent(4, 10), messageEvent(5, 11), messageEvent(6, 12)],
                expiredEventRanges: [],
                latestEventIndex: 40,
            } as unknown as EventsResponse<ChatEvent>;
            // the client subscribes after construction: resolve on a later tick
            return new Stream((resolve) => setTimeout(() => resolve(resp, true), 0)) as never;
        });

        client.loadEventWindow(chatId, 5, undefined, true);
        await new Promise((r) => setTimeout(r, 10));

        expect(order[0]).toBe("announce:group_chat:5");
        expect(order.indexOf("stream")).toBeGreaterThan(0);
        expect(order.some((o) => o.startsWith("events:"))).toBe(true);
        expect(order.indexOf("announce:group_chat:5")).toBeLessThan(
            order.findIndex((o) => o.startsWith("events:")),
        );
        unsubs.forEach((u) => u());
    });

    // invariant 4 (client side)
    test("a failed window load publishes loadedMessageWindow without a message index", async () => {
        const loaded: (number | undefined)[] = [];
        const unsub = subscribe("loadedMessageWindow", ({ messageIndex }) => {
            loaded.push(messageIndex);
        });
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(
            () =>
                new Stream((_resolve, reject) =>
                    setTimeout(() => reject(new Error("offline")), 0),
                ) as never,
        );

        // not an initial load: no fallback to the latest messages follows
        await client.loadEventWindow(chatId, 5, undefined, false);

        expect(loaded).toEqual([undefined]);
        unsub();
    });
});

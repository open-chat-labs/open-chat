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
    type ChatEvent,
    type EventsResponse,
    type EventWrapper,
    type Message,
    type GroupChatIdentifier,
    type GroupChatSummary,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    routeStore,
    selectedChatIdStore,
    selectedThreadIdStore,
    serverEventsStore,
    serverGroupChatsStore,
    expiredServerEventRanges,
    serverThreadEventsStore,
} from "./state";
import { eventsVisitFor, startChatVisit, startThreadVisit } from "./state/selectedChat";
import { WorkerAgent } from "./workerAgent";

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

const chatA = { kind: "group_chat" as const, groupId: "aaaaa-aa" };
const chatB = { kind: "group_chat" as const, groupId: "bbbbb-bb" };

function groupChat(chatId: GroupChatIdentifier): GroupChatSummary {
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

function select(chatId: GroupChatIdentifier) {
    routeStore.set({
        kind: "global_chat_selected_route",
        scope: { kind: "chats" },
        chatId,
        chatType: "group_chat",
        open: false,
    });
}

function eventWindow(
    firstMessageIndex: number,
    expiredEventRanges: { start: number; end: number }[] = [],
): EventsResponse<ChatEvent> {
    return {
        events: [0, 1, 2].map((i) => messageEvent(firstMessageIndex + i, firstMessageIndex + i)),
        expiredEventRanges,
        latestEventIndex: 40,
    } as unknown as EventsResponse<ChatEvent>;
}

const indexes = (events: EventWrapper<ChatEvent>[]) =>
    events.map((e) => (e.event.kind === "message" ? e.event.messageIndex : -1));
const messageIndexes = () => indexes(serverEventsStore.value);

// #9981: nothing loaded for an earlier selection reaches the selected chat's stores
describe("the selected chat's events", () => {
    let client: OpenChat;
    // the responses the worker hasn't sent yet, in the order they were asked for
    let pending: (() => void)[];
    // what the worker sends for each chat's next window, and whether it holds it back
    let responses: { resp: EventsResponse<ChatEvent>; held: boolean }[];

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        // the users seen in the events are looked up through the worker, which never answers here
        vi.spyOn(OpenChat.prototype, "getMissingUsers").mockResolvedValue(undefined as never);
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatA, groupChat(chatA));
        chats.set(chatB, groupChat(chatB));
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());
        pending = [];
        responses = [];
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(() => {
            const next = responses.shift();
            if (next === undefined) throw new Error("no response queued");
            return new Stream((resolve) => {
                const send = () => resolve(next.resp, true);
                if (next.held) {
                    pending.push(send);
                } else {
                    setTimeout(send, 0);
                }
            }) as never;
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        // a new visit to whatever is selected, which starts with no events
        startChatVisit(selectedChatIdStore.value);
    });

    const settle = () => new Promise((r) => setTimeout(r, 10));

    test("a window that arrives after the user has moved to another chat leaves it alone", async () => {
        select(chatA);
        // contiguous with what will be loaded next, so nothing but the visit can keep it out
        responses.push({ resp: eventWindow(13), held: true });
        client.loadEventWindow(chatA, 2, undefined, false);
        await settle();

        select(chatB);
        responses.push({ resp: eventWindow(10), held: false });
        client.loadEventWindow(chatB, 11, undefined, false);
        await settle();
        expect(messageIndexes()).toEqual([10, 11, 12]);

        pending.forEach((send) => send());
        await settle();

        expect(messageIndexes()).toEqual([10, 11, 12]);
    });

    test("a window from an earlier visit to the same chat is not applied to a later one", async () => {
        select(chatA);
        // contiguous with what will be loaded next, so nothing but the visit can keep it out, and
        // with expired ranges, since stale ones are what leave a chat empty
        responses.push({ resp: eventWindow(13, [{ start: 30, end: 35 }]), held: true });
        client.loadEventWindow(chatA, 2, undefined, false);
        await settle();

        select(chatB);
        select(chatA);
        responses.push({ resp: eventWindow(10), held: false });
        client.loadEventWindow(chatA, 11, undefined, false);
        await settle();
        expect(messageIndexes()).toEqual([10, 11, 12]);

        pending.forEach((send) => send());
        await settle();

        expect(messageIndexes()).toEqual([10, 11, 12]);
        expect(expiredServerEventRanges.value.length).toBe(0);
    });

    test("earlier messages loaded for an earlier visit are not applied to a later one", async () => {
        select(chatA);
        responses.push({ resp: eventWindow(13, [{ start: 30, end: 35 }]), held: true });
        client.loadPreviousMessages(chatA);
        await settle();

        select(chatB);
        select(chatA);
        responses.push({ resp: eventWindow(10), held: false });
        client.loadEventWindow(chatA, 11, undefined, false);
        await settle();

        pending.forEach((send) => send());
        await settle();

        expect(messageIndexes()).toEqual([10, 11, 12]);
        expect(expiredServerEventRanges.value.length).toBe(0);
    });

    test("thread events from an earlier visit to the thread are not applied to a later one", async () => {
        select(chatA);
        selectedThreadIdStore.set({ chatId: chatA, threadRootMessageIndex: 1 });
        responses.push({ resp: eventWindow(13), held: true });
        client.loadThreadMessages(chatA, [0, 40], 13, true, 1);
        await settle();

        selectedThreadIdStore.set({ chatId: chatA, threadRootMessageIndex: 2 });
        selectedThreadIdStore.set({ chatId: chatA, threadRootMessageIndex: 1 });
        responses.push({ resp: eventWindow(10), held: false });
        client.loadThreadMessages(chatA, [0, 40], 10, true, 1);
        await settle();
        expect(indexes(serverThreadEventsStore.value)).toEqual([10, 11, 12]);

        pending.forEach((send) => send());
        await settle();

        expect(indexes(serverThreadEventsStore.value)).toEqual([10, 11, 12]);
    });

    test("reopening the thread that is open starts a new visit to it", async () => {
        select(chatA);
        const root = messageEvent(1, 1) as unknown as EventWrapper<Message>;
        client.openThread(chatA, root, true);
        responses.push({ resp: eventWindow(13), held: true });
        client.loadThreadMessages(chatA, [0, 40], 13, true, 1);
        await settle();

        client.openThread(chatA, root, true);
        responses.push({ resp: eventWindow(10), held: false });
        client.loadThreadMessages(chatA, [0, 40], 10, true, 1);
        await settle();

        pending.forEach((send) => send());
        await settle();

        expect(indexes(serverThreadEventsStore.value)).toEqual([10, 11, 12]);
    });

    // Mobile's thread previews open a thread in a chat which isn't selected
    test("a thread opened in a chat that isn't selected loads", async () => {
        select(chatB);
        const root = messageEvent(1, 1) as unknown as EventWrapper<Message>;
        client.openThread(chatA, root, true);
        responses.push({ resp: eventWindow(10), held: false });
        client.loadThreadMessages(chatA, [0, 40], 10, true, 1);
        await settle();

        expect(indexes(serverThreadEventsStore.value)).toEqual([10, 11, 12]);
    });

    // A reply sent in a thread opened from mobile's thread previews is confirmed there
    test("events for a thread open in a chat that isn't selected go to that thread", () => {
        select(chatB);
        startThreadVisit({ chatId: chatA, threadRootMessageIndex: 1 });

        expect(eventsVisitFor(chatA, 1)?.current).toBe(true);
    });
});

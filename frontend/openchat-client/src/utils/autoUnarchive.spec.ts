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
    ChatSet,
    subscribe,
    type CommunityIdentifier,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "../config";
import { OpenChat } from "../openchat";
import { allChatsStore, localUpdates, routeStore, serverDirectChatsStore } from "../state";
import { MessagesRead, messagesRead } from "../state/unread/markRead";
import { WorkerAgent } from "../workerAgent";
import { unarchiveChatsWithUnread } from "./autoUnarchive";

// After a sync answer, the client brings archived chats with unread messages out of the archive,
// in every scope, in one request, and says once if that fails.

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
    } as unknown as OpenChatConfig;
}

const direct = (userId: string): DirectChatIdentifier => ({ kind: "direct_chat", userId });
const community: CommunityIdentifier = { kind: "community", communityId: "aaaaa-aa" };

// A DM whose latest message is index 5, read up to `readUpTo`
function directChat(userId: string, archived: boolean, readUpTo: number): DirectChatSummary {
    const read = new MessagesRead();
    read.readUpTo = readUpTo;
    messagesRead.value.serverState.set(direct(userId), read);
    return {
        kind: "direct_chat",
        id: direct(userId),
        them: direct(userId),
        latestMessage: { event: { messageIndex: 5, content: { kind: "text_content", text: "" } } },
        membership: { archived, mentions: [], latestThreads: [] },
    } as unknown as DirectChatSummary;
}

const archived = (userId: string) => allChatsStore.value.get(direct(userId))?.membership.archived;

describe("unarchiving archived chats that have unread messages", () => {
    let client: OpenChat;
    let requests: WorkerRequest[];
    let answer: (ok: boolean) => void;
    let failures: number;
    let unsubscribe: () => void;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        requests = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            if (req.kind !== "unarchiveChats") return new Promise(() => {});
            requests.push(req);
            return new Promise((resolve) => {
                answer = (ok) => resolve({ kind: ok ? "success" : "failure" });
            });
        }) as never);
        const chats = new ChatMap<DirectChatSummary>();
        for (const chat of [
            directChat("a", true, 2),
            directChat("b", true, 0),
            directChat("read", true, 5),
            directChat("open", false, 0),
        ]) {
            chats.set(chat.id, chat);
        }
        serverDirectChatsStore.set(chats);
        // a community is open, so none of these DMs is in the scoped chat list
        routeStore.set({ kind: "home_route", scope: { kind: "community", id: community } });
        failures = 0;
        unsubscribe = subscribe("unarchiveChatFailed", () => failures++);
        client = new OpenChat(config());
    });

    afterEach(() => {
        unsubscribe();
        localUpdates.clearAll();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function run(inFlight = new ChatSet()) {
        return unarchiveChatsWithUnread(
            [direct("a"), direct("b"), direct("read"), direct("open"), direct("unknown")],
            inFlight,
            (chatIds) => client.unarchiveChats(chatIds),
        );
    }

    test("sends one request for every archived chat with unread messages, outside the open scope too", async () => {
        const done = run();
        expect(requests).toEqual([{ kind: "unarchiveChats", chatIds: [direct("a"), direct("b")] }]);
        expect([archived("a"), archived("b"), archived("read")]).toEqual([false, false, true]);
        answer(true);
        await done;
        expect(failures).toBe(0);
    });

    test("a failed request puts every chat back in the archive and is reported once", async () => {
        const done = run();
        answer(false);
        await done;
        expect([archived("a"), archived("b")]).toEqual([true, true]);
        expect(failures).toBe(1);
    });

    // The optimistic unarchive alone already keeps a second answer from asking again; the
    // in-flight set is a second guard, so this pins the behaviour rather than the set
    test("a chat is asked once while its request is in flight, and again once it settles", async () => {
        const inFlight = new ChatSet();
        const first = run(inFlight);
        void run(inFlight);
        expect(requests).toHaveLength(1);
        answer(false);
        await first;
        void run(inFlight);
        expect(requests).toHaveLength(2);
    });
});

// Selecting an archived chat (from search, say) takes it out of the archive too, and a failure
// there reaches the same `unarchiveChatFailed` toast every tree shows
describe("unarchiving a chat by selecting it", () => {
    let client: OpenChat;
    let requests: WorkerRequest[];
    let answers: ((ok: boolean) => void)[];
    let failures: number;
    let unsubscribe: () => void;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        requests = [];
        answers = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            if (req.kind !== "unarchiveChats") return new Promise(() => {});
            requests.push(req);
            return new Promise((resolve) => {
                answers.push((ok) => resolve({ kind: ok ? "success" : "failure" }));
            });
        }) as never);
        const chats = new ChatMap<DirectChatSummary>();
        const chat = directChat("a", true, 2);
        chats.set(chat.id, chat);
        serverDirectChatsStore.set(chats);
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId: direct("a"),
            chatType: "direct_chat",
            open: false,
        });
        failures = 0;
        unsubscribe = subscribe("unarchiveChatFailed", () => failures++);
        client = new OpenChat(config());
    });

    afterEach(() => {
        unsubscribe();
        localUpdates.clearAll();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const settled = () => new Promise((resolve) => setTimeout(resolve));

    test("1. a failed un-archive on select is reported once and the chat stays archived", async () => {
        void client.setSelectedChat(direct("a"));
        expect(requests).toEqual([{ kind: "unarchiveChats", chatIds: [direct("a")] }]);
        answers[0](false);
        await settled();
        expect(archived("a")).toBe(true);
        expect(failures).toBe(1);
    });

    test("2. selecting a chat whose auto-unarchive is in flight asks once and reports once", async () => {
        void unarchiveChatsWithUnread([direct("a")], new ChatSet(), (chatIds) =>
            client.unarchiveChats(chatIds),
        );
        void client.setSelectedChat(direct("a"));
        expect(requests).toHaveLength(1);
        answers.forEach((answer) => answer(false));
        await settled();
        expect(failures).toBe(1);
    });
});

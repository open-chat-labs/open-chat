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
    ErrorCode,
    anonymousUser,
    subscribe,
    type GroupChatSummary,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, routeStore, serverGroupChatsStore } from "./state";
import { messagesRead } from "./state/unread/markRead";
import { WorkerAgent } from "./workerAgent";

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

const viewed = { kind: "group_chat" as const, groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" };
const other = { kind: "group_chat" as const, groupId: "ryjl3-tyaaa-aaaaa-aaaba-cai" };

describe("leaving, deleting and archiving", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let response: unknown;
    let urls: string[];
    let unsubscribe: () => void;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId: viewed,
            chatType: "group_chat",
            open: false,
        });
        const chats = new ChatMap<GroupChatSummary>();
        for (const id of [viewed, other]) {
            chats.set(id, {
                kind: "group_chat",
                id,
                membership: { archived: false },
            } as unknown as GroupChatSummary);
        }
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());
        sent = [];
        response = { kind: "success" };
        urls = [];
        unsubscribe = subscribe("navigateTo", ({ url }) => urls.push(url));
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return req.kind === "leaveGroup" || req.kind === "archiveChat"
                ? Promise.resolve(response)
                : new Promise(() => {});
        }) as never);
    });

    afterEach(() => {
        unsubscribe();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        serverGroupChatsStore.set(new ChatMap());
    });

    // 4b invariant 2: leaving or deleting a chat the user isn't viewing never changes the route
    test("leaving a chat that isn't open leaves the route alone", async () => {
        response = { kind: "error", code: 0 };

        await client.leaveOrDelete({ kind: "leave", chatId: other });

        expect(urls).toEqual([]);
    });

    // 4b invariant 2: one being viewed is left first and returned to if the call fails
    test("leaving the open chat goes to its list first and back when it fails", async () => {
        response = { kind: "error", code: 0 };

        await client.leaveOrDelete({ kind: "leave", chatId: viewed });

        expect(urls).toEqual(["/chats", `/chats/group/${viewed.groupId}`]);
    });

    test("leaving the open chat stays on the list when it succeeds", async () => {
        await client.leaveOrDelete({ kind: "leave", chatId: viewed });

        expect(urls).toEqual(["/chats"]);
    });

    // 4b invariant 3: the sole owner's failed leave says so
    test("the last owner's failed leave says they can't leave", async () => {
        response = { kind: "error", code: ErrorCode.LastOwnerCannotLeave };

        expect(await client.leaveOrDelete({ kind: "leave", chatId: other })).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "ownerCantLeave" }),
        });
    });

    // 4b invariant 1: archiving marks the chat read first, or the client's auto-unarchive brings
    // a chat with unread messages straight back
    test("archiving marks the chat read before it's archived", async () => {
        const order: string[] = [];
        vi.spyOn(messagesRead, "markAllRead").mockImplementation(() => {
            order.push("read");
        });
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            order.push(req.kind);
            return Promise.resolve({ kind: "success" });
        }) as never);

        await client.archiveChat(other);

        expect(order.indexOf("read")).toBeGreaterThanOrEqual(0);
        expect(order.indexOf("read")).toBeLessThan(order.indexOf("archiveChat"));
    });
});

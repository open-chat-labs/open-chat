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
    CommunityMap,
    ErrorCode,
    ROLE_MEMBER,
    anonymousUser,
    subscribe,
    type CommunitySummary,
    type GroupChatSummary,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    rightPanelHistory,
    routeStore,
    serverCommunitiesStore,
    serverGroupChatsStore,
} from "./state";
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
// archived by the last test; the others leave chats, which stay gone for the rest of the file
const toArchive = { kind: "group_chat" as const, groupId: "r7inp-6aaaa-aaaaa-aaabq-cai" };
const community = { kind: "community" as const, communityId: "qhbym-qaaaa-aaaaa-aaafq-cai" };

// the client leaves only a community it holds
function withCommunity() {
    const communities = new CommunityMap<CommunitySummary>();
    communities.set(community, {
        kind: "community",
        id: community,
        membership: { role: ROLE_MEMBER },
    } as unknown as CommunitySummary);
    serverCommunitiesStore.set(communities);
}

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
        for (const id of [viewed, other, toArchive]) {
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
            return req.kind === "leaveGroup" ||
                req.kind === "leaveCommunity" ||
                req.kind === "archiveChat"
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
        serverCommunitiesStore.set(new CommunityMap());
        rightPanelHistory.set([]);
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

    // and once it's gone, so are its details in the right column
    test("leaving the open chat stays on the list and clears its details when it succeeds", async () => {
        rightPanelHistory.set([{ kind: "group_details" }]);

        await client.leaveOrDelete({ kind: "leave", chatId: viewed });

        expect(urls).toEqual(["/chats"]);
        expect(rightPanelHistory.value).toEqual([]);
    });

    test("leaving a chat that isn't open keeps the open chat's details", async () => {
        rightPanelHistory.set([{ kind: "group_details" }]);

        await client.leaveOrDelete({ kind: "leave", chatId: other });

        expect(rightPanelHistory.value).toEqual([{ kind: "group_details" }]);
    });

    // 4b invariant 2, for a community: the route only moves when the community is the scope
    test("leaving a community that isn't the scope leaves the route alone", async () => {
        withCommunity();
        response = { kind: "error", code: 0 };

        await client.leaveOrDelete({ kind: "leave_community", id: community });

        expect(urls).toEqual([]);
    });

    test("leaving the community in scope goes away first and back when it fails", async () => {
        withCommunity();
        routeStore.set({
            kind: "selected_community_route",
            communityId: community,
            scope: { kind: "community", id: community },
        });
        response = { kind: "error", code: 0 };

        await client.leaveOrDelete({ kind: "leave_community", id: community });

        expect(urls.length).toBe(2);
        expect(urls[0]).not.toBe(`/community/${community.communityId}`);
        expect(urls[1]).toBe(`/community/${community.communityId}`);
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

        await client.archiveChat(toArchive);

        expect(order.indexOf("read")).toBeGreaterThanOrEqual(0);
        expect(order.indexOf("read")).toBeLessThan(order.indexOf("archiveChat"));
    });
});

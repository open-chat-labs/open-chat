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
    MessageContextMap,
    ROLE_OWNER,
    Stream,
    subscribe,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type EventWrapper,
    type Message,
    type SyncSinceResponse,
    type UpdatesResult,
    type UserSummary,
    type UsersResponse,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { chatsInitialisedStore, localUpdates, routeStore, serverDirectChatsStore } from "./state";
import { userStore } from "./state/users/state";
import { WorkerAgent } from "./workerAgent";

// When the other user in a direct chat is migrated to a MultiUser canister, the chat is moved onto
// their new id. The worker finds the move, moves what it has cached for the chat, and says so in its
// answer, alongside the chat under the old id being removed and the one under the new id being
// added. The client follows the chat there, and moves what it holds for it. A link to the chat under
// the old id is looked up by the client, which the UserIndex maps to the new id.

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

function directChat(userId: string): DirectChatSummary {
    return {
        kind: "direct_chat",
        id: direct(userId),
        them: direct(userId),
        readByThemUpTo: undefined,
        dateCreated: 0n,
        latestEventIndex: 0,
        latestMessageIndex: undefined,
        latestMessage: undefined,
        lastUpdated: 1000n,
        eventsTTL: undefined,
        eventsTtlLastUpdated: 0n,
        metrics: {},
        membership: {
            role: ROLE_OWNER,
            archived: false,
            pinned: false,
            readByMeUpTo: undefined,
            notificationsMuted: false,
            atEveryoneMuted: false,
            mentions: [],
            latestThreads: [],
            myMetrics: {},
            lapsed: false,
            rulesAccepted: false,
        },
    } as unknown as DirectChatSummary;
}

function user(userId: string): UserSummary {
    return {
        kind: "user",
        userId,
        username: userId,
        displayName: undefined,
        updated: 1n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    } as unknown as UserSummary;
}

function failedMessage(messageId: bigint): EventWrapper<Message> {
    return {
        kind: "event",
        index: 0,
        timestamp: 0n,
        event: { kind: "message", messageId, messageIndex: 0 },
    } as unknown as EventWrapper<Message>;
}

function updates(
    added: DirectChatSummary[],
    removed: string[],
    moved: [string, string][] = [],
): UpdatesResult {
    return {
        directChatsAddedUpdated: added,
        directChatsRemoved: removed,
        directChatsMoved: new Map(moved),
        groupsAddedUpdated: [],
        groupsRemoved: [],
        communitiesAddedUpdated: [],
        communitiesRemoved: [],
        avatarId: undefined,
        blockedUsers: undefined,
        pinnedChats: undefined,
        pinnedChannels: undefined,
        pinnedFavouriteChats: undefined,
        favouriteChats: undefined,
        pinNumberSettings: undefined,
        achievements: undefined,
        chitState: undefined,
        referrals: undefined,
        walletConfig: undefined,
        messageActivitySummary: undefined,
        installedBots: undefined,
        bitcoinAddress: undefined,
        oneSecAddress: undefined,
        streakInsurance: undefined,
        updatedEvents: new Map(),
        suspensionChanged: undefined,
        newAchievements: [],
        premiumItems: undefined,
    } as unknown as UpdatesResult;
}

function selectChat(chatId: DirectChatIdentifier, messageIndex?: number, open = false) {
    routeStore.set({
        kind: "global_chat_selected_route",
        scope: { kind: "chats" },
        chatId,
        chatType: "direct_chat",
        messageIndex,
        open,
    });
}

describe("a direct chat moved onto the other user's new id", () => {
    let client: OpenChat;
    // Each earlier id the UserIndex knows of, mapped to the user's latest id
    let migrated: Map<string, string>;
    let snapshot: SyncSinceResponse | undefined;
    let navigations: { url: string; intent?: string }[];
    let invalidated: number;
    // Each user id the UserIndex was asked for
    let usersAskedFor: string[];
    let unsubscribes: (() => void)[];

    function answerGetUsers(userIds: string[]): UsersResponse {
        const migratedUserIds = new Map<string, string>();
        const users: UserSummary[] = [];
        for (const userId of userIds) {
            const latest = migrated.get(userId) ?? userId;
            if (latest !== userId) {
                migratedUserIds.set(userId, latest);
            }
            users.push(user(latest));
        }
        return {
            users,
            deletedUserIds: new Set(),
            migratedUserIds: migratedUserIds.size > 0 ? migratedUserIds : undefined,
        };
    }

    // Has the client fold the updates into what it holds, as it does for an answer to its poll
    async function fold(answer: UpdatesResult) {
        snapshot = { userId: "me", version: 1, updates: answer };
        client.resumeEventLoop();
        await vi.waitFor(() => expect(snapshot).toBeUndefined());
        // Then let the fold, which takes a few turns, finish
        await new Promise((r) => setTimeout(r, 10));
        client.pauseEventLoop();
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        chatsInitialisedStore.set(true);
        client = new OpenChat(config());

        migrated = new Map();
        snapshot = undefined;
        navigations = [];
        invalidated = 0;
        usersAskedFor = [];
        unsubscribes = [
            subscribe("navigateTo", (ev) => navigations.push(ev)),
            subscribe("selectedChatInvalid", () => invalidated++),
        ];

        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            if (req.kind === "getUpdates") {
                const answer = snapshot;
                snapshot = undefined;
                // Answered once the client has subscribed
                return new Stream((resolve) => setTimeout(() => resolve(answer, true), 0));
            }
            return new Stream(() => {});
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getUsers": {
                    const userIds = req.users.userGroups.flatMap((g) => g.users);
                    usersAskedFor.push(...userIds);
                    return Promise.resolve(answerGetUsers(userIds));
                }
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        unsubscribes.forEach((unsub) => unsub());
        client.pauseEventLoop();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        serverDirectChatsStore.set(new ChatMap<DirectChatSummary>());
        chatsInitialisedStore.set(false);
    });

    test("an open chat the worker found moved is followed onto the new id, with what's held for it", async () => {
        serverDirectChatsStore.set(ChatMap.fromList([directChat("old1")]));
        selectChat(direct("old1"));
        localUpdates.draftMessages.setTextContent({ chatId: direct("old1") }, "half written");
        const failed = new MessageContextMap<Map<bigint, EventWrapper<Message>>>();
        failed.set({ chatId: direct("old1") }, new Map([[9n, failedMessage(9n)]]));
        localUpdates.initialiseFailedMessages(failed);

        await fold(updates([directChat("new1")], ["old1"], [["old1", "new1"]]));

        expect(navigations).toEqual([{ url: "/chats/user/new1", intent: "auto" }]);
        expect(invalidated).toBe(0);
        expect(localUpdates.draftMessages.value.get({ chatId: direct("new1") })?.textContent).toBe(
            "half written",
        );
        expect(localUpdates.draftMessages.value.get({ chatId: direct("old1") })).toBeUndefined();
        expect(
            localUpdates
                .failedMessagesForContext({ chatId: direct("new1") })
                .map((m) => m.event.messageId),
        ).toEqual([9n]);
        expect(localUpdates.anyFailed({ chatId: direct("old1") })).toBe(false);
        // Their messages from before the move refer to them by the old id
        expect(userStore.latestUserId("old1")).toBe("new1");
        // The worker found the move, so there's nothing for the client to look up
        expect(usersAskedFor).not.toContain("old1");
    });

    test("an open chat which was deleted, not moved, is left", async () => {
        serverDirectChatsStore.set(ChatMap.fromList([directChat("gone2")]));
        selectChat(direct("gone2"));

        await fold(updates([], ["gone2"]));

        expect(navigations).toEqual([]);
        expect(invalidated).toBe(1);
    });

    test("an open chat the worker didn't find moved is left, even if its user has since been migrated", async () => {
        // As when both were kept, the chat under the new id having come first, and the one under
        // the old id is then deleted
        migrated.set("old6", "new6");
        serverDirectChatsStore.set(ChatMap.fromList([directChat("old6"), directChat("new6")]));
        selectChat(direct("old6"));
        localUpdates.draftMessages.setTextContent(
            { chatId: direct("old6") },
            "in the deleted chat",
        );

        await fold(updates([directChat("new6")], ["old6"]));

        expect(navigations).toEqual([]);
        expect(invalidated).toBe(1);
        expect(localUpdates.draftMessages.value.get({ chatId: direct("new6") })).toBeUndefined();
    });

    test("an open thread in a moved chat is still open under the new id", async () => {
        serverDirectChatsStore.set(ChatMap.fromList([directChat("old5")]));
        selectChat(direct("old5"), 7, true);

        await fold(updates([directChat("new5")], ["old5"], [["old5", "new5"]]));

        expect(navigations).toEqual([{ url: "/chats/user/new5/7?open=true", intent: "auto" }]);
    });

    test("an old link to a moved chat goes to the chat under the new id, at the same message", async () => {
        migrated.set("old3", "new3");
        serverDirectChatsStore.set(ChatMap.fromList([directChat("new3")]));
        selectChat(direct("old3"), 5);

        await client.setSelectedChat(direct("old3"), 5);

        expect(navigations).toEqual([{ url: "/chats/user/new3/5", intent: "auto" }]);
        expect(localUpdates.anyUninitialisedDirectChats()).toBe(false);
    });

    test("an old link isn't followed if another chat was chosen while the user was looked up", async () => {
        migrated.set("old4", "new4");
        serverDirectChatsStore.set(ChatMap.fromList([directChat("new4")]));
        selectChat(direct("old4"));

        const selecting = client.setSelectedChat(direct("old4"));
        selectChat(direct("new4"));
        await selecting;

        expect(navigations).toEqual([]);
    });
});

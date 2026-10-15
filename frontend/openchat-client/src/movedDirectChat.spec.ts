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
    type AccountTransaction,
    ROLE_OWNER,
    Stream,
    subscribe,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type UserSummary,
    type UsersResponse,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { chatsInitialisedStore, localUpdates, routeStore, serverDirectChatsStore } from "./state";
import { WorkerAgent } from "./workerAgent";

// When the other user in a direct chat was migrated to a MultiUser canister, the chat was moved onto
// their new id. A link to the chat under the old id is looked up by the client, which the UserIndex
// maps to the new id, as it does for the old id in a referral link or a transfer made before then.

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

function selectChat(chatId: DirectChatIdentifier, messageIndex?: number) {
    routeStore.set({
        kind: "global_chat_selected_route",
        scope: { kind: "chats" },
        chatId,
        chatType: "direct_chat",
        messageIndex,
        open: false,
    });
}

describe("an id a user had before being migrated to a MultiUser canister", () => {
    let client: OpenChat;
    // Each earlier id the UserIndex knows of, mapped to the user's latest id
    let migrated: Map<string, string>;
    // The latest ids of users who've since been deleted
    let deleted: Set<string>;
    let transactions: AccountTransaction[];
    let navigations: { url: string; intent?: string }[];
    let notFound: number;
    let unsubscribes: (() => void)[];

    function answerGetUsers(userIds: string[]): UsersResponse {
        const migratedUserIds = new Map<string, string>();
        const deletedUserIds = new Set<string>();
        const users: UserSummary[] = [];
        for (const userId of userIds) {
            const latest = migrated.get(userId) ?? userId;
            if (deleted.has(latest)) {
                // The UserIndex returns a deleted user under the id they were asked for
                deletedUserIds.add(userId);
                continue;
            }
            if (latest !== userId) {
                migratedUserIds.set(userId, latest);
            }
            users.push(user(latest));
        }
        return {
            users,
            deletedUserIds,
            migratedUserIds: migratedUserIds.size > 0 ? migratedUserIds : undefined,
        };
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        chatsInitialisedStore.set(true);
        client = new OpenChat(config());

        migrated = new Map();
        deleted = new Set();
        transactions = [];
        navigations = [];
        notFound = 0;
        unsubscribes = [
            subscribe("navigateTo", (ev) => navigations.push(ev)),
            subscribe("notFound", () => notFound++),
        ];

        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(
            (() => new Stream(() => {})) as never,
        );
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getUsers":
                    return Promise.resolve(
                        answerGetUsers(req.users.userGroups.flatMap((g) => g.users)),
                    );
                case "getAccountTransactions":
                    return Promise.resolve({ kind: "success", transactions });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        unsubscribes.forEach((unsub) => unsub());
        client.pauseEventLoop();
        client.clearReferralCode();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        serverDirectChatsStore.set(new ChatMap<DirectChatSummary>());
        chatsInitialisedStore.set(false);
    });

    test("an old link to a moved chat goes to the chat under the new id, at the same message", async () => {
        migrated.set("old3", "new3");
        serverDirectChatsStore.set(ChatMap.fromList([directChat("new3")]));
        selectChat(direct("old3"), 5);

        await client.setSelectedChat(direct("old3"), 5);

        expect(navigations).toEqual([{ url: "/chats/user/new3/5", intent: "auto" }]);
        expect(localUpdates.anyUninitialisedDirectChats()).toBe(false);
    });

    test("an old link to a user with no chat yet starts one under their latest id", async () => {
        migrated.set("old6", "new6");
        selectChat(direct("old6"));

        await client.setSelectedChat(direct("old6"));

        expect(navigations).toEqual([{ url: "/chats/user/new6", intent: "auto" }]);
        expect(localUpdates.removeUninitialisedDirectChat(direct("old6"))).toBe(false);
        expect(localUpdates.removeUninitialisedDirectChat(direct("new6"))).toBe(true);
    });

    test("an old link to a user who has since been deleted isn't found", async () => {
        migrated.set("old7", "new7");
        deleted.add("new7");
        selectChat(direct("old7"));

        await client.setSelectedChat(direct("old7"));

        expect(notFound).toBe(1);
        expect(navigations).toEqual([]);
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

    test("an old referral link shows the referrer under their latest id", async () => {
        migrated.set("old5", "new5");
        client.setReferralCode("old5");

        expect((await client.getReferringUser())?.userId).toBe("new5");
    });

    test("a transfer made before the other user was migrated names them by their latest id", async () => {
        migrated.set("old8", "new8");
        migrated.set("old9", "new9");
        const common = { timestamp: new Date(0), amount: 1n };
        transactions = [
            { ...common, kind: "transfer", id: 1n, from: "old8", to: "someone" },
            { ...common, kind: "mint", id: 2n, to: "old9" },
            { ...common, kind: "burn", id: 3n, from: "someone" },
        ];

        const result = await client.getAccountTransactions("ledgerIndex");

        expect(result.kind === "success" && result.transactions).toEqual([
            { ...common, kind: "transfer", id: 1n, from: "new8", to: "someone" },
            { ...common, kind: "mint", id: 2n, from: undefined, to: "new9" },
            { ...common, kind: "burn", id: 3n, from: "someone", to: undefined },
        ]);
    });
});

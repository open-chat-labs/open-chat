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
    CommunityMap,
    ROLE_MEMBER,
    anonymousUser,
    publish,
    type AttachmentContent,
    type ChannelIdentifier,
    type ChannelSummary,
    type CommunityIdentifier,
    type CommunitySummary,
    type RulesAcceptanceResolver,
    type SendMessageOutcome,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    localUpdates,
    pinNumberRequiredStore,
    pinNumberResolverStore,
    routeStore,
    serverCommunitiesStore,
} from "./state";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { currentChatVisit, startChatVisit } from "./state/selectedChat";
import { captureRulesAcceptanceStore } from "./stores/rules";
import { mostRecentStore } from "./stores/throttling";
import { WorkerAgent } from "./workerAgent";

// Sending from the composer settles once the message shows in the chat, or when it's refused
// before that, and the composer keeps the draft unless it was posted.

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

const here: CommunityIdentifier = { kind: "community", communityId: "aaaaa-aa" };
const chatId: ChannelIdentifier = { kind: "channel", communityId: here.communityId, channelId: 1 };
const context = { chatId };

function community(chatRulesAccepted: boolean): CommunitySummary {
    return {
        kind: "community",
        id: here,
        channels: [
            {
                kind: "channel",
                id: chatId,
                name: "c",
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
                    rulesAccepted: chatRulesAccepted,
                    latestThreads: [],
                    mentions: [],
                },
                gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
                permissions: {},
                level: "channel",
                lastUpdated: 0n,
                memberCount: 2,
                frozen: false,
                historyVisible: true,
            } as unknown as ChannelSummary,
        ],
        membership: { role: ROLE_MEMBER, archived: false, pinned: [], index: 0, rulesAccepted: true },
        lastUpdated: 0n,
    } as unknown as CommunitySummary;
}

const transfer = {
    kind: "crypto_content",
    transfer: { kind: "pending", ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai", amountE8s: 1n },
} as unknown as AttachmentContent;

describe("sending from the composer", () => {
    let client: OpenChat;
    // what reached the worker
    let sent: WorkerRequest[];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        sent = [];
        // the worker never answers: a send that settles did so on posting, not on its result
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            if (req.kind === "sendMessage") sent.push(req);
            return { subscribe: () => {} };
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(
            (() => new Promise(() => {})) as never,
        );
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(true));
        serverCommunitiesStore.set(communities);
        routeStore.set({
            kind: "selected_channel_route",
            scope: { kind: "community", id: here },
            communityId: here,
            chatId,
            open: false,
        });
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        captureRulesAcceptanceStore.set(undefined);
        pinNumberRequiredStore.set(undefined);
        pinNumberResolverStore.set(undefined);
        mostRecentStore.set([]);
        serverCommunitiesStore.set(new CommunityMap());
        localUpdates.draftMessages.delete(context);
        currentChatVisit()?.setDetails(undefined);
        startChatVisit(undefined);
    });

    // the chat has rules the user hasn't accepted
    function withRules() {
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(false));
        serverCommunitiesStore.set(communities);
        startChatVisit(chatId);
        currentChatVisit()?.setDetails(
            new ChatDetailsState(
                chatId,
                0n,
                new Map(),
                new Set(),
                new Set(),
                new Set(),
                new Set(),
                new Map(),
                new Map(),
                { text: "be nice", enabled: true, version: 1 },
            ),
        );
    }

    // the prompt to accept the rules, if one is showing
    function rulesPrompt(): RulesAcceptanceResolver | undefined {
        let resolver: RulesAcceptanceResolver | undefined;
        captureRulesAcceptanceStore.subscribe((r) => (resolver = r))();
        return resolver;
    }

    function send(attachment?: AttachmentContent): Promise<SendMessageOutcome> {
        return client.sendMessage(context, "hello", false, attachment, []);
    }

    // a promise's outcome so far, without waiting for it
    async function settled<T>(p: Promise<T>): Promise<T | "pending"> {
        await vi.advanceTimersByTimeAsync(0);
        return Promise.race([p, Promise.resolve("pending" as const)]);
    }

    /** Invariant 3: posted means this send's message is in the chat, before the worker answers. */
    test("is posted once the message shows, before the result", async () => {
        expect(await settled(send())).toEqual({ kind: "posted" });
        expect(sent).toHaveLength(1);
    });

    /** Invariant 3: another message showing in the same chat (someone else's, a bot's) isn't this
     * send being posted. */
    test("isn't posted by another message showing in the chat", async () => {
        withRules();
        const result = send();
        publish("sendingMessage", context);
        // still waiting on the rules
        expect(await settled(result)).toBe("pending");
        rulesPrompt()?.resolve(false);
        expect(await settled(result)).toEqual({ kind: "rules_declined" });
    });

    /** Invariant 2: refused before posting, nothing reaches the worker. */
    test("the rules turned down send nothing", async () => {
        withRules();
        const result = send();
        await vi.advanceTimersByTimeAsync(0);
        rulesPrompt()?.resolve(false);
        expect(await settled(result)).toEqual({ kind: "rules_declined" });
        expect(sent).toHaveLength(0);
    });

    /** Invariants 2 and 5: a dismissed PIN prompt is an outcome, not a rejection, and sends nothing. */
    test("a dismissed PIN prompt sends nothing", async () => {
        pinNumberRequiredStore.set(true);
        const result = send(transfer);
        await vi.advanceTimersByTimeAsync(0);
        pinNumberResolverStore.value?.reject();
        expect(await settled(result)).toEqual({ kind: "pin_cancelled" });
        expect(sent).toHaveLength(0);
    });

    /** Invariant 2: throttled, nothing reaches the worker. */
    test("throttled sends nothing", async () => {
        mostRecentStore.set(Array.from({ length: 100 }, () => Date.now()));
        expect(await settled(send())).toEqual({ kind: "throttled" });
        expect(sent).toHaveLength(0);
    });

    /** Invariant 1: a second send from the chat while one is on its way sends nothing. */
    test("a second send while one is on its way is busy", async () => {
        pinNumberRequiredStore.set(true);
        const first = send(transfer);
        expect(await settled(send())).toEqual({ kind: "busy" });
        pinNumberResolverStore.value?.resolve("1234");
        expect(await settled(first)).toEqual({ kind: "posted" });
        expect(sent).toHaveLength(1);
        // and once it's posted, the chat can send again
        expect(await settled(send())).toEqual({ kind: "posted" });
    });
});

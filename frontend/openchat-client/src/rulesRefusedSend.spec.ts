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
    CommunityMap,
    ErrorCode,
    ROLE_MEMBER,
    anonymousUser,
    type ChannelIdentifier,
    type ChannelSummary,
    type CommunityIdentifier,
    type CommunitySummary,
    type GroupChatDetailsResponse,
    type RulesAcceptanceResolver,
    type SendMessageResponse,
    type VersionedRules,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, localUpdates, routeStore, serverCommunitiesStore } from "./state";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { currentChatVisit, startChatVisit } from "./state/selectedChat";
import { captureRulesAcceptanceStore } from "./stores/rules";
import { mostRecentStore } from "./stores/throttling";
import { OfflineSendQueue } from "./utils/offlineSendQueue";
import { WorkerAgent } from "./workerAgent";

// A send the chat refuses because the user hasn't accepted rules the client took to be accepted
// (they were changed to need accepting again since it synced) asks for the latest rules and sends
// the message again once they're accepted. Only one rules prompt shows at a time, and a message
// is never sent again twice.

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

// `queueOfflineSends`: the new UIs' offline send queue
function config(queueOfflineSends = false): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
        queueOfflineSends,
    } as unknown as OpenChatConfig;
}

const here: CommunityIdentifier = { kind: "community", communityId: "aaaaa-aa" };
const chatId: ChannelIdentifier = { kind: "channel", communityId: here.communityId, channelId: 1 };
const context = { chatId };

const rules = (version: number): VersionedRules => ({
    text: `v${version}`,
    enabled: true,
    version,
});

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
        membership: {
            role: ROLE_MEMBER,
            archived: false,
            pinned: [],
            index: 0,
            rulesAccepted: true,
        },
        userGroups: new Map(),
        lastUpdated: 0n,
    } as unknown as CommunitySummary;
}

function detailsWithRules(timestamp: bigint, chatRules: VersionedRules): GroupChatDetailsResponse {
    return {
        members: [],
        blockedUsers: new Set(),
        invitedUsers: new Set(),
        pinnedMessages: new Set(),
        rules: chatRules,
        timestamp,
        bots: [],
        webhooks: [],
    };
}

const delivered = (eventIndex: number): SendMessageResponse => ({
    kind: "success",
    timestamp: BigInt(Date.now()),
    messageIndex: eventIndex,
    eventIndex,
});

const refused: SendMessageResponse = {
    kind: "error",
    code: ErrorCode.ChatRulesNotAccepted,
    message: undefined,
};

type SendRequest = Extract<WorkerRequest, { kind: "sendMessage" }>;

describe("a send refused for the rules", () => {
    let client: OpenChat;
    // the sends that reached the worker
    let sent: SendRequest[];
    // how the worker answers each send in turn; once they run out, it doesn't answer
    let answers: SendMessageResponse[];
    // the requests for the chat's details, and how they're answered
    let detailsRequests: WorkerRequest[];
    let latestDetails: () => Promise<GroupChatDetailsResponse>;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        sent = [];
        answers = [];
        detailsRequests = [];
        latestDetails = () => Promise.resolve(detailsWithRules(5n, rules(2)));
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            if (req.kind !== "sendMessage") return { subscribe: () => {} };
            sent.push(req);
            const answer = answers.shift();
            return {
                subscribe: ({ onResult }: { onResult: (r: unknown) => void }) => {
                    // after the message shows, as over the network
                    if (answer !== undefined) {
                        setTimeout(() => onResult([answer, req.event.event]), 5);
                    }
                },
            };
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            if (req.kind === "getGroupDetails") {
                detailsRequests.push(req);
                return latestDetails();
            }
            if (req.kind === "deleteFailedMessage") return Promise.resolve();
            return new Promise(() => {});
        }) as never);
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
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        captureRulesAcceptanceStore.set(undefined);
        mostRecentStore.set([]);
        // the failed messages, and the rules' acceptance the refusal cleared
        localUpdates.clearAll();
        localUpdates.draftMessages.delete(context);
        currentChatVisit()?.setDetails(undefined);
        serverCommunitiesStore.set(new CommunityMap());
        startChatVisit(undefined);
    });

    // The chat, its rules (version 1) held as accepted, as the client last synced them
    function setup() {
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(true));
        serverCommunitiesStore.set(communities);
        startChatVisit(chatId);
        currentChatVisit()?.setDetails(
            new ChatDetailsState(
                chatId,
                1n,
                new Map(),
                new Set(),
                new Set(),
                new Set(),
                new Set(),
                new Map(),
                new Map(),
                rules(1),
            ),
        );
    }

    // the prompt to accept the rules, if one is showing
    function rulesPrompt(): RulesAcceptanceResolver | undefined {
        let resolver: RulesAcceptanceResolver | undefined;
        captureRulesAcceptanceStore.subscribe((r) => (resolver = r))();
        return resolver;
    }

    function failed() {
        return localUpdates.failedMessagesForContext(context);
    }

    // A message sent from the composer, which the chat refuses for its rules
    async function sendRefused(rulesRefused: "fail" | "prompt" = "prompt") {
        answers.push(refused);
        await client.sendMessage(context, "hello", false, undefined, [], rulesRefused);
        await vi.waitFor(() => expect(failed()).toHaveLength(1));
    }

    const settle = () => new Promise((r) => setTimeout(r, 0));

    test("asks for the latest rules, from the canister, and sends the message again once they're accepted", async () => {
        setup();
        await sendRefused();

        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        expect(detailsRequests).toEqual([expect.objectContaining({ fromCanister: true })]);
        rulesPrompt()?.resolve(true);

        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(sent[1].event.event.messageId).toBe(sent[0].event.event.messageId);
        expect(sent[1].acceptedRules?.chat).toBe(2);
        expect(failed()).toHaveLength(0);
    });

    test("isn't asked about the rules held when the latest can't be loaded", async () => {
        setup();
        latestDetails = () => Promise.resolve({ kind: "failure" });
        await sendRefused();

        await vi.waitFor(() => expect(detailsRequests).toHaveLength(1));
        await settle();
        expect(rulesPrompt()).toBeUndefined();
        expect(sent).toHaveLength(1);
        expect(failed()).toHaveLength(1);
    });

    test("isn't sent again once it's been retried while the rules load", async () => {
        setup();
        let loaded = (_: GroupChatDetailsResponse) => {};
        latestDetails = () => new Promise((r) => (loaded = r));
        await sendRefused();
        await vi.waitFor(() => expect(detailsRequests).toHaveLength(1));

        // Retry, which asks about the rules held, as the refusal cleared their acceptance
        void client.retrySendMessage(context, failed()[0], "prompt");
        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        rulesPrompt()?.resolve(true);
        await vi.waitFor(() => expect(sent).toHaveLength(2));

        loaded(detailsWithRules(5n, rules(2)));
        await settle();
        await settle();
        expect(rulesPrompt()).toBeUndefined();
        expect(sent).toHaveLength(2);
    });

    test("is sent again once when retried twice while the rules are asked about", async () => {
        setup();
        await sendRefused("fail");
        const message = failed()[0];

        void client.retrySendMessage(context, message);
        void client.retrySendMessage(context, message);
        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        rulesPrompt()?.resolve(true);

        await vi.waitFor(() => expect(sent).toHaveLength(2));
        await settle();
        expect(sent).toHaveLength(2);
    });

    // The new UIs queue a message sent without a connection, and send it again once back online
    describe("with the offline send queue", () => {
        let online: boolean;
        // the client's queue, known once it has queued a message
        let queuedCalls: { mock: { contexts: unknown[] } };
        const queue = () => queuedCalls.mock.contexts[0] as OfflineSendQueue | undefined;

        beforeEach(() => {
            online = true;
            vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
            queuedCalls = vi.spyOn(OfflineSendQueue.prototype, "queued");
            client = new OpenChat(config(true));
        });

        afterEach(() => {
            queue()?.stop();
            setOnline(true);
        });

        function setOnline(value: boolean) {
            online = value;
            window.dispatchEvent(new Event(value ? "online" : "offline"));
        }

        function queuedIds(): bigint[] {
            return localUpdates.allQueuedMessages().map((q) => q.event.event.messageId);
        }

        // Messages sent offline, while the rules held are out of date: queued, nothing asked
        async function sendOffline(...texts: string[]) {
            setOnline(false);
            answers.push(CommonResponses.offline());
            // the first goes to the agent, which answers that it's offline; the rest wait behind
            // it, queued
            for (const [i, text] of texts.entries()) {
                await client.sendMessage(context, text, false, undefined, [], "prompt");
                await vi.waitFor(() => expect(queuedIds()).toHaveLength(i + 1));
            }
            expect(rulesPrompt()).toBeUndefined();
        }

        test("queued messages refused for the rules once back online ask once, and go once accepted", async () => {
            setup();
            await sendOffline("one", "two");
            const ids = queuedIds();
            const prompts = new Set<RulesAcceptanceResolver>();
            const unsubscribe = captureRulesAcceptanceStore.subscribe((r) => {
                if (r !== undefined) prompts.add(r);
            });

            // back online, the queue sends the first again, which the chat refuses
            setOnline(true);
            answers.push(refused);
            const before = sent.length;
            queue()?.start();

            await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
            // the second waits for that to settle, rather than going with the rules the chat no
            // longer takes
            await settle();
            expect(sent.length - before).toBe(1);
            expect(detailsRequests).toHaveLength(1);
            answers.push(delivered(10));
            rulesPrompt()?.resolve(true);

            // the first goes with the latest rules accepted, then the second, in that order
            await vi.waitFor(() => expect(sent.length - before).toBe(3));
            await settle();
            const [first, second] = sent.slice(before + 1);
            expect(first.event.event.messageId).toBe(ids[0]);
            expect(first.acceptedRules?.chat).toBe(2);
            expect(second.event.event.messageId).toBe(ids[1]);
            expect(sent.length - before).toBe(3);
            expect(prompts.size).toBe(1);
            unsubscribe();
        });

        test("declined, the chat's other queued messages show failed, without asking again", async () => {
            setup();
            await sendOffline("one", "two");
            setOnline(true);
            answers.push(refused);
            const before = sent.length;
            queue()?.start();

            await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
            rulesPrompt()?.resolve(false);

            await vi.waitFor(() => expect(queuedIds()).toHaveLength(0));
            await settle();
            expect(rulesPrompt()).toBeUndefined();
            expect(sent.length - before).toBe(1);
            expect(failed()).toHaveLength(2);
        });

        test("a refused message queued since (Retry offline) is left to the queue", async () => {
            setup();
            let loaded = (_: GroupChatDetailsResponse) => {};
            latestDetails = () => new Promise((r) => (loaded = r));
            await sendRefused();
            await vi.waitFor(() => expect(detailsRequests).toHaveLength(1));
            const id = failed()[0].event.messageId;

            // Retry while offline, accepting the rules held: it waits for the connection
            setOnline(false);
            answers.push(CommonResponses.offline());
            void client.retrySendMessage(context, failed()[0], "prompt");
            await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
            rulesPrompt()?.resolve(true);
            await vi.waitFor(() => expect(queuedIds()).toEqual([id]));
            const before = sent.length;

            loaded(detailsWithRules(5n, rules(2)));
            await settle();
            await settle();
            expect(rulesPrompt()).toBeUndefined();
            expect(sent).toHaveLength(before);
            expect(queuedIds()).toEqual([id]);
        });

        test("refused just as the connection goes: no prompt, it's left for Retry", async () => {
            setup();
            answers.push(refused);
            await client.sendMessage(context, "hello", false, undefined, [], "prompt");
            setOnline(false);
            await vi.waitFor(() => expect(failed()).toHaveLength(1));

            await settle();
            expect(rulesPrompt()).toBeUndefined();
            expect(detailsRequests).toHaveLength(0);
            expect(sent).toHaveLength(1);
        });
    });
});

describe("the rules prompt", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        sent = [];
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            if (req.kind === "sendMessage") sent.push(req);
            return { subscribe: () => {} };
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(
            (() => new Promise(() => {})) as never,
        );
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(false));
        serverCommunitiesStore.set(communities);
        routeStore.set({
            kind: "selected_channel_route",
            scope: { kind: "community", id: here },
            communityId: here,
            chatId,
            open: false,
        });
        client = new OpenChat(config());
        startChatVisit(chatId);
        currentChatVisit()?.setDetails(
            new ChatDetailsState(
                chatId,
                1n,
                new Map(),
                new Set(),
                new Set(),
                new Set(),
                new Set(),
                new Map(),
                new Map(),
                rules(1),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        captureRulesAcceptanceStore.set(undefined);
        mostRecentStore.set([]);
        currentChatVisit()?.setDetails(undefined);
        serverCommunitiesStore.set(new CommunityMap());
        startChatVisit(undefined);
    });

    function rulesPrompt(): RulesAcceptanceResolver | undefined {
        let resolver: RulesAcceptanceResolver | undefined;
        captureRulesAcceptanceStore.subscribe((r) => (resolver = r))();
        return resolver;
    }

    function send(text: string) {
        return client.sendMessageWithContent(
            context,
            { kind: "text_content", text },
            false,
            [],
            false,
        );
    }

    test("is shown once for sends in the same chat, whose answer they all take", async () => {
        void send("one");
        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        const prompt = rulesPrompt();
        void send("two");
        await new Promise((r) => setTimeout(r, 0));
        expect(rulesPrompt()).toBe(prompt);

        prompt?.resolve(true);

        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(rulesPrompt()).toBeUndefined();
    });

    test("declined, declines every send waiting on it", async () => {
        const first = send("one");
        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        const second = send("two");

        rulesPrompt()?.resolve(false);

        expect(await first).toEqual({ kind: "failure" });
        expect(await second).toEqual({ kind: "failure" });
        expect(sent).toHaveLength(0);
    });
});

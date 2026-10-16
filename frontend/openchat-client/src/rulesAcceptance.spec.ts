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
    Stream,
    anonymousUser,
    type ChannelIdentifier,
    type ChannelSummary,
    type ChatEvent,
    type CommunityDetailsResponse,
    type CommunityIdentifier,
    type CommunitySummary,
    type EnhancedReplyContext,
    type EventsResponse,
    type GroupChatDetailsResponse,
    type Message,
    type RulesAcceptanceResolver,
    type SendMessageResponse,
    type VersionedRules,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    localUpdates,
    routeStore,
    selectedServerChatStore,
    selectedServerCommunityStore,
    serverCommunitiesStore,
    selectedChatIdStore,
} from "./state";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { CommunityDetailsState } from "./state/community/server";
import { captureRulesAcceptanceStore } from "./stores/rules";
import { currentChatVisit, startChatVisit } from "./state/selectedChat";
import { WorkerAgent } from "./workerAgent";

// Sending a message to a chat or community whose rules the user hasn't accepted first asks them
// to accept those rules. Forwarding a message sends it as soon as the chat it's forwarded to
// opens, before that chat's details (which hold its rules) have loaded, so it waits for them.

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

const rules = (text: string): VersionedRules => ({ text, enabled: true, version: 1 });
const noRules: VersionedRules = { text: "", enabled: false, version: 0 };

const here: CommunityIdentifier = { kind: "community", communityId: "aaaaa-aa" };
const elsewhere: CommunityIdentifier = { kind: "community", communityId: "bbbbb-bb" };
const channel = (community: CommunityIdentifier, channelId: number): ChannelIdentifier => ({
    kind: "channel",
    communityId: community.communityId,
    channelId,
});
const from = channel(here, 1);
const sameCommunity = channel(here, 2);
const otherCommunity = channel(elsewhere, 3);

function community(id: CommunityIdentifier, channels: ChannelIdentifier[], rulesAccepted: boolean) {
    return {
        kind: "community",
        id,
        channels: channels.map(
            (c) =>
                ({
                    kind: "channel",
                    id: c,
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
                        rulesAccepted: false,
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
                }) as unknown as ChannelSummary,
        ),
        membership: { role: ROLE_MEMBER, archived: false, pinned: [], index: 0, rulesAccepted },
        lastUpdated: 0n,
    } as unknown as CommunitySummary;
}

function chatDetails(id: ChannelIdentifier, chatRules: VersionedRules) {
    return new ChatDetailsState(
        id,
        0n,
        new Map(),
        new Set(),
        new Set(),
        new Set(),
        new Set(),
        new Map(),
        new Map(),
        chatRules,
    );
}

function communityDetails(id: CommunityIdentifier, communityRules: VersionedRules) {
    return new CommunityDetailsState(
        id,
        0n,
        new Map(),
        new Map(),
        new Set(),
        new Set(),
        new Set(),
        new Set(),
        new Map(),
        communityRules,
    );
}

// The prompt to accept the rules, if one is showing
function rulesPrompt(): RulesAcceptanceResolver | undefined {
    let resolver: RulesAcceptanceResolver | undefined;
    captureRulesAcceptanceStore.subscribe((r) => (resolver = r))();
    return resolver;
}

function select(id: ChannelIdentifier) {
    const communityId: CommunityIdentifier = { kind: "community", communityId: id.communityId };
    routeStore.set({
        kind: "selected_channel_route",
        scope: { kind: "community", id: communityId },
        communityId,
        chatId: id,
        open: false,
    });
}

describe("accepting the rules before sending a message", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    // The rules the worker loads for the channel forwarded to, and for its community
    let channelRules: VersionedRules;
    let communityRules: VersionedRules;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        sent = [];
        channelRules = noRules;
        communityRules = noRules;
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            if (req.kind !== "sendMessage") {
                // The events of the chat being opened
                const events = {
                    events: [],
                    expiredEventRanges: [],
                    latestEventIndex: 0,
                } as unknown as EventsResponse<ChatEvent>;
                return new Stream((resolve) => setTimeout(() => resolve(events, true), 0));
            }
            sent.push(req);
            const response: SendMessageResponse = { kind: "failure" };
            return {
                subscribe: ({ onResult }: { onResult: (r: unknown) => void }) =>
                    queueMicrotask(() => onResult([response, req.event.event])),
            };
        }) as never);
        // The details arrive later, as they would from the network, the community's last as
        // those of a large community might
        const reply = <T>(value: T, ms = 0) =>
            new Promise<T>((r) => setTimeout(() => r(value), ms));
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            switch (req.kind) {
                case "getGroupDetails":
                    return reply({
                        members: [],
                        blockedUsers: new Set(),
                        invitedUsers: new Set(),
                        pinnedMessages: new Set(),
                        rules: channelRules,
                        timestamp: 1n,
                        bots: [],
                        webhooks: [],
                    } satisfies GroupChatDetailsResponse);
                case "getCommunityDetails":
                    return reply(
                        {
                            kind: "success",
                            members: [],
                            blockedUsers: new Set(),
                            invitedUsers: new Set(),
                            rules: communityRules,
                            lastUpdated: 1n,
                            userGroups: new Map(),
                            referrals: new Set(),
                            bots: [],
                        } satisfies CommunityDetailsResponse,
                        20,
                    );
                case "getUsers":
                    return Promise.resolve({ users: [], deletedUserIds: new Set() });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        captureRulesAcceptanceStore.set(undefined);
        currentChatVisit()?.setDetails(undefined);
        selectedServerCommunityStore.set(undefined);
        serverCommunitiesStore.set(new CommunityMap());
        // a new visit to whatever is selected, which starts with no events
        startChatVisit(selectedChatIdStore.value);
        localUpdates.draftMessages.delete({ chatId: otherCommunity });
    });

    function setup(communityRulesAccepted: boolean, otherCommunityRulesAccepted = true) {
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(here, [from, sameCommunity], communityRulesAccepted));
        communities.set(
            elsewhere,
            community(elsewhere, [otherCommunity], otherCommunityRulesAccepted),
        );
        serverCommunitiesStore.set(communities);
        client = new OpenChat(config());

        // The channel the message is forwarded from has rules, which the user has accepted
        select(from);
        currentChatVisit()?.setDetails(chatDetails(from, rules("the rules of the channel")));
        selectedServerCommunityStore.set(communityDetails(here, rules("the rules here")));
    }

    function forwardTo(id: ChannelIdentifier) {
        select(id);
        return client.sendMessageWithContent(
            { chatId: id },
            { kind: "text_content", text: "hello" },
            false,
            [],
            true,
        );
    }

    // Forwards the message as the app does: the route changes to the channel, which selects its
    // community and then the channel, and the message is sent as soon as the channel opens
    async function forwardToAnotherCommunity() {
        select(otherCommunity);
        await client.setSelectedCommunity(elsewhere);
        await client.setSelectedChat(otherCommunity);
        return client.sendMessageWithContent(
            { chatId: otherCommunity },
            { kind: "text_content", text: "hello" },
            false,
            [],
            true,
        );
    }

    function rulesShown(): string {
        return client.combineRulesText(
            selectedServerChatStore.value?.rules,
            selectedServerCommunityStore.value?.rules,
        );
    }

    test("the rules of the chat forwarded from aren't asked to be accepted", async () => {
        setup(true);

        await forwardTo(otherCommunity);

        expect(rulesPrompt()).toBeUndefined();
        expect(sent.map((r) => r.kind)).toEqual(["sendMessage"]);
    });

    test("the community's rules are asked to be accepted before the chat's details load", async () => {
        setup(false);
        // Nothing loads the chat's details here, as when loading them failed, or for a message
        // sent from the composer before they've loaded

        const outcome = forwardTo(sameCommunity);
        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        expect(
            client.combineRulesText(
                selectedServerChatStore.value?.rules,
                selectedServerCommunityStore.value?.rules,
            ),
        ).toBe("the rules here");
        rulesPrompt()?.resolve(false);

        expect((await outcome).kind).toBe("failure");
        expect(sent).toEqual([]);
    });

    test("forwarding to a channel asks for its rules to be accepted before sending", async () => {
        setup(true);
        channelRules = rules("the rules of the channel forwarded to");

        const outcome = forwardToAnotherCommunity();
        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        expect(sent).toEqual([]);
        expect(rulesShown()).toBe("the rules of the channel forwarded to");
        rulesPrompt()?.resolve(true);
        await outcome;

        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({
            kind: "sendMessage",
            acceptedRules: { chat: 1, community: undefined },
        });
    });

    test("forwarding to a channel asks for its community's rules to be accepted before sending", async () => {
        setup(true, false);
        communityRules = rules("the rules there");

        const outcome = forwardToAnotherCommunity();
        await vi.waitFor(() => expect(rulesPrompt()).toBeDefined());
        expect(sent).toEqual([]);
        expect(rulesShown()).toBe("the rules there");
        rulesPrompt()?.resolve(true);
        await outcome;

        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({
            kind: "sendMessage",
            acceptedRules: { chat: undefined, community: 1 },
        });
    });

    test("forwarding to a channel with no rules sends it without asking", async () => {
        setup(true);

        await forwardToAnotherCommunity();

        expect(rulesPrompt()).toBeUndefined();
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ kind: "sendMessage", acceptedRules: undefined });
    });

    test("forwarding isn't asked to accept the rules of a chat opened while it waits", async () => {
        setup(true);
        channelRules = rules("the rules of the channel forwarded to");
        select(otherCommunity);
        await client.setSelectedCommunity(elsewhere);
        await client.setSelectedChat(otherCommunity);
        client.forwardMessage({ chatId: otherCommunity }, {
            content: { kind: "text_content", text: "hello" },
            blockLevelMarkdown: false,
            ogPreviews: [],
        } as unknown as Message);

        // The user goes back before the details of the channel forwarded to have loaded
        select(from);
        currentChatVisit()?.setDetails(chatDetails(from, rules("the rules of the channel")));
        await vi.waitFor(() => expect(sent).toHaveLength(1));

        expect(rulesPrompt()).toBeUndefined();
        expect(sent[0]).toMatchObject({ kind: "sendMessage", acceptedRules: undefined });
    });

    test("forwarding leaves the draft of the chat forwarded to alone", async () => {
        setup(true);
        const draft = { chatId: otherCommunity };

        const outcome = forwardToAnotherCommunity();
        // What the user types into the chat forwarded to while the message waits to be sent
        localUpdates.draftMessages.setTextContent(draft, "and another thing");
        localUpdates.draftMessages.setReplyingTo(draft, {
            sourceContext: draft,
        } as unknown as EnhancedReplyContext);
        await outcome;
        // The message is added to the chat, and its draft cleared, after a timeout
        await new Promise((r) => setTimeout(r, 0));

        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({
            kind: "sendMessage",
            event: { event: { repliesTo: undefined } },
        });
        expect(localUpdates.draftMessages.value.get(draft)?.textContent).toBe("and another thing");
    });
});

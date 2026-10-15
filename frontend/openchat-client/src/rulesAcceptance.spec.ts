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
    anonymousUser,
    type ChannelIdentifier,
    type ChannelSummary,
    type CommunityIdentifier,
    type CommunitySummary,
    type RulesAcceptanceResolver,
    type SendMessageResponse,
    type VersionedRules,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    routeStore,
    selectedServerChatStore,
    selectedServerCommunityStore,
    serverCommunitiesStore,
} from "./state";
import { ChatDetailsState } from "./state/chat/serverDetails";
import { CommunityDetailsState } from "./state/community/server";
import { captureRulesAcceptanceStore } from "./stores/rules";
import { WorkerAgent } from "./workerAgent";

// Sending a message to a chat or community whose rules the user hasn't accepted first asks them
// to accept those rules. Forwarding a message sends it as soon as the chat it's forwarded to
// opens, before that chat's details (which hold its rules) have loaded.

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
                    membership: { rulesAccepted: false },
                }) as unknown as ChannelSummary,
        ),
        membership: { rulesAccepted },
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

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        sent = [];
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            const response: SendMessageResponse = { kind: "failure" };
            return {
                subscribe: ({ onResult }: { onResult: (r: unknown) => void }) =>
                    queueMicrotask(() =>
                        onResult([response, "event" in req ? req.event.event : undefined]),
                    ),
            };
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(
            (() => new Promise(() => {})) as never,
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        captureRulesAcceptanceStore.set(undefined);
        selectedServerChatStore.set(undefined);
        serverCommunitiesStore.set(new CommunityMap());
    });

    function setup(communityRulesAccepted: boolean) {
        const communities = new CommunityMap<CommunitySummary>();
        communities.set(here, community(here, [from, sameCommunity], communityRulesAccepted));
        communities.set(elsewhere, community(elsewhere, [otherCommunity], true));
        serverCommunitiesStore.set(communities);
        client = new OpenChat(config());

        // The channel the message is forwarded from has rules, which the user has accepted
        select(from);
        selectedServerChatStore.set(chatDetails(from, rules("the rules of the channel")));
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

    test("the rules of the chat forwarded from aren't asked to be accepted", async () => {
        setup(true);

        await forwardTo(otherCommunity);

        expect(rulesPrompt()).toBeUndefined();
        expect(sent.map((r) => r.kind)).toEqual(["sendMessage"]);
    });

    test("the community's rules are asked to be accepted before the chat's details load", async () => {
        setup(false);

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
});

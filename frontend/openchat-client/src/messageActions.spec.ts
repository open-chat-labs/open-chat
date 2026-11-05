import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
    });
});

// The constructor starts an auth client against IndexedDB; keep it inert
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: () => new Promise(() => {}) },
}));

import {
    ChatMap,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    anonymousUser,
    emptyChatMetrics,
    type DirectChatIdentifier,
    type EnhancedReplyContext,
    type EventWrapper,
    type GroupChatSummary,
    type Message,
    type SendMessageResponse,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    localUpdates,
    routeStore,
    serverGroupChatsStore,
} from "./state";
import { userStore } from "./state/users/state";
import { WorkerAgent } from "./workerAgent";

// What the message menu's actions call on the client (#10117): toggling a reaction, retrying a
// failed message and replying privately.

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

const chatId = { kind: "group_chat" as const, groupId: "aaaaa-aa" };
const context = { chatId };

function groupChat(): GroupChatSummary {
    return {
        kind: "group_chat",
        name: "g",
        description: "",
        id: chatId,
        lastUpdated: 0n,
        latestMessage: undefined,
        public: true,
        historyVisible: true,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        latestEventIndex: 0,
        latestMessageIndex: undefined,
        memberCount: 2,
        permissions: {
            changeRoles: ROLE_ADMIN,
            removeMembers: ROLE_MODERATOR,
            deleteMessages: ROLE_MODERATOR,
            updateGroup: ROLE_ADMIN,
            pinMessages: ROLE_ADMIN,
            inviteUsers: ROLE_ADMIN,
            addMembers: ROLE_ADMIN,
            reactToMessages: ROLE_MEMBER,
            tipMessages: ROLE_MEMBER,
            mentionAllMembers: ROLE_MEMBER,
            startVideoCall: ROLE_ADMIN,
            messagePermissions: { default: ROLE_MEMBER },
            threadPermissions: undefined,
        },
        metrics: emptyChatMetrics(),
        subtype: undefined,
        previewed: false,
        frozen: false,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        level: "group",
        eventsTTL: undefined,
        eventsTtlLastUpdated: 0n,
        membership: {
            lapsed: false,
            archived: false,
            mentions: [],
            notificationsMuted: false,
            atEveryoneMuted: false,
            role: ROLE_MEMBER,
            readByMeUpTo: undefined,
            joined: 0n,
            myMetrics: emptyChatMetrics(),
            rulesAccepted: true,
            latestThreads: [],
        },
        localUserIndex: "",
        isInvited: false,
        messagesVisibleToNonMembers: false,
        verified: false,
    };
}

function message(overrides: Partial<Message> = {}): EventWrapper<Message> {
    return {
        index: 4,
        timestamp: 1000n,
        event: {
            kind: "message",
            messageId: 77n,
            messageIndex: 2,
            sender: "me",
            content: { kind: "text_content", text: "hello" },
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
            ...overrides,
        },
    };
}

function config(): OpenChatConfig {
    const canister = "aaaaa-aa";
    return {
        mobileLayout: "v1",
        webAuthnOrigin: undefined,
        openStorageIndexCanister: canister,
        groupIndexCanister: canister,
        notificationsCanister: canister,
        identityCanister: canister,
        onlineCanister: canister,
        dailyPuzzleCanister: canister,
        userIndexCanister: canister,
        translationsCanister: canister,
        registryCanister: canister,
        internetIdentityUrl: "",
        nfidUrl: "",
        userGeekApiKey: "",
        videoBridgeUrl: "",
        translateProxyUrl: "",
        meteredApiKey: "",
        blobUrlPattern: "",
        bridgeAvatarsUrl: "",
        priceServiceUrl: "",
        miniAppServiceUrl: "",
        canisterUrlPath: "",
        proposalBotCanister: canister,
        signInWithEmailCanister: canister,
        signInWithEthereumCanister: canister,
        signInWithSolanaCanister: canister,
        oneSecForwarderCanister: canister,
        oneSecMinterCanister: canister,
        i18nFormatter: (key) => key,
        logger: { error: () => {}, debug: () => {}, log: () => {} },
        websiteVersion: "test",
        rollbarApiKey: "",
        env: "test",
        bitcoinMainnetEnabled: false,
        vapidPublicKey: "",
        accountLinkingCodesEnabled: false,
        baseOrigin: "",
    };
}

describe("the message menu's calls on the client", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let succeed: boolean;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me", username: "me" });
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId,
            chatType: "group_chat",
            open: false,
        });
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatId, groupChat());
        serverGroupChatsStore.set(chats);
        sent = [];
        succeed = true;
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "addReaction":
                case "removeReaction":
                    return Promise.resolve(
                        succeed ? { kind: "success" } : { kind: "error", code: 0 },
                    );
                case "deleteFailedMessage":
                    return Promise.resolve();
                default:
                    return new Promise(() => {});
            }
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            const response: SendMessageResponse = { kind: "failure" };
            return {
                subscribe: ({ onResult }: { onResult: (r: unknown) => void }) =>
                    req.kind === "sendMessage"
                        ? queueMicrotask(() => onResult([response, req.event.event]))
                        : undefined,
            };
        }) as never);
        client = new OpenChat(config());
        // only what the calls under test send
        sent = [];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        serverGroupChatsStore.set(new ChatMap());
    });

    test("a reaction is added, and taken off again by the one who added it", async () => {
        expect(await client.toggleReaction(context, message().event, "👍")).toBe("added");
        expect(sent.map((r) => r.kind)).toEqual(["addReaction"]);

        const reacted = message({ reactions: [{ reaction: "👍", userIds: new Set(["me"]) }] });
        expect(await client.toggleReaction(context, reacted.event, "👍")).toBe("removed");
        expect(sent.map((r) => r.kind)).toEqual(["addReaction", "removeReaction"]);
    });

    test("a reaction that doesn't go through is a failure", async () => {
        succeed = false;
        expect(await client.toggleReaction(context, message().event, "👍")).toBe("failed");
    });

    // invariant 4
    test("retry resends with the failed message's id, so it replaces the failed message instead of adding a new one", async () => {
        const failed = message({ forwarded: true });
        await client.retrySendMessage(context, failed);

        const sends = sent.filter((r) => r.kind === "sendMessage");
        expect(sends).toHaveLength(1);
        const send = sends[0];
        if (send.kind !== "sendMessage") throw new Error("not a send");
        expect(send.event.event.messageId).toBe(77n);
        expect(send.event.event.forwarded).toBe(true);
        expect(send.mentioned).toEqual([]);
        // the failed one is taken off first, so the retry takes its place
        expect(sent.findIndex((r) => r.kind === "deleteFailedMessage")).toBeLessThan(
            sent.findIndex((r) => r.kind === "sendMessage"),
        );
    });

    test("retry keeps the failed message's own reply, not whatever the draft replies to now", async () => {
        const quoted = message().event;
        const replyingTo: EnhancedReplyContext = {
            kind: "rehydrated_reply_context",
            senderId: "them",
            eventIndex: 1,
            content: quoted.content,
            messageId: 5n,
            messageIndex: 1,
            edited: false,
            isThreadRoot: false,
            sourceContext: context,
        };
        localUpdates.draftMessages.setReplyingTo(context, { ...replyingTo, messageId: 6n });
        await client.retrySendMessage(context, message({ repliesTo: replyingTo }));

        const send = sent.find((r) => r.kind === "sendMessage");
        if (send?.kind !== "sendMessage") throw new Error("not sent");
        expect(send.event.event.repliesTo).toMatchObject({ messageId: 5n });
        localUpdates.draftMessages.delete(context);
    });

    // invariant 8
    test("reply privately sets the reply on the DM with the sender and finds the DM across all scopes", async () => {
        userStore.addUser({
            kind: "user",
            userId: "them",
            username: "them",
            displayName: undefined,
            updated: 0n,
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            maxStreak: 0,
            isUniquePerson: false,
            totalChitEarned: 0,
            hideOnlineStatus: false,
        });
        const dm: DirectChatIdentifier = { kind: "direct_chat", userId: "them" };
        const replyingTo: EnhancedReplyContext = {
            kind: "rehydrated_reply_context",
            senderId: "them",
            eventIndex: 4,
            content: { kind: "text_content", text: "hello" },
            messageId: 77n,
            messageIndex: 2,
            edited: false,
            isThreadRoot: false,
            sourceContext: context,
        };
        localUpdates.draftMessages.setTextContent({ chatId: dm }, "half written");

        // from a community, whose scope holds no DMs
        const community = { kind: "community" as const, communityId: "c" };
        routeStore.set({
            kind: "selected_channel_route",
            scope: { kind: "community", id: community },
            communityId: community,
            chatId: { kind: "channel", communityId: "c", channelId: 1 },
            open: false,
        });
        expect(await client.replyPrivately(replyingTo)).toEqual(dm);
        const draft = localUpdates.draftMessages.value.get({ chatId: dm });
        expect(draft?.replyingTo).toEqual(replyingTo);
        expect(draft?.textContent).toBe("");

        // the DM it made is found the next time
        expect(await client.replyPrivately(replyingTo)).toEqual(dm);
        localUpdates.draftMessages.delete({ chatId: dm });
    });
});

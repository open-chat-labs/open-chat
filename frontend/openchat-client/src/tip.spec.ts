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
    anonymousUser,
    type GroupChatSummary,
    type Message,
    type MessageContext,
    type PendingCryptocurrencyTransfer,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import {
    currentUserStore,
    pinNumberRequiredStore,
    pinNumberResolverStore,
    routeStore,
    serverGroupChatsStore,
} from "./state";
import { messageLocalUpdates } from "./state/message/localUpdates";
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

const chatId = { kind: "group_chat" as const, groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" };
const messageContext: MessageContext = { chatId };
const LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";

const message = {
    messageId: 1n,
    sender: "them",
    tips: {},
} as unknown as Message;

const transfer: PendingCryptocurrencyTransfer = {
    kind: "pending",
    ledger: LEDGER,
    token: "ICP",
    recipient: "them",
    amountE8s: 1_000_000n,
    feeE8s: 10_000n,
    createdAtNanos: 0n,
};

describe("tipping a message", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let tipResponse: unknown;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        routeStore.set({
            kind: "global_chat_selected_route",
            scope: { kind: "chats" },
            chatId,
            chatType: "group_chat",
            open: false,
        });
        const chats = new ChatMap<GroupChatSummary>();
        chats.set(chatId, { kind: "group_chat", id: chatId } as unknown as GroupChatSummary);
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());
        sent = [];
        tipResponse = { kind: "success" };
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "tipMessage":
                    return Promise.resolve(tipResponse);
                case "refreshAccountBalance":
                    return Promise.resolve(0n);
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        serverGroupChatsStore.set(new ChatMap());
        messageLocalUpdates.set(new Map() as never);
        pinNumberRequiredStore.set(undefined);
    });

    // Invariant: once a tip has gone, the ledger's balance is refreshed, on both trees. Desktop
    // left the old balance showing.
    test("a tip that goes through refreshes the ledger's balance", async () => {
        expect(await client.tipMessage(messageContext, message, transfer)).toEqual({
            kind: "tipped",
        });

        await vi.waitFor(() =>
            expect(sent).toContainEqual(
                expect.objectContaining({ kind: "refreshAccountBalance", ledger: LEDGER }),
            ),
        );
    });

    // Invariant: a failed tip says why, and is taken off the message again. Both trees showed an
    // empty toast for a failure that wasn't about the PIN.
    test("a failed tip says why and is taken off the message", async () => {
        tipResponse = { kind: "error", code: 0, message: undefined };

        expect(await client.tipMessage(messageContext, message, transfer)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "tip.failure" }),
        });
        const tips = messageLocalUpdates.value.get(message.messageId)?.tips.get(LEDGER);
        expect(tips?.get("me") ?? 0n).toBe(0n);
    });

    test("a tip whose request fails says why", async () => {
        tipResponse = { kind: "failure" };

        expect(await client.tipMessage(messageContext, message, transfer)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "tip.failure" }),
        });
    });

    // Invariant: a user who dismisses the PIN prompt sends nothing. It used to throw.
    test("dismissing the PIN prompt sends nothing and reports the tip as cancelled", async () => {
        pinNumberRequiredStore.set(true);

        const outcome = client.tipMessage(messageContext, message, transfer);
        pinNumberResolverStore.value?.reject();

        expect(await outcome).toEqual({ kind: "cancelled" });
        expect(sent.filter((r) => r.kind === "tipMessage")).toEqual([]);
    });
});

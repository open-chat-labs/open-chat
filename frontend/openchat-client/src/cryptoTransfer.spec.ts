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
    type GroupChatSummary,
    type MessageContext,
    type PendingCryptocurrencyTransfer,
    type SendMessageResponse,
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

const transfer: PendingCryptocurrencyTransfer = {
    kind: "pending",
    ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
    token: "ICP",
    recipient: "them",
    amountE8s: 1_000_000n,
    feeE8s: 10_000n,
    createdAtNanos: 0n,
};

describe("sending tokens in a message", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let response: SendMessageResponse;

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
        chats.set(chatId, {
            kind: "group_chat",
            id: chatId,
            membership: { rulesAccepted: true },
            rules: { enabled: false },
        } as unknown as GroupChatSummary);
        serverGroupChatsStore.set(chats);
        client = new OpenChat(config());
        sent = [];
        response = { kind: "failure" };
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
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
        serverGroupChatsStore.set(new ChatMap());
        pinNumberRequiredStore.set(undefined);
    });

    // Invariant: a user who dismisses the PIN prompt sends nothing. It used to throw, which left
    // mobile's wallet send busy for good.
    test("dismissing the PIN prompt sends nothing and reports the transfer as cancelled", async () => {
        pinNumberRequiredStore.set(true);

        const outcome = client.sendCryptoTransfer(messageContext, transfer, "");
        await vi.waitFor(() => expect(pinNumberResolverStore.value).toBeDefined());
        pinNumberResolverStore.value?.reject();

        expect(await outcome).toEqual({ kind: "cancelled" });
        expect(sent).toEqual([]);
    });

    // Invariant: a transfer that goes through is reported as sent, or the user is asked to pay
    // again. A message carrying a transfer comes back as `transfer_success`.
    test("a transfer that goes through is reported as sent", async () => {
        response = {
            kind: "transfer_success",
            timestamp: 0n,
            messageIndex: 0,
            eventIndex: 0,
            transfer: { ...transfer, kind: "completed", blockIndex: 1n },
        } as unknown as SendMessageResponse;

        expect(await client.sendCryptoTransfer(messageContext, transfer, "")).toEqual({
            kind: "sent",
        });
    });

    // Invariant: a failed transfer says why. Mobile's wallet send showed nothing.
    test("a transfer that fails says why", async () => {
        expect(await client.sendCryptoTransfer(messageContext, transfer, "")).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "errorSendingMessage" }),
        });
    });

    // The message for a refused PIN is in the PIN failure store, which counts down to the next try
    test("a refused PIN is reported as a PIN failure", async () => {
        response = { kind: "error", code: ErrorCode.PinIncorrect, message: "1000" };

        expect(await client.sendCryptoTransfer(messageContext, transfer, "")).toEqual({
            kind: "pin_failed",
        });
    });

    // Invariant: the transfer goes in the message exactly as given, with the caption if there is
    // one
    test("the message carries the transfer and its caption", async () => {
        await client.sendCryptoTransfer(messageContext, transfer, "thanks");
        await client.sendCryptoTransfer(messageContext, transfer, "");

        const contents = sent.map((r) => (r.kind === "sendMessage" ? r.event.event.content : r));
        expect(contents).toEqual([
            { kind: "crypto_content", caption: "thanks", transfer },
            { kind: "crypto_content", caption: undefined, transfer },
        ]);
    });
});

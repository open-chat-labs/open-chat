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

import { LEDGER_CANISTER_ICP, anonymousUser } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { balanceUnavailableStore, cryptoBalanceStore, currentUserStore } from "./state";
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

describe("refreshing an account balance", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "warn").mockImplementation(() => {});
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
    });

    // Invariant 1: a refresh that fails resolves to undefined, not 0n, and never rejects, so the
    // caller can say it failed; the cached balance is left as it was
    test("a failed refresh resolves to undefined and keeps the cached balance", async () => {
        cryptoBalanceStore.setBalance(LEDGER_CANISTER_ICP, 500n);
        vi.spyOn(WorkerAgent.prototype, "send").mockRejectedValue(new Error("offline"));

        await expect(client.refreshAccountBalance(LEDGER_CANISTER_ICP)).resolves.toBeUndefined();
        expect(cryptoBalanceStore.value.get(LEDGER_CANISTER_ICP)).toBe(500n);
    });

    // Invariant 2: the wallet can say which balances it couldn't read, eg. from a ledger which is
    // out of cycles, until one is read from that ledger again
    test("a failed refresh marks the ledger until a refresh succeeds", async () => {
        const send = vi
            .spyOn(WorkerAgent.prototype, "send")
            .mockRejectedValue(new Error("Canister is out of cycles"));

        await client.refreshAccountBalance(LEDGER_CANISTER_ICP);
        expect(balanceUnavailableStore.value.has(LEDGER_CANISTER_ICP)).toBe(true);

        send.mockResolvedValue(700n);
        await client.refreshAccountBalance(LEDGER_CANISTER_ICP);
        expect(balanceUnavailableStore.value.has(LEDGER_CANISTER_ICP)).toBe(false);
        expect(cryptoBalanceStore.value.get(LEDGER_CANISTER_ICP)).toBe(700n);
    });
});

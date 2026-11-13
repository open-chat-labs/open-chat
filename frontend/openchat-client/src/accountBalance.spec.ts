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

import { LEDGER_CANISTER_CHAT, LEDGER_CANISTER_ICP, anonymousUser } from "@shared";
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
        // reading a balance clears a ledger's mark
        cryptoBalanceStore.setBalance(LEDGER_CANISTER_ICP, 0n);
        cryptoBalanceStore.setBalance(LEDGER_CANISTER_CHAT, 0n);
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

    // Invariant 4: offline, the worker doesn't ask the ledger and answers undefined. That says
    // nothing about the balance: a 0 mustn't replace the one held, nor a mark be set or cleared
    test("a refresh which wasn't made, being offline, changes nothing", async () => {
        cryptoBalanceStore.setBalance(LEDGER_CANISTER_ICP, 500n);
        cryptoBalanceStore.setUnavailable(LEDGER_CANISTER_ICP);
        vi.spyOn(WorkerAgent.prototype, "send").mockResolvedValue(undefined);

        await expect(client.refreshAccountBalance(LEDGER_CANISTER_ICP)).resolves.toBeUndefined();
        await client.refreshAccountBalance(LEDGER_CANISTER_CHAT);

        expect(cryptoBalanceStore.value.get(LEDGER_CANISTER_ICP)).toBe(500n);
        expect([...balanceUnavailableStore.value]).toEqual([LEDGER_CANISTER_ICP]);
    });

    // Invariant 3: a lookup which failed for a passing reason doesn't leave its ledger marked for
    // the session: the wallet asks again for the marked ones as it opens
    test("asking again for the marked ledgers clears those which now answer", async () => {
        const send = vi.spyOn(WorkerAgent.prototype, "send").mockRejectedValue(new Error("timeout"));
        await client.refreshAccountBalance(LEDGER_CANISTER_ICP);
        await client.refreshAccountBalance(LEDGER_CANISTER_CHAT);

        send.mockImplementation((req) =>
            "ledger" in req && req.ledger === LEDGER_CANISTER_ICP
                ? Promise.resolve(700n)
                : Promise.reject(new Error("Canister is out of cycles")),
        );
        await client.refreshUnavailableBalances();

        expect([...balanceUnavailableStore.value]).toEqual([LEDGER_CANISTER_CHAT]);
        expect(cryptoBalanceStore.value.get(LEDGER_CANISTER_ICP)).toBe(700n);
    });
});

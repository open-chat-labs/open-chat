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

import { LEDGER_CANISTER_CHAT, anonymousUser, type Withdrawal, type WorkerRequest } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, pinNumberRequiredStore, pinNumberResolverStore } from "./state";
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

const withdrawal: Withdrawal = {
    ledger: LEDGER_CANISTER_CHAT,
    symbol: "CHAT",
    route: { kind: "ledger" },
    to: "dfdal-2uaaa-aaaaa-qaama-cai",
    amount: 1_000_000n,
    fee: 100_000n,
};

describe("withdrawing from the wallet", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "withdrawCryptocurrency":
                    return Promise.resolve({ kind: "completed" });
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
        pinNumberRequiredStore.set(undefined);
    });

    // Invariant: nothing is sent to the account of a user id in a MultiUser canister, since no one can
    // sign for it. Taken from `UserId::new_indexed` in backend/libraries/types/src/user.rs
    test("an address which is a MultiUser canister user's id is refused and nothing is sent", async () => {
        expect(await client.withdraw({ ...withdrawal, to: "qp43m-xeaaa-aaaaa-qaama-daa" })).toEqual(
            {
                kind: "failed",
                message: expect.objectContaining({ key: "cryptoAccount.sendToUserId" }),
            },
        );
        expect(sent).toEqual([]);
    });

    // Invariant: once a withdrawal has gone, the ledger's balance is refreshed, on both trees
    test("a withdrawal that goes through refreshes the ledger's balance", async () => {
        expect(await client.withdraw(withdrawal)).toEqual({ kind: "sent" });

        await vi.waitFor(() =>
            expect(sent).toContainEqual(
                expect.objectContaining({
                    kind: "refreshAccountBalance",
                    ledger: LEDGER_CANISTER_CHAT,
                }),
            ),
        );
        expect(sent.filter((r) => r.kind === "withdrawCryptocurrency")).toHaveLength(1);
    });

    // Invariant: a user who dismisses the PIN prompt sends nothing, and is told nothing failed
    test("dismissing the PIN prompt sends nothing and reports the withdrawal as cancelled", async () => {
        pinNumberRequiredStore.set(true);

        const outcome = client.withdraw(withdrawal);
        pinNumberResolverStore.value?.reject();

        expect(await outcome).toEqual({ kind: "cancelled" });
        expect(sent.filter((r) => r.kind === "withdrawCryptocurrency")).toEqual([]);
    });
});

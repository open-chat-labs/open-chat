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
    ErrorCode,
    LEDGER_CANISTER_CHAT,
    LEDGER_CANISTER_ICP,
    Stream,
    anonymousUser,
    type CryptocurrencyDetails,
    type SwapQuote,
    type SwapTokensResponse,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore } from "./state";
import { swapQuoteResult, swapResult } from "./utils/swap";
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

function token(ledger: string, symbol: string): CryptocurrencyDetails {
    return { ledger, symbol, decimals: 8, transferFee: 10_000n } as CryptocurrencyDetails;
}

const icp = token(LEDGER_CANISTER_ICP, "ICP");
const chat = token(LEDGER_CANISTER_CHAT, "CHAT");

const quote: SwapQuote = {
    ledgerIn: LEDGER_CANISTER_ICP,
    ledgerOut: LEDGER_CANISTER_CHAT,
    dex: "icpswap",
    amountIn: 100_000_000n,
    amountOut: 5_000_000_000n,
    valueWarning: undefined,
    values: {},
};

describe("swapping from the wallet", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let balance: bigint;
    let balanceOut: () => bigint;
    let swap: () => Promise<SwapTokensResponse>;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        balance = quote.amountIn;
        balanceOut = () => 0n;
        swap = () => Promise.resolve({ kind: "success", amountOut: quote.amountOut });
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            if (req.kind !== "refreshAccountBalance") return new Promise(() => {});
            return Promise.resolve(req.ledger === quote.ledgerOut ? balanceOut() : balance);
        }) as never);
        vi.spyOn(WorkerAgent.prototype, "stream").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return new Stream((resolve, reject) =>
                swap().then((resp) => resolve(resp, true), reject),
            );
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
    });

    function swapsSent() {
        return sent.filter((r) => r.kind === "swapTokens");
    }

    // Invariant: nothing is swapped when the wallet, freshly checked, can't cover the amount
    test("a wallet that no longer holds the amount sends nothing and says so", async () => {
        balance = quote.amountIn - 1n;

        expect(await client.swapTokens(quote, false)).toEqual({
            kind: "insufficient_funds",
            message: expect.objectContaining({ key: "tokenSwap.progress.insufficientFunds" }),
        });
        expect(swapsSent()).toEqual([]);
    });

    // Invariant: the swap sends the quoted amount to the quoted DEX, and refuses less than 98% of the
    // quoted output
    test("the swap is for the quoted amount and at least 98% of the quoted output", async () => {
        await client.swapTokens(quote, false);

        expect(swapsSent()).toEqual([
            expect.objectContaining({
                amountIn: quote.amountIn,
                minAmountOut: 4_900_000_000n,
                dex: "icpswap",
            }),
        ]);
    });

    // Invariant: a quote with a value warning is only swapped once the user has confirmed it
    test("a quote with a value warning the user hasn't confirmed sends nothing", async () => {
        const warned: SwapQuote = { ...quote, valueWarning: "dropped" };

        expect(await client.swapTokens(warned, false)).toMatchObject({ kind: "failed" });
        expect(sent).toEqual([]);

        await client.swapTokens(warned, true);
        expect(swapsSent()).toHaveLength(1);
    });

    // Invariant: once a swap has been sent, both balances are refreshed, whatever the outcome
    test("a swap that fails still refreshes both balances", async () => {
        swap = () =>
            Promise.resolve({ kind: "error", code: ErrorCode.SwapFailed, message: "slippage" });

        await client.swapTokens(quote, false);

        await vi.waitFor(() => {
            const refreshed = sent
                .filter((r) => r.kind === "refreshAccountBalance")
                .map((r) => r.ledger);
            // Both are refreshed once before the swap too
            expect(refreshed).toEqual([
                quote.ledgerIn,
                quote.ledgerOut,
                quote.ledgerIn,
                quote.ledgerOut,
            ]);
        });
    });

    // Invariant: the output of a successful swap shows in the wallet without a manual refresh, though
    // ICPSwap pays it out of a queue, so it can arrive after the swap is reported done
    test("a successful swap keeps refreshing the output balance until the tokens arrive", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout"] });
        let outRefreshes = 0;
        balanceOut = () => (++outRefreshes > 3 ? quote.amountOut : 0n);

        expect(await client.swapTokens(quote, false)).toMatchObject({ kind: "swapped" });
        await vi.advanceTimersByTimeAsync(60_000);
        vi.useRealTimers();

        expect(outRefreshes).toBe(4);
    });

    // Invariant: a swap that throws part way may have gone ahead, so the user is never told nothing
    // was lost, and both balances are refreshed so they can check
    test("a swap that throws is reported as unconfirmed and refreshes both balances", async () => {
        swap = () => Promise.reject(new Error("network"));

        expect(await client.swapTokens(quote, false)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "tokenSwap.progress.unknown" }),
        });
        await vi.waitFor(() =>
            expect(
                sent.filter((r) => r.kind === "refreshAccountBalance").map((r) => r.ledger),
            ).toEqual([quote.ledgerIn, quote.ledgerOut, quote.ledgerIn, quote.ledgerOut]),
        );
    });
});

describe("quoting a swap", () => {
    const usd = (rates: Record<string, number>) => (ledger: string) => rates[ledger];

    // Invariant: a quote worth less than 90% of what goes in, or of unknown worth, carries a warning
    test("a quote worth much less than the input, or of unknown worth, carries a warning", () => {
        const quoted = (rates: Record<string, number>) =>
            swapQuoteResult(icp, chat, 100_000_000n, [["icpswap", 5_000_000_000n]], usd(rates));

        // 1 ICP at $5 for 50 CHAT at $0.09 is $4.50, 90% of what goes in
        expect(quoted({ [icp.ledger]: 5, [chat.ledger]: 0.09 })).toMatchObject({
            quote: { valueWarning: undefined },
        });
        expect(quoted({ [icp.ledger]: 5, [chat.ledger]: 0.08 })).toMatchObject({
            quote: { valueWarning: "dropped" },
        });
        expect(quoted({ [icp.ledger]: 5 })).toMatchObject({ quote: { valueWarning: "unknown" } });
    });
});

describe("how a swap ended", () => {
    // The user can quote again after a changed rate, and change the amount after insufficient funds
    test("the outcomes the user can act on keep their own kinds", () => {
        expect(
            swapResult({ kind: "error", code: ErrorCode.SwapFailed, message: "slippage" }).kind,
        ).toBe("rate_changed");
        expect(
            swapResult({ kind: "error", code: ErrorCode.InsufficientFunds, message: undefined })
                .kind,
        ).toBe("insufficient_funds");
        expect(
            swapResult({ kind: "error", code: ErrorCode.Unknown, message: "timed out" }),
        ).toMatchObject({ kind: "failed", message: { key: "tokenSwap.progress.unknown" } });
    });
});

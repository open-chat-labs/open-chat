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
    type DexId,
    type DexQuote,
    type DexQuoteResult,
    type SwapQuote,
    type SwapTokensResponse,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { cryptoLookup, currentUserStore, swapProvidersStore } from "./state";
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

    // Invariant: each DEX is quoted on what it will pull, ie. the amount less the fees for approving
    // it and for its pull, and quotes what reaches the wallet, after the fee for sending it there
    test("each DEX is asked for a quote less the input fees, and after the output fee", async () => {
        cryptoLookup.set(
            new Map([
                [icp.ledger, icp],
                [chat.ledger, { ...chat, transferFee: 100_000n }],
            ]),
        );
        swapProvidersStore.set(["icpswap", "taco"]);
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            return Promise.resolve({ kind: "quoted", amountOut: 4_000_000_000n });
        }) as never);

        try {
            await client.getSwapQuotes(icp.ledger, chat.ledger, 100_000_000n);

            expect(sent).toEqual(
                (["icpswap", "taco"] as const).map((dex) => ({
                    kind: "getTokenSwapQuote",
                    dex,
                    inputTokenLedger: icp.ledger,
                    outputTokenLedger: chat.ledger,
                    amountIn: 99_980_000n,
                    outputTokenFee: 100_000n,
                })),
            );
        } finally {
            cryptoLookup.set(new Map());
            swapProvidersStore.set([]);
        }
    });

    // Invariant: the user sees a row for every DEX from the start, each DEX's quote as it comes in,
    // and the best of them is the quote they swap with
    test("each DEX's quote is reported as it comes in, and the best is chosen", async () => {
        cryptoLookup.set(
            new Map([
                [icp.ledger, icp],
                [chat.ledger, chat],
            ]),
        );
        swapProvidersStore.set(["icpswap", "taco"]);
        const answers: Record<string, (answer: DexQuoteResult) => void> = {};
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            if (req.kind !== "getTokenSwapQuote") return new Promise(() => {});
            return new Promise((resolve) => (answers[req.dex] = resolve));
        }) as never);
        const reported: [DexId, DexQuote][][] = [];

        try {
            const outcome = client.getSwapQuotes(icp.ledger, chat.ledger, 100_000_000n, (q) =>
                reported.push(q),
            );
            expect(reported).toEqual([
                [
                    ["icpswap", { kind: "quoting" }],
                    ["taco", { kind: "quoting" }],
                ],
            ]);

            answers.taco({ kind: "quoted", amountOut: 4_000_000_000n });
            await vi.waitFor(() => expect(reported).toHaveLength(2));
            expect(reported[1]).toEqual([
                ["icpswap", { kind: "quoting" }],
                ["taco", { kind: "quoted", amountOut: 4_000_000_000n }],
            ]);

            answers.icpswap({ kind: "quoted", amountOut: 5_000_000_000n });
            expect(await outcome).toMatchObject({
                kind: "quoted",
                quote: { dex: "icpswap", amountIn: 100_000_000n, amountOut: 5_000_000_000n },
            });
            expect(reported[2]).toEqual([
                ["icpswap", { kind: "quoted", amountOut: 5_000_000_000n }],
                ["taco", { kind: "quoted", amountOut: 4_000_000_000n }],
            ]);
        } finally {
            cryptoLookup.set(new Map());
            swapProvidersStore.set([]);
        }
    });

    // Invariant: a DEX that doesn't answer is shown as failed, and doesn't stop the user getting
    // another DEX's quote
    test("a DEX failing to answer is reported as failed while another's quote still wins", async () => {
        cryptoLookup.set(
            new Map([
                [icp.ledger, icp],
                [chat.ledger, chat],
            ]),
        );
        swapProvidersStore.set(["icpswap", "taco"]);
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) =>
            req.kind === "getTokenSwapQuote" && req.dex === "taco"
                ? Promise.reject(new Error("down"))
                : Promise.resolve({ kind: "quoted", amountOut: 5_000_000_000n })) as never);
        const reported: [DexId, DexQuote][][] = [];

        try {
            const outcome = await client.getSwapQuotes(icp.ledger, chat.ledger, 100_000_000n, (q) =>
                reported.push(q),
            );

            expect(outcome).toMatchObject({ kind: "quoted", quote: { dex: "icpswap" } });
            expect(reported.at(-1)).toEqual([
                ["icpswap", { kind: "quoted", amountOut: 5_000_000_000n }],
                ["taco", { kind: "failed" }],
            ]);
        } finally {
            cryptoLookup.set(new Map());
            swapProvidersStore.set([]);
        }
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
            swapQuoteResult(
                icp,
                chat,
                100_000_000n,
                [["icpswap", { kind: "quoted", amountOut: 5_000_000_000n }]],
                usd(rates),
            );

        // 1 ICP at $5 for 50 CHAT at $0.09 is $4.50, 90% of what goes in
        expect(quoted({ [icp.ledger]: 5, [chat.ledger]: 0.09 })).toMatchObject({
            quote: { valueWarning: undefined },
        });
        expect(quoted({ [icp.ledger]: 5, [chat.ledger]: 0.08 })).toMatchObject({
            quote: { valueWarning: "dropped" },
        });
        expect(quoted({ [icp.ledger]: 5 })).toMatchObject({ quote: { valueWarning: "unknown" } });
    });

    // Invariant: the user is only told a DEX failed when no DEX gave a quote and one didn't answer
    test("with no quote, the user is told whether a DEX failed or none would quote", () => {
        const outcome = (failed: DexQuote["kind"]) =>
            swapQuoteResult(
                icp,
                chat,
                100_000_000n,
                [
                    ["icpswap", { kind: "declined" }],
                    ["taco", { kind: failed } as DexQuote],
                ],
                usd({}),
            );

        expect(outcome("unsupported")).toMatchObject({
            kind: "failed",
            message: { key: "tokenSwap.noQuotes" },
        });
        expect(outcome("failed")).toMatchObject({
            kind: "failed",
            message: { key: "tokenSwap.quoteError" },
        });
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

describe("who may open swap", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
    });

    function from(location: string | undefined, isPlatformOperator = false) {
        currentUserStore.set({ ...anonymousUser(), userId: "me", isPlatformOperator });
        vi.spyOn(client, "getUserLocation").mockResolvedValue(location);
    }

    // Invariant: a user in a restricted location can't reach the swap form, operators excepted.
    // Desktop (Accounts) and mobile (SlidingModals) both ask swapRestricted before opening swap
    test("a user in a restricted location, or one we can't place, is refused", async () => {
        from("GB");
        expect(await client.swapRestricted()).toBe(true);
        from(undefined);
        expect(await client.swapRestricted()).toBe(true);
    });

    test("a user elsewhere, or a platform operator anywhere, may swap", async () => {
        from("FR");
        expect(await client.swapRestricted()).toBe(false);
        from("GB", true);
        expect(await client.swapRestricted()).toBe(false);
    });
});

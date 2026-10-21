import {
    i18nKey,
    ICP_SYMBOL,
    LEDGER_CANISTER_CHAT,
    LEDGER_CANISTER_ICP,
    type DexId,
    type DexQuote,
    type EnhancedTokenDetails,
    type OpenChat,
    type SwapQuoteOutcome,
} from "@client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SwapForm } from "./swapForm.svelte";
import { TokenState } from "./walletState.svelte";

const icp: EnhancedTokenDetails = {
    name: "Internet Computer",
    symbol: ICP_SYMBOL,
    ledger: LEDGER_CANISTER_ICP,
    index: undefined,
    decimals: 8,
    transferFee: 10_000n,
    logo: "",
    infoUrl: "",
    transactionUrlFormat: "",
    supportedStandards: [],
    added: 0n,
    enabled: true,
    oneSecEnabled: false,
    evmContractAddresses: [],
    lastUpdated: 0n,
    balance: 1_000_000_000n,
    dollarBalance: undefined,
    icpBalance: undefined,
    btcBalance: undefined,
    ethBalance: undefined,
    zero: false,
    urlFormat: "",
};

const chat: EnhancedTokenDetails = {
    ...icp,
    name: "OpenChat",
    symbol: "CHAT",
    ledger: LEDGER_CANISTER_CHAT,
};

const tacoQuote: SwapQuoteOutcome = {
    kind: "quoted",
    quote: {
        ledgerIn: icp.ledger,
        ledgerOut: chat.ledger,
        dex: "taco",
        amountIn: 100_000_000n,
        amountOut: 5_000_000_000n,
        valueWarning: undefined,
        values: {},
    },
};

// What the form was told of the DEXes' quotes, and how to give it the best of them
let onQuotes: (quotes: [DexId, DexQuote][]) => void;
let answer: (outcome: SwapQuoteOutcome) => void;

const client = {
    getTokenSwaps: vi.fn(() => Promise.resolve({ [chat.ledger]: ["icpswap", "taco"] })),
    refreshSwappableTokens: vi.fn(),
    swapTokens: vi.fn(),
    getSwapQuotes: vi.fn(
        (
            _ledgerIn: string,
            _ledgerOut: string,
            _amountIn: bigint,
            report: (quotes: [DexId, DexQuote][]) => void,
        ) => {
            onQuotes = report;
            return new Promise<SwapQuoteOutcome>((resolve) => (answer = resolve));
        },
    ),
} as unknown as OpenChat;

let dispose: () => void;

// A form for swapping 1 ICP for CHAT, ready to quote
async function newForm(): Promise<SwapForm> {
    let form!: SwapForm;
    dispose = $effect.root(() => {
        form = new SwapForm(client, new TokenState(icp));
    });
    await vi.waitFor(() => expect(form.loaded).toBe(true));
    form.selectOut(chat);
    form.inToken.draftAmount = 100_000_000n;
    form.validAmount = true;
    return form;
}

describe("quoting a swap from the wallet", () => {
    afterEach(() => {
        dispose();
        vi.clearAllMocks();
    });

    test("each DEX's quote is shown as it comes in, then the best of them is to confirm", async () => {
        const form = await newForm();

        const quoting = form.getQuote();
        onQuotes([
            ["icpswap", { kind: "quoting" }],
            ["taco", { kind: "quoting" }],
        ]);
        expect(form.quotes).toEqual([
            ["icpswap", { kind: "quoting" }],
            ["taco", { kind: "quoting" }],
        ]);
        expect(form.busy).toBe(true);

        const quotes: [DexId, DexQuote][] = [
            ["icpswap", { kind: "declined" }],
            ["taco", { kind: "quoted", amountOut: 5_000_000_000n }],
        ];
        onQuotes(quotes);
        answer(tacoQuote);
        await quoting;

        expect(form.quotes).toEqual(quotes);
        expect(form.stage).toBe("confirm");
        expect(form.quote?.dex).toBe("taco");
    });

    test("when no DEX gives a quote, each DEX's answer stays shown alongside the error", async () => {
        const form = await newForm();
        const message = i18nKey("tokenSwap.quoteError");

        const quoting = form.getQuote();
        onQuotes([
            ["icpswap", { kind: "unsupported" }],
            ["taco", { kind: "failed" }],
        ]);
        answer({ kind: "failed", message });
        await quoting;

        expect(form.stage).toBe("quote");
        expect(form.error).toEqual(message);
        expect(form.quotes).toHaveLength(2);

        // The error was about the tokens chosen before
        form.selectOut({ ...chat, symbol: "OTHER", ledger: "other" });
        expect(form.error).toBeUndefined();
        expect(form.quotes).toEqual([]);
    });

    test("a re-quote after a swap the rate moved under shows the quotes coming in", async () => {
        const form = await newForm();
        let quoting = form.getQuote();
        answer(tacoQuote);
        await quoting;
        vi.mocked(client.swapTokens).mockResolvedValueOnce({
            kind: "rate_changed",
            message: i18nKey("tokenSwap.progress.failed"),
        });
        await form.swap();
        expect(form.stage).toBe("done");

        quoting = form.getQuote();
        onQuotes([["taco", { kind: "quoting" }]]);

        // The desktop form shows the quotes in these stages, and the progress only for a quote
        expect(form.stage).toBe("quote");
        expect(form.quotes).toEqual([["taco", { kind: "quoting" }]]);
        answer(tacoQuote);
        await quoting;
        expect(form.stage).toBe("confirm");
    });

    // Invariant: the quotes shown are always for the tokens chosen
    test("a quote for tokens the user has since changed is dropped", async () => {
        const form = await newForm();

        const quoting = form.getQuote();
        onQuotes([["icpswap", { kind: "quoting" }]]);
        form.selectOut({ ...chat, symbol: "OTHER", ledger: "other" });

        expect(form.quotes).toEqual([]);
        expect(form.busy).toBe(false);

        onQuotes([["icpswap", { kind: "quoted", amountOut: 5_000_000_000n }]]);
        answer(tacoQuote);
        await quoting;

        expect(form.quotes).toEqual([]);
        expect(form.stage).toBe("quote");
        expect(form.quote).toBeUndefined();
    });
});

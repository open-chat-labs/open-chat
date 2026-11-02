import type {
    DexId,
    DexQuote,
    EnhancedTokenDetails,
    OpenChat,
    ResourceKey,
    SwapFromWalletStep,
    SwapOutcome,
    SwapQuote,
} from "@client";
import { TokenState } from "./walletState.svelte";

type Stage = "quote" | "confirm" | "swapping" | "done";

/**
 * Whether a token can be paid with: held, swappable from the wallet, and not the token being bought
 * (compared by ledger: two tokens can share a symbol). Both trees' "from" lists ask this.
 */
export function canPayWith(
    token: Pick<EnhancedTokenDetails, "ledger" | "balance">,
    swappable: { has(ledger: string): boolean },
    outLedger: string | undefined,
): boolean {
    return token.balance > 0n && swappable.has(token.ledger) && token.ledger !== outLedger;
}

/**
 * Whether the token being paid with can be swapped for a token: a DEX has a pool for the pair
 * (`swaps`, for the input ledger), and it isn't the input itself (6c invariant 5).
 */
export function canSwapTo(
    token: Pick<EnhancedTokenDetails, "ledger">,
    swaps: Record<string, DexId[]>,
    inLedger: string,
): boolean {
    return token.ledger !== inLedger && token.ledger in swaps;
}

/**
 * The state of a form swapping one token in the user's wallet for another: the tokens, the quote the
 * user is shown and how the swap is going. The amount is the input TokenState's draft. Both trees
 * render it.
 */
export class SwapForm {
    #client: OpenChat;
    #inToken: TokenState;
    #outToken = $state<TokenState>();
    // The tokens the input token can be swapped for, by ledger, and the input ledger they're for
    #swaps = $state<Record<string, DexId[]>>({});
    #swapsFor = $state<string>();
    #loaded = $state(false);
    // Whether swapping is restricted where the user is (undefined until known): no quote is asked
    // for and no swap sent there
    #restricted = $state<boolean>();
    #restrictionCheck: Promise<boolean>;
    #stage = $state<Stage>("quote");
    #quoting = $state(false);
    #error = $state<ResourceKey>();
    // Each DEX's quote for the user's latest request for one, which `#quote` is the best of
    #quotes = $state<[DexId, DexQuote][]>([]);
    // Counts requests for quotes, so a request the user has moved on from is dropped
    #quoteRequest = 0;
    #quote = $state<SwapQuote>();
    #step = $state<SwapFromWalletStep>();
    #outcome = $state<Exclude<SwapOutcome, { kind: "cancelled" }>>();

    // Whether the amount is valid, as the amount input reports it
    validAmount = $state(false);
    // Whether the user has confirmed they understand the quote's value warning
    warningConfirmed = $state(false);

    #canQuote = $derived.by(
        () =>
            this.#restricted === false &&
            this.#loaded &&
            this.#swapsFor === this.#inToken.ledger &&
            Object.keys(this.#swaps).length > 0 &&
            this.#outToken !== undefined &&
            this.validAmount &&
            !this.#quoting &&
            this.#stage !== "swapping",
    );
    #canSwap = $derived.by(
        () =>
            this.#restricted === false &&
            this.#stage === "confirm" &&
            this.#quote !== undefined &&
            (this.#quote.valueWarning === undefined || this.warningConfirmed),
    );

    constructor(client: OpenChat, inToken: TokenState) {
        this.#client = client;
        this.#inToken = $state(inToken);
        this.#restrictionCheck = this.#checkRestricted();
        this.#loadSwaps();
    }

    /** Swapping is restricted where the user is (undefined while that's being checked). */
    get restricted(): boolean | undefined {
        return this.#restricted;
    }

    /** Whether swapping is restricted where the user is, once that's been checked. */
    whenChecked(): Promise<boolean> {
        return this.#restrictionCheck;
    }

    /** The input ledger `swaps` are for (they're still loading while it differs from the input's). */
    get swapsFor(): string | undefined {
        return this.#swapsFor;
    }

    get inToken(): TokenState {
        return this.#inToken;
    }

    get outToken(): TokenState | undefined {
        return this.#outToken;
    }

    get swaps(): Record<string, DexId[]> {
        return this.#swaps;
    }

    get loaded(): boolean {
        return this.#loaded;
    }

    get stage(): Stage {
        return this.#stage;
    }

    get busy(): boolean {
        return this.#quoting || this.#stage === "swapping";
    }

    get error(): ResourceKey | undefined {
        return this.#error;
    }

    get quotes(): [DexId, DexQuote][] {
        return this.#quotes;
    }

    get quote(): SwapQuote | undefined {
        return this.#quote;
    }

    get step(): SwapFromWalletStep | undefined {
        return this.#step;
    }

    get outcome(): Exclude<SwapOutcome, { kind: "cancelled" }> | undefined {
        return this.#outcome;
    }

    get canQuote(): boolean {
        return this.#canQuote;
    }

    get canSwap(): boolean {
        return this.#canSwap;
    }

    selectIn(token: EnhancedTokenDetails) {
        this.#inToken = new TokenState(token, "usd");
        this.#clearQuotes();
        this.#loadSwaps();
    }

    selectOut(token: EnhancedTokenDetails) {
        this.#outToken = new TokenState(token, "usd");
        this.#clearQuotes();
    }

    /** Asks every DEX for a quote; `onQuotes` hears each DEX's answer too, as `quotes` does. */
    async getQuote(onQuotes?: (quotes: [DexId, DexQuote][]) => void) {
        if (!this.#canQuote) return;

        const request = ++this.#quoteRequest;
        // A re-quote after a swap shows the quotes coming in as a first quote does
        this.#stage = "quote";
        this.#quoting = true;
        this.#error = undefined;
        this.#quotes = [];
        this.#quote = undefined;
        this.#outcome = undefined;
        this.warningConfirmed = false;

        const outcome = await this.#client.getSwapQuotes(
            this.#inToken.ledger,
            this.#outToken!.ledger,
            this.#inToken.draftAmount,
            (quotes) => {
                if (request !== this.#quoteRequest) return;
                this.#quotes = quotes;
                onQuotes?.(quotes);
            },
        );
        if (request !== this.#quoteRequest) return;
        this.#quoting = false;

        if (outcome.kind === "quoted") {
            this.#quote = outcome.quote;
            this.#stage = "confirm";
        } else {
            this.#error = outcome.message;
            this.#stage = "quote";
        }
    }

    /**
     * Swaps at the quote, accepting `slippagePct` below it (2% when not given: the swap pays out at
     * least the quote less that). `onStep` hears each step as `step` does.
     */
    async swap(slippagePct?: number, onStep?: (step: SwapFromWalletStep) => void) {
        if (!this.#canSwap) return;

        this.#stage = "swapping";
        this.#error = undefined;
        this.#step = undefined;

        const outcome = await this.#client.swapTokens(
            this.#quote!,
            this.warningConfirmed,
            (step) => {
                this.#step = step;
                onStep?.(step);
            },
            slippagePct,
        );

        if (outcome.kind === "cancelled") {
            this.#stage = "confirm";
        } else {
            this.#outcome = outcome;
            this.#stage = "done";
        }
    }

    backToQuote() {
        this.#stage = "quote";
        this.#clearQuotes();
        this.#outcome = undefined;
    }

    // Drops the quotes, along with any request for them still being answered and why the last
    // request gave no quote
    #clearQuotes() {
        this.#quoteRequest++;
        this.#quoting = false;
        this.#error = undefined;
        this.#quotes = [];
        this.#quote = undefined;
    }

    async #loadSwaps() {
        const ledger = this.#inToken.ledger;
        const swaps = await this.#client.getTokenSwaps(ledger);
        // The user picked another input token while this one's swaps were loading
        if (ledger !== this.#inToken.ledger) return;

        this.#outToken = undefined;
        this.#swaps = swaps;
        this.#swapsFor = ledger;
        this.#loaded = true;
        this.#client.refreshSwappableTokens();
    }

    async #checkRestricted(): Promise<boolean> {
        try {
            this.#restricted = await this.#client.swapRestricted();
        } catch {
            // the check couldn't be made: it's a legal restriction, so no swap (the old desktop
            // wallet never opened Swap either)
            this.#restricted = true;
        }
        return this.#restricted;
    }
}

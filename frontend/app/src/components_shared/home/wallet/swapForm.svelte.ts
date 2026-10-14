import type {
    DexId,
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
 * The state of a form swapping one token in the user's wallet for another: the tokens, the quote the
 * user is shown and how the swap is going. The amount is the input TokenState's draft. Both trees
 * render it.
 */
export class SwapForm {
    #client: OpenChat;
    #inToken: TokenState;
    #outToken = $state<TokenState>();
    // The tokens the input token can be swapped for, by ledger
    #swaps = $state<Record<string, DexId[]>>({});
    #loaded = $state(false);
    #stage = $state<Stage>("quote");
    #quoting = $state(false);
    #error = $state<ResourceKey>();
    #quote = $state<SwapQuote>();
    #step = $state<SwapFromWalletStep>();
    #outcome = $state<Exclude<SwapOutcome, { kind: "cancelled" }>>();

    // Whether the amount is valid, as the amount input reports it
    validAmount = $state(false);
    // Whether the user has confirmed they understand the quote's value warning
    warningConfirmed = $state(false);

    #canQuote = $derived.by(
        () =>
            this.#loaded &&
            Object.keys(this.#swaps).length > 0 &&
            this.#outToken !== undefined &&
            this.validAmount &&
            !this.#quoting &&
            this.#stage !== "swapping",
    );
    #canSwap = $derived.by(
        () =>
            this.#stage === "confirm" &&
            this.#quote !== undefined &&
            (this.#quote.valueWarning === undefined || this.warningConfirmed),
    );

    constructor(client: OpenChat, inToken: TokenState) {
        this.#client = client;
        this.#inToken = $state(inToken);
        this.#loadSwaps();
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
        this.#loadSwaps();
    }

    selectOut(token: EnhancedTokenDetails) {
        this.#outToken = new TokenState(token, "usd");
    }

    async getQuote() {
        if (!this.#canQuote) return;

        this.#quoting = true;
        this.#error = undefined;
        this.#quote = undefined;
        this.#outcome = undefined;
        this.warningConfirmed = false;

        const outcome = await this.#client.getSwapQuote(
            this.#inToken.ledger,
            this.#outToken!.ledger,
            this.#inToken.draftAmount,
        );
        this.#quoting = false;

        if (outcome.kind === "quoted") {
            this.#quote = outcome.quote;
            this.#stage = "confirm";
        } else {
            this.#error = outcome.message;
            this.#stage = "quote";
        }
    }

    async swap() {
        if (!this.#canSwap) return;

        this.#stage = "swapping";
        this.#error = undefined;
        this.#step = undefined;

        const outcome = await this.#client.swapTokens(
            this.#quote!,
            this.warningConfirmed,
            (step) => (this.#step = step),
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
        this.#quote = undefined;
        this.#outcome = undefined;
    }

    async #loadSwaps() {
        const ledger = this.#inToken.ledger;
        const swaps = await this.#client.getTokenSwaps(ledger);
        // The user picked another input token while this one's swaps were loading
        if (ledger !== this.#inToken.ledger) return;

        this.#outToken = undefined;
        this.#swaps = swaps;
        this.#loaded = true;
        this.#client.refreshSwappableTokens();
    }
}

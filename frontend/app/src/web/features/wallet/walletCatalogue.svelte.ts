import {
    cryptoTokensSorted,
    exchangeRatesLookupStore,
    swappableTokensStore,
    walletConfigStore,
} from "@client";
import type { WalletToken } from "@openchat/ui/src/lib/types";
import { tokenActionsContext } from "@src/logic/wallet/tokenActions";
import { createSubscriber } from "svelte/reactivity";
import { walletTokens } from "./wallet.adapter";

/**
 * The wallet's catalogue as both wallet screens list it (walletTokens over cryptoTokensSorted),
 * built once for both: it follows the tokens, the rates, the swappable tokens and the wallet's
 * config, and is kept while anything reads it. Each store emits on subscribe, which is skipped.
 */
class WalletCatalogue {
    #cache: WalletToken[] | undefined;
    #watched = false;

    #subscribe = createSubscriber((update) => {
        this.#watched = true;
        const unsubs = [
            cryptoTokensSorted,
            exchangeRatesLookupStore,
            swappableTokensStore,
            walletConfigStore,
        ].map((store) => {
            let first = true;
            return store.subscribe(() => {
                if (first) {
                    first = false;
                    return;
                }
                this.#cache = undefined;
                update();
            });
        });
        return () => {
            unsubs.forEach((unsub) => unsub());
            this.#watched = false;
            this.#cache = undefined;
        };
    });

    get tokens(): WalletToken[] {
        this.#subscribe();
        // kept only while watched: unwatched, a store could change without the cache hearing
        const build = () =>
            walletTokens(
                cryptoTokensSorted.value,
                exchangeRatesLookupStore.value,
                tokenActionsContext(swappableTokensStore.value, walletConfigStore.value),
            );
        if (!this.#watched) return build();
        this.#cache ??= build();
        return this.#cache;
    }
}

export const walletCatalogue = new WalletCatalogue();

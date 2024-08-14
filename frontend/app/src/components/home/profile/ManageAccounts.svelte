<script lang="ts">
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { getContext, onMount } from "svelte";
    import { OpenChat } from "openchat-client";
    import Toggle from "../../Toggle.svelte";
    import Search from "../../Search.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    let searchTerm = "";
    let searching = false;

    $: accountsSorted = client.cryptoTokensSorted;
    $: favouriteTokenSymbols = client.favouriteTokenSymbols;
    $: searchTermLower = searchTerm.toLowerCase();
    $: filteredTokens = $accountsSorted.filter(
        (token) =>
            searchTermLower === "" ||
            token.name.toLowerCase().startsWith(searchTermLower) ||
            token.symbol.toLowerCase().startsWith(searchTermLower),
    );

    let favourites = new Set<string>();

    onMount(() => {
        favourites = new Set($favouriteTokenSymbols);
        return () => {
            client.setFavouriteTokens(favourites);
        };
    });

    function toggle(symbol: string) {
        if (favourites.has(symbol)) {
            favourites.delete(symbol);
        } else {
            favourites.add(symbol);
        }
        favourites = favourites;
    }
</script>

<Overlay>
    <ModalContent closeIcon on:close>
        <div slot="header">
            <Translatable resourceKey={i18nKey("cryptoAccount.manageTokens")} />
        </div>
        <div slot="body" class="body">
            <Search
                fill
                bind:searchTerm
                bind:searching
                placeholder={i18nKey("cryptoAccount.search")} />
            <div class="tokens">
                {#each filteredTokens as token}
                    <div class="token">
                        <div class="token-details">
                            <img
                                alt={token.name}
                                class:disabled={!token.enabled}
                                class="icon"
                                src={token.logo} />
                            <div>
                                {token.symbol}
                            </div>
                        </div>
                        <Toggle
                            checked={favourites.has(token.symbol)}
                            on:change={() => toggle(token.symbol)}
                            small
                            id={`token_${token.symbol}_toggle`}></Toggle>
                    </div>
                {/each}
            </div>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        max-height: 500px;
        gap: $sp5;
    }
    .token {
        display: flex;
        gap: $sp3;
        justify-content: space-between;
        @include nice-scrollbar();
        flex: auto;

        .token-details {
            display: flex;
            gap: $sp3;
        }

        .icon {
            background-size: contain;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background-repeat: no-repeat;
            background-position: top;

            &.disabled {
                filter: grayscale(1);
            }
        }
    }
</style>

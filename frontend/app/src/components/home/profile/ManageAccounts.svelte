<script lang="ts">
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { getContext, onMount } from "svelte";
    import { OpenChat } from "openchat-client";
    import Toggle from "../../Toggle.svelte";

    const client = getContext<OpenChat>("client");

    $: accountsSorted = client.cryptoTokensSorted;
    $: favouriteTokenSymbols = client.favouriteTokenSymbols;

    let favourites = new Set();

    onMount(() => {
        favourites = new Set($favouriteTokenSymbols);
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
        <div slot="body" class="tokens">
            {#each $accountsSorted as token}
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
    </ModalContent>
</Overlay>

<style lang="scss">
    .token {
        display: flex;
        gap: $sp3;
        justify-content: space-between;

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

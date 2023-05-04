<script lang="ts">
    import { fade } from "svelte/transition";
    import { cryptoCurrencyList, cryptoLookup } from "openchat-client";
    import type { Cryptocurrency } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "stores/iconSize";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let token: Cryptocurrency;
    export let isDiamond: boolean;

    let selecting = false;

    $: crypto = cryptoCurrencyList
        .map((t) => ({
            key: t,
            symbol: cryptoLookup[t].symbol,
            name: $_(`tokenTransfer.${t}`),
            disabled: cryptoLookup[t].disabled,
            requiresUpgrade: cryptoLookup[t].diamond && !isDiamond,
        }))
        .filter((token) => !token.disabled);

    function selectToken(symbol: Cryptocurrency, requiresUpgrade: boolean) {
        selecting = false;

        if (requiresUpgrade) {
            dispatch("upgrade");
        } else {
            token = symbol;
        }
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            selecting = false;
        }
    }
</script>

<div class="selected" on:click={() => (selecting = !selecting)}>
    <div class="symbol">
        {cryptoLookup[token].symbol}
    </div>
    <div class="icon" class:selecting>
        <ChevronDown viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
    </div>
</div>

{#if selecting}
    <div transition:fade|local={{ duration: 100 }} class="tokens">
        {#each crypto as token}
            <div
                class:upgrade={token.requiresUpgrade}
                class="token"
                on:click={() => selectToken(token.key, token.requiresUpgrade)}>
                <div class={`icon ${token.key}`} />
                <div class="name">
                    {token.name}
                </div>
                <div class="symbol">
                    {token.symbol}
                </div>
                {#if token.requiresUpgrade}
                    <div class="upgrade">💎</div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<svelte:window on:click={() => (selecting = false)} on:keydown={onKeyDown} />

<style type="text/scss">
    .tokens {
        position: absolute;
        background-color: var(--menu-bg);
        @include z-index("popup-menu");
        box-shadow: var(--menu-sh);
        border-radius: $sp2;
        border: 1px solid var(--menu-bd);
        cursor: pointer;
    }

    .icon {
        transition: transform 250ms ease-in-out;
        transform-origin: 50%;
        &.selecting {
            transform: rotate(180deg);
        }
    }

    .selected {
        display: flex;
        align-items: center;
        gap: $sp2;
        cursor: pointer;
    }

    .symbol {
        color: var(--primary);
    }

    .token {
        padding: $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
        color: var(--menu-txt);
        @include font(bold, normal, fs-80);
        font-family: "Roboto", sans-serif;

        &:hover {
            background-color: var(--menu-hv);
        }

        .symbol {
            color: var(--primary);
        }

        .icon {
            background-size: contain;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background-repeat: no-repeat;
            background-position: top;
            &.icp {
                background-image: url("../assets/icp_token.svg");
            }
            &.sns1 {
                background-image: url("../assets/sns1_token.png");
            }
            &.ckbtc {
                background-image: url("../assets/ckbtc_nobackground.svg");
            }
            &.chat {
                background-image: url("../assets/spinner.svg");
            }
        }

        .upgrade {
            text-align: end;
            flex: auto;
        }
    }
</style>

<script lang="ts">
    import { fade } from "svelte/transition";
    import { cryptoCurrencyList } from "openchat-client";
    import type { Cryptocurrency } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "stores/iconSize";

    export let token: Cryptocurrency;

    let selecting = false;

    $: crypto = cryptoCurrencyList.map((t, i) => ({
        symbol: t,
        name: $_(`tokenTransfer.${t}`),
        disabled: !process.env.ENABLE_MULTI_CRYPTO && i > 0,
    }));

    function selectToken(symbol: Cryptocurrency) {
        token = symbol;
        selecting = false;
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            selecting = false;
        }
    }
</script>

<div class="selected" on:click={() => (selecting = !selecting)}>
    <div class="symbol">
        {token.toUpperCase()}
    </div>
    <div class="icon" class:selecting>
        <ChevronDown viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
    </div>
</div>

{#if selecting}
    <div transition:fade|local={{ duration: 100 }} class="tokens">
        {#each crypto as token}
            <div class="token" on:click={() => selectToken(token.symbol)}>
                <div class={`icon ${token.symbol}`} />

                <div class="name">
                    {token.name}
                </div>

                <div class="symbol">
                    {token.symbol.toUpperCase()}
                </div>
                {#if token.disabled}
                    <span class="coming-soon">{$_("cryptoAccount.comingSoon")}</span>
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
                background-image: url("../assets/icp_token.png");
            }
            &.btc {
                background-image: url("../assets/bitcoin_token.png");
            }
            &.chat {
                background-image: url("../assets/spinner.svg");
            }
        }

        .coming-soon {
            color: var(--txt-light);
            @include font(light, normal, fs-60);
        }
    }
</style>

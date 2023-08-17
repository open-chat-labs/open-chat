<script lang="ts">
    import { fade } from "svelte/transition";
    import type { OpenChat } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let ledger: string;

    let selecting = false;

    $: cryptoBalance = client.cryptoBalance;

    $: cryptoLookup = client.cryptoLookup;
    $: crypto = Object.values($cryptoLookup).map((t) => ({
        ledger: t.ledger,
        symbol: t.symbol,
        name: t.name,
        logo: t.logo,
        balance: $cryptoBalance[t.ledger] ?? BigInt(0),
    }));

    $: {
        crypto.sort((a, b) => {
            if (a.balance < b.balance) {
                return 1;
            } else if (a.balance > b.balance) {
                return -1;
            } else {
                return 0;
            }
        });
    }

    function selectToken(selectedLedger: string) {
        selecting = false;
        ledger = selectedLedger;
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            selecting = false;
        }
    }
</script>

<div class="selected" on:click={() => (selecting = !selecting)}>
    <div class="symbol">
        {$cryptoLookup[ledger].symbol}
    </div>
    <div class="icon" class:selecting>
        <ChevronDown viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
    </div>
</div>

{#if selecting}
    <div transition:fade|local={{ duration: 100 }} class="tokens">
        {#each crypto as token}
            <div class="token" on:click={() => selectToken(token.ledger)}>
                <img class="icon" src={token.logo} />
                <div class="name">
                    {token.name}
                </div>
                <div class="symbol">
                    {token.symbol}
                </div>
            </div>
        {/each}
    </div>
{/if}

<svelte:window on:click={() => (selecting = false)} on:keydown={onKeyDown} />

<style lang="scss">
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

        @media (hover: hover) {
            &:hover {
                background-color: var(--menu-hv);
            }
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
        }
    }
</style>

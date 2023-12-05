<script lang="ts">
    import { fade } from "svelte/transition";
    import type { EnhancedTokenDetails, OpenChat } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher, getContext } from "svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let ledger: string | undefined;
    export let filter: (details: EnhancedTokenDetails) => boolean = (_) => true;

    let selecting = false;
    let ignoreClick = false;

    $: cryptoLookup = client.enhancedCryptoLookup;
    $: crypto = Object.values($cryptoLookup).filter((t) => filter(t));

    $: {
        if (ledger === undefined && crypto.length > 0) {
            ledger = crypto[0].ledger;
        }
    }

    function selectToken(selectedLedger: string, urlFormat: string) {
        selecting = false;
        ledger = selectedLedger;
        dispatch("select", { ledger, urlFormat });
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            selecting = false;
        }
    }

    function toggle() {
        selecting = !selecting;
        if (selecting) {
            ignoreClick = true;
        }
    }

    function windowClick() {
        if (selecting && !ignoreClick) {
            selecting = false;
        }
        ignoreClick = false;
    }
</script>

{#if crypto.length > 0 && ledger !== undefined}
    <div class="selected" on:click={toggle}>
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
                <div class="token" on:click={() => selectToken(token.ledger, token.urlFormat)}>
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
{/if}

<svelte:window on:click={windowClick} on:keydown={onKeyDown} />

<style lang="scss">
    .tokens {
        position: absolute;
        background-color: var(--menu-bg);
        @include z-index("popup-menu");
        box-shadow: var(--menu-sh);
        border-radius: var(--rd);
        border: 1px solid var(--menu-bd);
        cursor: pointer;
        max-height: 250px;
        @include nice-scrollbar();
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
        padding: $sp3 $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
        color: var(--menu-txt);
        @include font(bold, normal, fs-80);
        font-family: var(--font);

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

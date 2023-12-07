<script lang="ts">
    import type { EnhancedTokenDetails, OpenChat } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher, getContext } from "svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";

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

    function windowClick() {
        if (selecting && !ignoreClick) {
            selecting = false;
        }
        ignoreClick = false;
    }

    const crypto2 = [
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
        {
            ledger: "whatever",
            urlFormat: "",
            logo: "",
            name: "whatever",
            symbol: "ICP",
        },
    ];
</script>

{#if crypto.length > 0 && ledger !== undefined}
    <MenuIcon centered position={"bottom"} align={"start"}>
        <div class="token-selector-trigger" slot="icon">
            <div class="symbol">
                {$cryptoLookup[ledger].symbol}
            </div>
            <ChevronDown viewBox={"0 0 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
        </div>

        <div slot="menu">
            <Menu centered>
                {#each crypto2 as token}
                    <MenuItem on:click={() => selectToken(token.ledger, token.urlFormat)}>
                        <img slot="icon" class="token-icon" src={token.logo} />
                        <div class="token-text" slot="text">
                            <div class="name">
                                {token.name}
                            </div>
                            <div class="symbol">
                                {token.symbol}
                            </div>
                        </div>
                    </MenuItem>
                {/each}
            </Menu>
        </div>
    </MenuIcon>
{/if}

<svelte:window on:click={windowClick} on:keydown={onKeyDown} />

<style lang="scss">
    :global(.token-selector-trigger .menu-icon.open) {
        transform: rotate(180deg);
    }

    :global(.token-selector-trigger .menu-icon) {
        transition: transform 250ms ease-in-out;
        transform-origin: 50%;
    }

    .token-selector-trigger {
        display: flex;
        cursor: pointer;
        align-items: center;
        gap: $sp1;
    }

    .token-icon {
        background-size: contain;
        height: $sp5;
        width: $sp5;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: top;
    }

    .token-text {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .symbol {
        color: var(--primary);
    }
</style>

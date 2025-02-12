<script lang="ts">
    import type { EnhancedTokenDetails } from "openchat-client";
    import { cryptoLookup, cryptoTokensSorted } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher } from "svelte";
    import MenuIcon from "../MenuIconLegacy.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItemLegacy.svelte";

    const dispatch = createEventDispatcher();

    export let ledger: string | undefined;
    export let filter: (details: EnhancedTokenDetails) => boolean = (_) => true;

    let selecting = false;
    let ignoreClick = false;

    $: cryptoTokensFiltered = $cryptoTokensSorted.filter((t) => t.enabled && filter(t));

    $: {
        if (ledger === undefined && cryptoTokensFiltered.length > 0) {
            ledger = cryptoTokensFiltered[0].ledger;
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
</script>

{#if cryptoTokensFiltered.length > 0 && ledger !== undefined}
    <MenuIcon centered position={"bottom"} align={"start"}>
        <div class="token-selector-trigger" slot="icon">
            <div class="symbol">
                {$cryptoLookup[ledger].symbol}
            </div>
            <ChevronDown viewBox={"0 0 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
        </div>

        <div slot="menu">
            <Menu centered>
                {#each cryptoTokensFiltered as token}
                    <MenuItem onclick={() => selectToken(token.ledger, token.urlFormat)}>
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

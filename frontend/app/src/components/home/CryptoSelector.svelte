<script lang="ts">
    import type { EnhancedTokenDetails } from "openchat-client";
    import { cryptoLookup, cryptoTokensSorted } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { iconSize } from "../../stores/iconSize";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";

    interface Props {
        ledger: string | undefined;
        filter?: (details: EnhancedTokenDetails) => boolean;
        onSelect: (ledger: string, urlFormat: string) => void;
    }

    let { ledger = $bindable(), filter = (_) => true, onSelect }: Props = $props();

    let selecting = false;
    let ignoreClick = false;

    let cryptoTokensFiltered = $derived($cryptoTokensSorted.filter((t) => t.enabled && filter(t)));

    $effect(() => {
        if (ledger === undefined && cryptoTokensFiltered.length > 0) {
            ledger = cryptoTokensFiltered[0].ledger;
        }
    });

    function selectToken(selectedLedger: string, urlFormat: string) {
        selecting = false;
        ledger = selectedLedger;
        onSelect(ledger, urlFormat);
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
        {#snippet menuIcon()}
            <div class="token-selector-trigger">
                <div class="symbol">
                    {$cryptoLookup[ledger ?? ""]?.symbol}
                </div>
                <ChevronDown viewBox={"0 0 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        {/snippet}

        {#snippet menuItems()}
            <div>
                <Menu centered>
                    {#each cryptoTokensFiltered as token}
                        <MenuItem onclick={() => selectToken(token.ledger, token.urlFormat)}>
                            {#snippet icon()}
                                <img class="token-icon" src={token.logo} />
                            {/snippet}
                            {#snippet text()}
                                <div class="token-text">
                                    <div class="name">
                                        {token.name}
                                    </div>
                                    <div class="symbol">
                                        {token.symbol}
                                    </div>
                                </div>
                            {/snippet}
                        </MenuItem>
                    {/each}
                </Menu>
            </div>
        {/snippet}
    </MenuIcon>
{/if}

<svelte:window onclick={windowClick} onkeydown={onKeyDown} />

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

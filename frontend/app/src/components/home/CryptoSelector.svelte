<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import type { EnhancedTokenDetails } from "openchat-client";
    import { cryptoLookup, cryptoTokensSorted, iconSize } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Search from "../Search.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        ledger: string | undefined;
        filter?: (details: EnhancedTokenDetails) => boolean;
        onSelect?: (ledger: string, urlFormat: string) => void;
    }

    let { ledger = $bindable(), filter = (_) => true, onSelect }: Props = $props();

    let selecting = false;
    let ignoreClick = false;

    let allAvailableTokens = $derived($cryptoTokensSorted.filter((t) => t.enabled && filter(t)));
    let filteredTokens = $derived(allAvailableTokens.filter(matchesSearch));

    $effect(() => {
        if (ledger === undefined && allAvailableTokens.length > 0) {
            ledger = allAvailableTokens[0].ledger;
        }
    });

    function matchesSearch(details: EnhancedTokenDetails): boolean {
        return (
            searchTerm === "" ||
            details.name.toLowerCase().includes(searchTermLower) ||
            details.symbol.toLowerCase().includes(searchTermLower)
        );
    }

    function selectToken(selectedLedger: string, urlFormat: string) {
        selecting = false;
        ledger = selectedLedger;
        onSelect?.(ledger, urlFormat);
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

    let searching = $state(false);
    let searchTerm = $state("");
    let searchTermLower = $derived(searchTerm.toLowerCase());
    function searchClicked(e?: Event) {
        e?.preventDefault();
        e?.stopPropagation();
    }
</script>

{#if allAvailableTokens.length > 0 && ledger !== undefined}
    <MenuIcon centered position={"bottom"} align={"start"}>
        {#snippet menuIcon()}
            <div class="token-selector-trigger">
                <div class="symbol">
                    {$cryptoLookup.get(ledger ?? "")?.symbol}
                </div>
                <ChevronDown viewBox={"0 0 24 24"} size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        {/snippet}

        {#snippet menuItems()}
            <div>
                <Menu centered>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div onclick={searchClicked} class="search">
                        <Search
                            placeholder={i18nKey("search")}
                            fill
                            autofocus
                            bind:searching
                            bind:searchTerm></Search>
                    </div>
                    {#if filteredTokens.length === 0}
                        <div class="no_match">
                            <Translatable resourceKey={i18nKey("No matching tokens")}
                            ></Translatable>
                        </div>
                    {:else}
                        {#each filteredTokens as token}
                            <MenuItem onclick={() => selectToken(token.ledger, token.urlFormat)}>
                                {#snippet icon()}
                                    <img alt={token.symbol} class="token-icon" src={token.logo} />
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
                    {/if}
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

    .no_match {
        padding: $sp3;
        color: var(--txt-light);
    }

    .search {
        padding: $sp3;
    }
</style>

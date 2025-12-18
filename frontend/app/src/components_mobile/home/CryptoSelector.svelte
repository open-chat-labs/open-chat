<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { hideTokenBalances } from "@src/stores/settings";
    import { Avatar, Body, BodySmall, ColourVars, Column, Row, type SizeMode } from "component-lib";
    import type { EnhancedTokenDetails, OpenChat } from "openchat-client";
    import { enhancedCryptoLookup } from "openchat-client";
    import { getContext } from "svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import TokenSelector from "./wallet/TokenSelector.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        width?: SizeMode;
        ledger: string;
        filter?: (details: EnhancedTokenDetails) => boolean;
        onSelect?: (ledger: string, urlFormat: string) => void;
        draftAmount?: bigint;
        showRefresh?: boolean;
    }

    let {
        ledger = $bindable(),
        filter,
        onSelect,
        width = "fill",
        draftAmount,
        showRefresh = false,
    }: Props = $props();
    let token = $derived($enhancedCryptoLookup.get(ledger));
    let showTokenSelector = $state(false);
    let tokenState = $derived(token ? new TokenState(token, "usd") : undefined);

    $effect(() => {
        if (draftAmount !== undefined && tokenState !== undefined) {
            tokenState.draftAmount = draftAmount;
        }
    });
</script>

{#if tokenState}
    <Row crossAxisAlignment={"center"} gap={"sm"}>
        <Row
            {width}
            background={ColourVars.textTertiary}
            gap={"md"}
            borderRadius={"circle"}
            onClick={() => (showTokenSelector = true)}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            padding={["sm", "md"]}>
            <Avatar url={tokenState.logo}></Avatar>
            <Column>
                <Body width={"hug"} fontWeight={"bold"}>{tokenState.symbol}</Body>
                <BodySmall
                    colour={"textSecondary"}
                    blur={$hideTokenBalances}
                    align={"end"}
                    width={"hug"}
                    fontWeight={"bold"}>{tokenState.formattedTokenBalance}</BodySmall>
            </Column>
            <ChevronDown size={"1.5rem"} color={ColourVars.textSecondary} />
        </Row>
        {#if showRefresh}
            <button
                onclick={() => tokenState.refreshBalance(client)}
                class="refresh"
                class:refreshing={tokenState.refreshingBalance}>
                <Refresh size={"1.5rem"} color={ColourVars.textPrimary} />
            </button>
        {/if}
    </Row>
{/if}

{#if showTokenSelector}
    <TokenSelector
        selected={new Set(ledger)}
        onSelect={(t) => {
            ledger = t.ledger;
            showTokenSelector = false;
            onSelect?.(t.ledger, t.urlFormat);
        }}
        extraFilter={filter}
        placeholder={i18nKey("Filter tokens...")}
        onDismiss={() => (showTokenSelector = false)}
        title={i18nKey("Select token")} />
{/if}

<style lang="scss">
    .refresh {
        all: unset;
        border-radius: var(--rad-circle);
        background-color: var(--background-2);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 3.625rem;
        height: 3.625rem;

        &.refreshing {
            @include spin();
        }
    }
</style>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { hideTokenBalances } from "@src/stores/settings";
    import { Avatar, Body, BodySmall, ColourVars, Column, Row, type SizeMode } from "component-lib";
    import type { EnhancedTokenDetails } from "openchat-client";
    import { enhancedCryptoLookup } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import TokenSelector from "./wallet/TokenSelector.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    interface Props {
        width?: SizeMode;
        ledger: string;
        filter?: (details: EnhancedTokenDetails) => boolean;
        onSelect?: (ledger: string, urlFormat: string) => void;
        draftAmount?: bigint;
    }

    let { ledger = $bindable(), filter, onSelect, width = "fill", draftAmount }: Props = $props();
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
    <Row
        {width}
        background={ColourVars.background2}
        gap={"md"}
        borderRadius={"lg"}
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

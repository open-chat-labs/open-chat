<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Avatar, ColourVars, Container, Subtitle } from "component-lib";
    import type { EnhancedTokenDetails } from "openchat-client";
    import { cryptoLookup, cryptoTokensSorted } from "openchat-client";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import TokenSelector from "./wallet/TokenSelector.svelte";

    interface Props {
        ledger: string | undefined;
        filter?: (details: EnhancedTokenDetails) => boolean;
        onSelect?: (ledger: string, urlFormat: string) => void;
    }

    let { ledger = $bindable(), filter = (_) => true, onSelect }: Props = $props();

    let allAvailableTokens = $derived($cryptoTokensSorted.filter((t) => t.enabled && filter(t)));

    $effect(() => {
        if (ledger === undefined && allAvailableTokens.length > 0) {
            ledger = allAvailableTokens[0].ledger;
        }
    });

    let showTokenSelector = $state(false);
    let token = $derived($cryptoLookup.get(ledger ?? ""));
</script>

<Container
    supplementalClass={"wallet_token"}
    width={"hug"}
    gap={"sm"}
    onClick={() => (showTokenSelector = true)}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    padding={"sm"}>
    {#if token}
        <Avatar size={"sm"} url={token.logo}></Avatar>
        <Subtitle width={"hug"} fontWeight={"bold"}>{token.symbol}</Subtitle>
    {/if}
    <ChevronDown size={"1.5rem"} color={ColourVars.primary} />
</Container>

{#if showTokenSelector}
    <TokenSelector
        selected={new Set(ledger)}
        onSelect={(t) => {
            ledger = t.ledger;
            showTokenSelector = false;
            onSelect?.(t.ledger, t.urlFormat);
        }}
        placeholder={i18nKey("Filter tokens...")}
        onDismiss={() => (showTokenSelector = false)}
        title={i18nKey("Select token")} />
{/if}

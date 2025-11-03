<script lang="ts">
    import { Container, Sheet } from "component-lib";
    import { walletTokensSorted as accountsSorted, type OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import AccountTransactions from "../profile/AccountTransactions.svelte";
    import RestrictedFeature from "../profile/RestrictedFeature.svelte";
    import SendCrypto from "../profile/SendCrypto.svelte";
    import SwapCrypto from "../profile/SwapCrypto.svelte";
    import WalletToken from "./WalletToken.svelte";
    import type { ConversionToken } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedConversion?: ConversionToken;
    }

    let { selectedConversion = $bindable("usd") }: Props = $props();

    let balanceError: string | undefined = $state();
    let actionMode: "none" | "send" | "receive" | "swap" | "transactions" | "restricted" =
        $state("none");
    let selectedLedger: string | undefined = $state(undefined);
    let transactionsFormat: string = $state("");

    onMount(() => client.refreshSwappableTokens());

    function hideManageModal() {
        actionMode = "none";
    }

    function removeFromWallet(ledger: string) {
        client.removeTokenFromWallet(ledger);
    }
</script>

{#if actionMode !== "none" && selectedLedger !== undefined}
    <Sheet onDismiss={hideManageModal}>
        {#if actionMode === "send"}
            <SendCrypto ledger={selectedLedger} onClose={hideManageModal} />
        {:else if actionMode === "swap"}
            <SwapCrypto bind:ledgerIn={selectedLedger} onClose={hideManageModal} />
        {:else if actionMode === "transactions"}
            <AccountTransactions
                ledger={selectedLedger}
                onClose={hideManageModal}
                urlFormat={transactionsFormat} />
        {:else if actionMode === "restricted"}
            <RestrictedFeature onClose={hideManageModal} feature="swap" />
        {/if}
    </Sheet>
{/if}

<Container gap={"sm"} height={{ kind: "fill" }} direction={"vertical"}>
    {#each $accountsSorted as token (token.ledger)}
        <WalletToken {selectedConversion} {token} onRemoveFromWallet={removeFromWallet} />
    {/each}
    {#if balanceError !== undefined}
        <ErrorMessage>{balanceError}</ErrorMessage>
    {/if}
</Container>

<style lang="scss">
    :global(.menu_trigger_clone > .wallet_token) {
        border-radius: var(--rad-md) !important;
        background-color: var(--background-1) !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }

    :global(.manage .link-button) {
        padding: 0 0 0 $sp3;
        &:first-child {
            border-right: 1px solid var(--txt-light);
            padding: 0 $sp3 0 0;
        }
    }
</style>

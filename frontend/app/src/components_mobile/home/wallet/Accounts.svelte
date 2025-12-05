<script lang="ts">
    import { Container, Sheet } from "component-lib";
    import { walletTokensSorted as accountsSorted, publish, type OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import RestrictedFeature from "../profile/RestrictedFeature.svelte";
    import WalletToken from "./WalletToken.svelte";
    import type { ConversionToken } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedConversion?: ConversionToken;
    }

    let { selectedConversion = $bindable("usd") }: Props = $props();

    let balanceError: string | undefined = $state();
    let actionMode: "none" | "swap" | "restricted" = $state("none");
    let selectedLedger: string | undefined = $state(undefined);

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
        {#if actionMode === "swap"}
            <ErrorMessage>TODO - get rid of this</ErrorMessage>
        {:else if actionMode === "restricted"}
            <RestrictedFeature onClose={hideManageModal} feature="swap" />
        {/if}
    </Sheet>
{/if}

<Container closeMenuOnScroll gap={"sm"} height={"fill"} direction={"vertical"}>
    {#each $accountsSorted as token (token.ledger)}
        <WalletToken
            withMenu
            onClick={(tokenState) => publish("tokenPage", tokenState)}
            {selectedConversion}
            {token}
            onRemoveFromWallet={removeFromWallet} />
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

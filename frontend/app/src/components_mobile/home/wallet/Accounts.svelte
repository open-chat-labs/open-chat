<script lang="ts">
    import { BodySmall, ColourVars, Container, Sheet } from "component-lib";
    import {
        walletTokensSorted as accountsSorted,
        i18nKey,
        publish,
        walletTokensUnavailable,
        type OpenChat,
    } from "@client";
    import AlertOutline from "svelte-material-icons/AlertOutline.svelte";
    import { getContext, onMount } from "svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import RestrictedFeature from "../profile/RestrictedFeature.svelte";
    import WalletToken from "./WalletToken.svelte";
    import {
        unavailableTokensLabel,
        type ConversionToken,
    } from "@src/logic/wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedConversion?: ConversionToken;
    }

    let { selectedConversion = $bindable("usd") }: Props = $props();

    let actionMode: "none" | "swap" | "restricted" = $state("none");
    const selectedLedger: string | undefined = $state(undefined);

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

{#snippet header_item(key: string)}
    <BodySmall colour="textOnDisabledSurface" fontWeight="bold" width="hug">
        <Translatable resourceKey={i18nKey(`appWallet.header.${key}`)} />
    </BodySmall>
{/snippet}

<Container
    closeMenuOnScroll
    height={"fill"}
    direction={"vertical"}
    padding={["zero", "sm", "huge"]}
    overflow="initial">
    <!-- Tokens header -->
    <!-- TODO stick headers to top when scrolling -->
    <Container supplementalClass="wallet_tokens_header" gap="md">
        <Container crossAxisAlignment="start" width="fill">
            {@render header_item("asset")}
        </Container>
        <Container mainAxisAlignment="end" width={{ size: "6rem" }}>
            {@render header_item("holdings")}
        </Container>
        <!-- TODO enable asc desc sorting by total! -->
        <Container mainAxisAlignment="end" width={{ size: "6rem" }}>
            {@render header_item("total")}
        </Container>
    </Container>
    <!-- Tokens list -->
    {#each $accountsSorted as token (token.ledger)}
        <WalletToken
            withMenu
            onClick={(tokenState) => publish("tokenPage", tokenState)}
            {selectedConversion}
            {token}
            onRemoveFromWallet={removeFromWallet} />
    {/each}
    <!-- the balances the wallet asked for and couldn't get (a ledger out of cycles answers
         nothing): the listed ones are marked in their rows, and an automatic wallet can't tell
         whether to list the others, so they are named here -->
    {#if $walletTokensUnavailable.length > 0}
        <Container gap={"md"} padding={["lg", "lg"]} crossAxisAlignment={"start"}>
            <span class="alert">
                <AlertOutline size="1.25rem" color={ColourVars.validationWarning} />
            </span>
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey("cryptoAccount.balancesUnavailable", {
                        tokens: unavailableTokensLabel($walletTokensUnavailable),
                    })} />
            </BodySmall>
        </Container>
    {/if}
</Container>

<style lang="scss">
    .alert {
        display: flex;
        flex: none;
    }

    :global(.manage .link-button) {
        padding: 0 0 0 $sp3;
        &:first-child {
            border-right: 1px solid var(--txt-light);
            padding: 0 $sp3 0 0;
        }
    }

    :global(.wallet_tokens_header) {
        padding-left: 4.25rem !important;
        padding-right: 2.5rem !important;
        padding-bottom: var(--sp-sm) !important;
    }
</style>

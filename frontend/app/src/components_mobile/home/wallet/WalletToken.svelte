<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { hideTokenBalances } from "@src/stores/settings";
    import { toastStore } from "@src/stores/toast";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        Container,
        MenuItem,
        MenuTrigger,
    } from "component-lib";
    import {
        OpenChat,
        publish,
        walletConfigStore,
        type EnhancedTokenDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import HeartRemoveOutline from "svelte-material-icons/HeartRemoveOutline.svelte";
    import MenuRight from "svelte-material-icons/MenuRight.svelte";
    import Reload from "svelte-material-icons/Reload.svelte";
    import Translatable from "../../Translatable.svelte";
    import { TokenState, type ConversionToken } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedConversion: ConversionToken;
        token: EnhancedTokenDetails;
        onRemoveFromWallet: (ledger: string) => void;
    }

    let { selectedConversion, token, onRemoveFromWallet }: Props = $props();

    let tokenState = $derived(new TokenState(token, selectedConversion));
    let manualWalletConfig = $derived($walletConfigStore.kind === "manual_wallet");
    let refreshing = $state(false);

    function refreshBalance(ledger: string) {
        refreshing = true;

        return client
            .refreshAccountBalance(ledger, true)
            .catch((_) => {
                toastStore.showFailureToast(
                    i18nKey("unableToRefreshAccountBalance", { token: token.symbol }),
                );
            })
            .finally(() => (refreshing = false));
    }
</script>

<MenuTrigger
    mobileMode={"longpress"}
    fill
    maskUI
    classString={"token_menu_trigger"}
    position={"bottom"}
    align={"end"}>
    {#snippet menuItems()}
        <MenuItem onclick={() => refreshBalance(token.ledger)}>
            {#snippet icon(color)}
                <Reload {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Refresh balance")} />
        </MenuItem>
        <!-- {#if token.symbol === ICP_SYMBOL || snsLedgers.has(token.ledger)}
            <MenuItem onclick={() => onTransactions(token)}>
                {#snippet icon(color)}
                    <ViewList {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.transactions")} />
            </MenuItem>
        {/if} -->
        {#if manualWalletConfig}
            <MenuItem onclick={() => onRemoveFromWallet(token.ledger)}>
                {#snippet icon(color)}
                    <HeartRemoveOutline {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.remove")} />
            </MenuItem>
        {/if}
    {/snippet}
    <Container
        supplementalClass={"wallet_token"}
        gap={"md"}
        onClick={() => publish("tokenPage", token)}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        padding={"sm"}>
        <Avatar url={token.logo}></Avatar>
        <Container direction={"vertical"}>
            <Body width={{ kind: "hug" }} fontWeight={"bold"}>{token.symbol}</Body>
            <Caption width={{ kind: "hug" }} colour={"textSecondary"} fontWeight={"bold"}
                >{tokenState.formattedUnitValue}</Caption>
        </Container>
        <BodySmall
            blur={$hideTokenBalances}
            align={"end"}
            width={{ kind: "hug" }}
            fontWeight={"bold"}>{tokenState.formattedTokenBalance}</BodySmall>
        <Body
            blur={$hideTokenBalances}
            align={"end"}
            width={{ kind: "hug" }}
            colour={"primary"}
            fontWeight={"bold"}>{tokenState.formattedConvertedValue}</Body>
        {#if refreshing}
            <Reload color={ColourVars.textSecondary} />
        {:else}
            <MenuRight color={ColourVars.textSecondary} />
        {/if}
    </Container>
</MenuTrigger>

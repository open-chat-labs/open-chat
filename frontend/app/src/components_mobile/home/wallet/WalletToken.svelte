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
        ICP_SYMBOL,
        OpenChat,
        swappableTokensStore,
        walletConfigStore,
        type EnhancedTokenDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import ArrowLeftBoldCircle from "svelte-material-icons/ArrowLeftBoldCircle.svelte";
    import ArrowRightBoldCircle from "svelte-material-icons/ArrowRightBoldCircle.svelte";
    import HeartRemoveOutline from "svelte-material-icons/HeartRemoveOutline.svelte";
    import MenuRight from "svelte-material-icons/MenuRight.svelte";
    import Reload from "svelte-material-icons/Reload.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import ViewList from "svelte-material-icons/ViewList.svelte";
    import Translatable from "../../Translatable.svelte";
    import {
        convertAndFormat,
        formatTokenValue,
        getConvertedTokenValue,
        type ConversionToken,
    } from "./wallet";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedConversion: ConversionToken;
        token: EnhancedTokenDetails;
        snsLedgers: Set<string>;
        onSend: (ledger: string) => void;
        onReceive: (ledger: string) => void;
        onSwap: (ledger: string) => void;
        onRemoveFromWallet: (ledger: string) => void;
        onTransactions: (token: EnhancedTokenDetails) => void;
    }

    let {
        selectedConversion,
        token,
        snsLedgers,
        onSend,
        onReceive,
        onSwap,
        onTransactions,
        onRemoveFromWallet,
    }: Props = $props();
    let manualWalletConfig = $derived($walletConfigStore.kind === "manual_wallet");
    let refreshing = $state(false);
    let tokenValue = $derived(client.formatTokens(token.balance, token.decimals));
    let convertedValue = $derived(
        $hideTokenBalances ? "*****" : convertAndFormat(selectedConversion, token),
    );
    let unitValue = $derived.by(() => {
        const converted = getConvertedTokenValue(selectedConversion, token);
        if (converted === undefined) return "???";
        return formatTokenValue(selectedConversion, converted / Number(token.balance));
    });

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

<MenuTrigger fill maskUI classString={"token_menu_trigger"} position={"bottom"} align={"end"}>
    {#snippet menuItems()}
        <MenuItem onclick={() => refreshBalance(token.ledger)}>
            {#snippet icon(color)}
                <Reload {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Refresh balance")} />
        </MenuItem>
        <MenuItem onclick={() => onSend(token.ledger)}>
            {#snippet icon(color)}
                <ArrowRightBoldCircle {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.send")} />
        </MenuItem>
        {#if token.enabled}
            <MenuItem onclick={() => onReceive(token.ledger)}>
                {#snippet icon(color)}
                    <ArrowLeftBoldCircle {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.receive")} />
            </MenuItem>
            {#if $swappableTokensStore.has(token.ledger)}
                <MenuItem onclick={() => onSwap(token.ledger)}>
                    {#snippet icon(color)}
                        <SwapIcon {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("cryptoAccount.swap")} />
                </MenuItem>
            {/if}
        {/if}
        {#if token.symbol === ICP_SYMBOL || snsLedgers.has(token.ledger)}
            <MenuItem onclick={() => onTransactions(token)}>
                {#snippet icon(color)}
                    <ViewList {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.transactions")} />
            </MenuItem>
        {/if}
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
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        padding={"sm"}>
        <Avatar url={token.logo}></Avatar>
        <Container direction={"vertical"}>
            <Body width={{ kind: "hug" }} fontWeight={"bold"}>{token.symbol}</Body>
            <Caption width={{ kind: "hug" }} colour={"textSecondary"} fontWeight={"bold"}
                >{unitValue}</Caption>
        </Container>
        <BodySmall align={"end"} width={{ kind: "hug" }} fontWeight={"bold"}
            >{tokenValue}</BodySmall>
        <Body align={"end"} width={{ kind: "hug" }} colour={"primary"} fontWeight={"bold"}
            >{convertedValue}</Body>
        {#if refreshing}
            <Reload color={ColourVars.textSecondary} />
        {:else}
            <MenuRight color={ColourVars.textSecondary} />
        {/if}
    </Container>
</MenuTrigger>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { hideTokenBalances } from "@src/stores/settings";
    import {
        Avatar,
        BodySmall,
        ColourVars,
        Container,
        MenuItem,
        MenuTrigger,
        Subtitle,
    } from "component-lib";
    import { OpenChat, walletConfigStore, type EnhancedTokenDetails } from "openchat-client";
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
        onRemoveFromWallet?: (ledger: string) => void;
        withMenu?: boolean;
        onClick?: (tokenState: TokenState) => void;
    }

    let {
        selectedConversion,
        token,
        onRemoveFromWallet,
        withMenu = true,
        onClick,
    }: Props = $props();

    let tokenState = $derived.by(() => {
        const ts = new TokenState(token, selectedConversion);
        client.refreshAccountBalance(token.ledger, true);
        return ts;
    });
    let manualWalletConfig = $derived($walletConfigStore.kind === "manual_wallet");
</script>

{#snippet content()}
    <Container
        supplementalClass={"wallet_token"}
        gap={"md"}
        onClick={onClick ? () => onClick(tokenState) : undefined}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        padding={["md", "sm", "md", "lg"]}>
        <Avatar url={token.logo}></Avatar>
        <Container direction={"vertical"}>
            <Subtitle width={"hug"} fontWeight={"bold"}>{token.symbol}</Subtitle>
            <BodySmall width={"hug"} colour={"textSecondary"} fontWeight={"bold"}
                >{tokenState.formattedUnitValue}</BodySmall>
        </Container>
        <Subtitle
            blur={$hideTokenBalances}
            align={"end"}
            width={{ size: "6rem" }}
            fontWeight={"bold"}>
            {tokenState.formattedTokenBalance}
        </Subtitle>
        <Subtitle
            blur={$hideTokenBalances}
            align={"end"}
            width={{ size: "6rem" }}
            colour={"primary"}
            fontWeight={"bold"}>
            {tokenState.formattedConvertedValue}
        </Subtitle>
        {#if withMenu}
            {#if tokenState.refreshingBalance}
                <Reload color={ColourVars.textSecondary} />
            {:else}
                <MenuRight size="1.25rem" color={ColourVars.textSecondary} />
            {/if}
        {/if}
    </Container>
{/snippet}

{#if withMenu}
    <MenuTrigger
        mobileMode={"longpress"}
        fill
        maskUI
        classString={"token_menu_trigger"}
        position={"bottom"}
        align={"end"}>
        {#snippet menuItems()}
            <MenuItem onclick={() => tokenState.refreshBalance(client)}>
                {#snippet icon(color)}
                    <Reload {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Refresh balance")} />
            </MenuItem>
            {#if manualWalletConfig && onRemoveFromWallet}
                <MenuItem onclick={() => onRemoveFromWallet(token.ledger)}>
                    {#snippet icon(color)}
                        <HeartRemoveOutline {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("cryptoAccount.remove")} />
                </MenuItem>
            {/if}
        {/snippet}
        {@render content()}
    </MenuTrigger>
{:else}
    {@render content()}
{/if}

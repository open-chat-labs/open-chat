<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { ColourVars, CommonButton, Container, MenuItem } from "component-lib";
    import { type EnhancedTokenDetails, publish, swappableTokensStore } from "openchat-client";
    import ArrowLeftBoldCircle from "svelte-material-icons/ArrowLeftBoldCircle.svelte";
    import ArrowRightBoldCircle from "svelte-material-icons/ArrowRightBoldCircle.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import TrayArrowDown from "svelte-material-icons/TrayArrowDown.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenCard from "./TokenCard.svelte";
    import Transactions from "./Transactions.svelte";
    import { TokenState } from "./walletState.svelte";

    interface Props {
        token: EnhancedTokenDetails;
    }

    let { token }: Props = $props();

    let tokenState = $derived(new TokenState(token, "usd"));
</script>

<SlidingPageContent
    title={i18nKey(token.symbol)}
    subtitle={i18nKey(`${tokenState.formattedUnitValue} per ${token.symbol}`)}>
    {#snippet menu()}
        <MenuItem onclick={() => publish("sendToken", token)}>
            {#snippet icon(color)}
                <ArrowRightBoldCircle {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.send")} />
        </MenuItem>
        {#if token.enabled}
            <MenuItem onclick={() => publish("receiveToken", token)}>
                {#snippet icon(color)}
                    <ArrowLeftBoldCircle {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.receive")} />
            </MenuItem>
            {#if $swappableTokensStore.has(token.ledger)}
                <MenuItem onclick={() => publish("swapToken", token)}>
                    {#snippet icon(color)}
                        <SwapIcon {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("cryptoAccount.swap")} />
                </MenuItem>
            {/if}
        {/if}
    {/snippet}
    <Container height={{ kind: "fill" }} padding={"lg"} gap={"lg"} direction={"vertical"}>
        <TokenCard {tokenState} />

        <Container
            padding={["md", "zero"]}
            borderRadius={"md"}
            crossAxisAlignment={"center"}
            mainAxisAlignment={"spaceAround"}
            borderWidth={"thick"}
            borderColour={ColourVars.primary}>
            <CommonButton
                onClick={() => publish("receiveToken", token)}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color)}
                    <TrayArrowDown {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Receive")} />
            </CommonButton>
            /
            <CommonButton
                onClick={() => publish("sendToken", token)}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color)}
                    <TrayArrowUp {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Send")} />
            </CommonButton>
            /
            <CommonButton
                onClick={() => publish("swapToken", token)}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color)}
                    <SwapVertical {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Swap")} />
            </CommonButton>
        </Container>

        <Transactions ledger={token.ledger} urlFormat={token.urlFormat} />
    </Container>
</SlidingPageContent>

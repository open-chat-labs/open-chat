<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { ColourVars, CommonButton, Container, MenuItem } from "component-lib";
    import { publish, swappableTokensStore } from "openchat-client";
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
        tokenState: TokenState;
    }

    let { tokenState }: Props = $props();
</script>

<SlidingPageContent
    title={i18nKey(tokenState.symbol)}
    subtitle={i18nKey(`${tokenState.formattedUnitValue} per ${tokenState.symbol}`)}>
    {#snippet menu()}
        <MenuItem onclick={() => publish("sendToken", tokenState)}>
            {#snippet icon(color)}
                <ArrowRightBoldCircle {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.send")} />
        </MenuItem>
        {#if tokenState.enabled}
            <MenuItem onclick={() => publish("receiveToken", tokenState)}>
                {#snippet icon(color)}
                    <ArrowLeftBoldCircle {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.receive")} />
            </MenuItem>
            {#if $swappableTokensStore.has(tokenState.ledger)}
                <MenuItem onclick={() => publish("swapToken", tokenState)}>
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
                onClick={() => publish("receiveToken", tokenState)}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color)}
                    <TrayArrowDown {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Receive")} />
            </CommonButton>
            /
            <CommonButton
                onClick={() => publish("sendToken", tokenState)}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color)}
                    <TrayArrowUp {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Send")} />
            </CommonButton>
            /
            <CommonButton
                onClick={() => publish("swapToken", tokenState)}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color)}
                    <SwapVertical {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Swap")} />
            </CommonButton>
        </Container>

        <Transactions ledger={tokenState.ledger} urlFormat={tokenState.urlFormat} />
    </Container>
</SlidingPageContent>

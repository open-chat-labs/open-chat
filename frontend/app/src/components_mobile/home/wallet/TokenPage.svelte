<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        CommonButton,
        Container,
        MenuItem,
        Subtitle,
    } from "component-lib";
    import { type EnhancedTokenDetails, swappableTokensStore } from "openchat-client";
    import ArrowLeftBoldCircle from "svelte-material-icons/ArrowLeftBoldCircle.svelte";
    import ArrowRightBoldCircle from "svelte-material-icons/ArrowRightBoldCircle.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import TrayArrowDown from "svelte-material-icons/TrayArrowDown.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import Transactions from "./Transactions.svelte";
    import { TokenState } from "./walletState.svelte";

    interface Props {
        token: EnhancedTokenDetails;
    }

    let { token }: Props = $props();

    let tokenState = $derived(new TokenState(token, "usd"));

    function showReceive(_ledger: string) {}

    function showSend(_ledger: string) {}

    function showSwap(_ledger: string) {}
</script>

<SlidingPageContent
    title={i18nKey(token.symbol)}
    subtitle={i18nKey(`${tokenState.formattedUnitValue} per ${token.symbol}`)}>
    {#snippet menu()}
        <MenuItem onclick={() => showSend(token.ledger)}>
            {#snippet icon(color)}
                <ArrowRightBoldCircle {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.send")} />
        </MenuItem>
        {#if token.enabled}
            <MenuItem onclick={() => showReceive(token.ledger)}>
                {#snippet icon(color)}
                    <ArrowLeftBoldCircle {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.receive")} />
            </MenuItem>
            {#if $swappableTokensStore.has(token.ledger)}
                <MenuItem onclick={() => showSwap(token.ledger)}>
                    {#snippet icon(color)}
                        <SwapIcon {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("cryptoAccount.swap")} />
                </MenuItem>
            {/if}
        {/if}
    {/snippet}
    <Container height={{ kind: "fill" }} padding={"lg"} gap={"lg"} direction={"vertical"}>
        <Container
            background={ColourVars.background1}
            supplementalClass={"wallet_token"}
            gap={"lg"}
            borderRadius={"lg"}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            padding={"lg"}>
            <Avatar url={token.logo}></Avatar>
            <Container direction={"vertical"}>
                <Body width={{ kind: "hug" }} fontWeight={"bold"}>{token.symbol}</Body>
                <Caption width={{ kind: "hug" }} colour={"textSecondary"} fontWeight={"bold"}
                    >{token.name}</Caption>
            </Container>
            <Container crossAxisAlignment={"end"} width={{ kind: "hug" }} direction={"vertical"}>
                <Subtitle align={"end"} width={{ kind: "hug" }} fontWeight={"bold"}
                    >{tokenState.formattedTokenBalance}</Subtitle>
                <BodySmall
                    align={"end"}
                    width={{ kind: "hug" }}
                    colour={"primary"}
                    fontWeight={"bold"}>{tokenState.formattedConvertedValue}</BodySmall>
            </Container>
        </Container>

        <Container
            padding={["md", "zero"]}
            borderRadius={"md"}
            crossAxisAlignment={"center"}
            mainAxisAlignment={"spaceAround"}
            borderWidth={"thick"}
            borderColour={ColourVars.primary}>
            <CommonButton mode={"active"} size={"small_text"}>
                {#snippet icon(color)}
                    <TrayArrowDown {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Receive")} />
            </CommonButton>
            /
            <CommonButton mode={"active"} size={"small_text"}>
                {#snippet icon(color)}
                    <TrayArrowUp {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Send")} />
            </CommonButton>
            /
            <CommonButton mode={"active"} size={"small_text"}>
                {#snippet icon(color)}
                    <SwapVertical {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Swap")} />
            </CommonButton>
        </Container>

        <Transactions ledger={token.ledger} urlFormat={token.urlFormat} />
    </Container>
</SlidingPageContent>

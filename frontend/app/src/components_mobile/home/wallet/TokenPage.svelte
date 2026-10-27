<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { walletActionsDisabled } from "@src/utils/features";
    import { ColourVars, CommonButton, Container, MenuItem } from "component-lib";
    import { publish, swappableTokensStore, walletConfigStore } from "@client";
    import ArrowLeftBoldCircle from "svelte-material-icons/ArrowLeftBoldCircle.svelte";
    import ArrowRightBoldCircle from "svelte-material-icons/ArrowRightBoldCircle.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import TrayArrowDown from "svelte-material-icons/TrayArrowDown.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenCard from "./TokenCard.svelte";
    import Transactions from "./Transactions.svelte";
    import { TokenState } from "@src/logic/wallet/walletState.svelte";
    import { tokenActions } from "@src/logic/wallet/tokenActions";

    interface Props {
        tokenState: TokenState;
    }

    let { tokenState }: Props = $props();

    // what the token offers: the same rules in every tree (tokenActions)
    let actions = $derived(
        tokenActions(tokenState, {
            swappable: $swappableTokensStore,
            manualWallet: $walletConfigStore.kind === "manual_wallet",
            disabled: walletActionsDisabled,
        }),
    );
</script>

<SlidingPageContent
    title={i18nKey(tokenState.symbol)}
    subtitle={i18nKey(`${tokenState.formattedUnitValue} per ${tokenState.symbol}`)}>
    {#snippet menu()}
        {#if actions.includes("send")}
            <MenuItem onclick={() => publish("sendToken", tokenState)}>
                {#snippet icon(color)}
                    <ArrowRightBoldCircle {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.send")} />
            </MenuItem>
        {/if}
        {#if actions.includes("receive")}
            <MenuItem onclick={() => publish("receiveToken", tokenState)}>
                {#snippet icon(color)}
                    <ArrowLeftBoldCircle {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.receive")} />
            </MenuItem>
        {/if}
        {#if actions.includes("swap")}
            <MenuItem onclick={() => publish("swapToken", tokenState)}>
                {#snippet icon(color)}
                    <SwapIcon {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("cryptoAccount.swap")} />
            </MenuItem>
        {/if}
    {/snippet}
    <Container height={"fill"} padding={"lg"} gap={"lg"} direction={"vertical"}>
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
                disabled={!actions.includes("receive")}
                size={"small_text"}>
                {#snippet icon(color, size)}
                    <TrayArrowDown {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Receive")} />
            </CommonButton>
            /
            <CommonButton
                onClick={() => publish("sendToken", tokenState)}
                disabled={!actions.includes("send")}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color, size)}
                    <TrayArrowUp {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Send")} />
            </CommonButton>
            /
            <CommonButton
                disabled={!actions.includes("swap")}
                onClick={() => publish("swapToken", tokenState)}
                mode={"active"}
                size={"small_text"}>
                {#snippet icon(color, size)}
                    <SwapVertical {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Swap")} />
            </CommonButton>
        </Container>

        <Transactions ledger={tokenState.ledger} urlFormat={tokenState.urlFormat} />
    </Container>
</SlidingPageContent>

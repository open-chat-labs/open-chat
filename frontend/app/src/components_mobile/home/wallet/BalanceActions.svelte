<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        disableReceiveCryptoFeature,
        disableSendCryptoFeature,
        disableSwapFeature,
    } from "@src/utils/features";
    import { Container, ColourVars, CommonButton2, Subtitle } from "component-lib";
    import {
        publish,
        swappableTokensStore,
        type EnhancedTokenDetails,
        type PubSubEvents,
        type ResourceKey,
    } from "openchat-client";
    import type { Snippet } from "svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import TrayArrowDown from "svelte-material-icons/TrayArrowDown.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import Translatable from "../../Translatable.svelte";
    import TokenSelector from "./TokenSelector.svelte";
    import { TokenState, type ConversionToken } from "./walletState.svelte";

    type TokenSelectorParams = {
        title: ResourceKey;
        onSelect: (token: EnhancedTokenDetails) => void;
        placeholder: ResourceKey;
        icon: Snippet<[string, string]>;
        extraFilter?: (token: EnhancedTokenDetails) => boolean;
    };

    interface Props {
        selectedConversion: ConversionToken;
    }

    let { selectedConversion }: Props = $props();
    let tokenSelector = $state<TokenSelectorParams>();

    function onSelect(ev: "receiveToken" | "sendToken" | "swapToken", token: EnhancedTokenDetails) {
        tokenSelector = undefined;
        publish(ev as keyof PubSubEvents, new TokenState(token, selectedConversion));
    }

    function onReceive() {
        tokenSelector = {
            title: i18nKey("Receive token"),
            onSelect: (token: EnhancedTokenDetails) => onSelect("receiveToken", token),
            placeholder: i18nKey("Find token to receive..."),
            icon: receiveIcon,
        };
    }

    function onSend() {
        tokenSelector = {
            title: i18nKey("Send token"),
            onSelect: (token: EnhancedTokenDetails) => onSelect("sendToken", token),
            placeholder: i18nKey("Find token to send..."),
            icon: sendIcon,
            extraFilter: (token: EnhancedTokenDetails) => token.balance > 0n,
        };
    }

    function onSwap() {
        tokenSelector = {
            title: i18nKey("Swap token"),
            onSelect: (token: EnhancedTokenDetails) => onSelect("swapToken", token),
            placeholder: i18nKey("Find token to swap..."),
            icon: swapIcon,
            extraFilter: (token: EnhancedTokenDetails) =>
                $swappableTokensStore.has(token.ledger) && token.balance > 0n,
        };
    }
</script>

{#snippet receiveIcon(color: string, size: string)}
    <TrayArrowDown {color} {size} />
{/snippet}

{#snippet sendIcon(color: string, size: string)}
    <TrayArrowUp {color} {size} />
{/snippet}

{#snippet swapIcon(color: string, size: string)}
    <SwapVertical {color} {size} />
{/snippet}

{#if tokenSelector !== undefined}
    <TokenSelector
        icon={tokenSelector.icon}
        onSelect={tokenSelector.onSelect}
        placeholder={tokenSelector.placeholder}
        extraFilter={tokenSelector.extraFilter}
        onDismiss={() => (tokenSelector = undefined)}
        title={tokenSelector.title} />
{/if}

{#snippet slashSeparator()}
    <Subtitle width={"hug"} colour="textTertiary" fontWeight="bold">/</Subtitle>
{/snippet}

{#if !disableReceiveCryptoFeature || !disableSendCryptoFeature || !disableSwapFeature}
    <Container
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        padding={["sm", "zero"]}
        borderColour={ColourVars.background2}
        borderWidth="thick"
        borderRadius="md">
        {#if !disableReceiveCryptoFeature}
            <!-- RECEIVE button -->
            <CommonButton2 onClick={onReceive} width="fill" icon={receiveIcon}>
                <Translatable resourceKey={i18nKey("Receive")} />
            </CommonButton2>
        {/if}
        {#if !disableSendCryptoFeature}
            {@render slashSeparator()}
            <!-- SEND button -->
            <CommonButton2 onClick={onSend} width="fill" icon={sendIcon}>
                <Translatable resourceKey={i18nKey("Send")} />
            </CommonButton2>
        {/if}
        {#if !disableSwapFeature}
            {@render slashSeparator()}
            <!-- SWAP button -->
            <CommonButton2 onClick={onSwap} width="fill" icon={swapIcon}>
                <Translatable resourceKey={i18nKey("Swap")} />
            </CommonButton2>
        {/if}
    </Container>
{/if}

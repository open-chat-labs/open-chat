<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BigButton, Container, type SizeMode } from "component-lib";
    import {
        publish,
        swappableTokensStore,
        type EnhancedTokenDetails,
        type PubSubEvents,
        type ResourceKey,
    } from "openchat-client";
    import type { Snippet } from "svelte";
    import List from "svelte-material-icons/FormatListBulletedType.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import TrayArrowDown from "svelte-material-icons/TrayArrowDown.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import Translatable from "../../Translatable.svelte";
    import TokenSelector from "./TokenSelector.svelte";

    type TokenSelectorParams = {
        title: ResourceKey;
        onSelect: (token: EnhancedTokenDetails) => void;
        placeholder: ResourceKey;
        icon: Snippet<[string, string]>;
        extraFilter?: (token: EnhancedTokenDetails) => boolean;
    };

    const width: SizeMode = { kind: "fixed", size: "6rem" };
    let tokenSelector = $state<TokenSelectorParams>();

    function onSelect(ev: "receiveToken" | "sendToken" | "swapToken", token: EnhancedTokenDetails) {
        tokenSelector = undefined;
        publish(ev as keyof PubSubEvents, token);
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
        };
    }

    function onSwap() {
        tokenSelector = {
            title: i18nKey("Swap token"),
            onSelect: (token: EnhancedTokenDetails) => onSelect("swapToken", token),
            placeholder: i18nKey("Find token to swap..."),
            icon: swapIcon,
            extraFilter: (token: EnhancedTokenDetails) => $swappableTokensStore.has(token.ledger),
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
        onDismiss={() => (tokenSelector = undefined)}
        title={tokenSelector.title} />
{/if}

<Container gap={"sm"}>
    <BigButton {width} mode={"active"}>
        {#snippet icon(color)}
            <List {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Overview")} />
    </BigButton>
    <BigButton icon={receiveIcon} {width} mode={"default"} onClick={onReceive}>
        <Translatable resourceKey={i18nKey("Receive")} />
    </BigButton>
    <BigButton icon={sendIcon} {width} mode={"default"} onClick={onSend}>
        <Translatable resourceKey={i18nKey("Send")} />
    </BigButton>
    <BigButton icon={swapIcon} {width} mode={"default"} onClick={onSwap}>
        <Translatable resourceKey={i18nKey("Swap")} />
    </BigButton>
</Container>

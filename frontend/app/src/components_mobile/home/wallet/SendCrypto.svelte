<script lang="ts">
    import { BigButton, Container } from "component-lib";
    import { type EnhancedTokenDetails } from "openchat-shared";
    import ChatPlus from "svelte-material-icons/ChatPlusOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import SendToAddress from "./SendToAddress.svelte";
    import SendToUser from "./SendToUser.svelte";
    import TokenCard from "./TokenCard.svelte";
    import { TokenState } from "./walletState.svelte";

    interface Props {
        token: EnhancedTokenDetails;
        onClose: () => void;
    }

    let { token, onClose }: Props = $props();

    let tokenState = $derived(new TokenState(token, "usd"));
    let mode = $state<"user" | "address">("user");

    let symbol = $derived(token.symbol);
    let title = $derived(i18nKey("cryptoAccount.sendToken", { symbol }));
</script>

<SlidingPageContent {title}>
    <Container
        mainAxisAlignment={"spaceBetween"}
        height={{ kind: "fill" }}
        gap={"xl"}
        padding={"xl"}
        direction={"vertical"}>
        <TokenCard {tokenState} />

        <Container gap={"xl"} height={{ kind: "fill" }} direction={"vertical"}>
            {#if mode === "user"}
                <SendToUser onComplete={onClose} {token} />
            {:else if mode === "address"}
                <SendToAddress {onClose} {token} />
            {/if}
        </Container>

        <Container gap={"sm"}>
            <BigButton
                onClick={() => (mode = "user")}
                mode={mode === "user" ? "active" : "default"}>
                {#snippet icon(color)}
                    <ChatPlus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Send to user")} />
            </BigButton>
            <BigButton
                onClick={() => (mode = "address")}
                mode={mode === "address" ? "active" : "default"}>
                {#snippet icon(color)}
                    <Wallet {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Send to address")} />
            </BigButton>
        </Container>
    </Container>
</SlidingPageContent>

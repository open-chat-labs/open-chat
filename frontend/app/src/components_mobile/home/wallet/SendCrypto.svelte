<script lang="ts">
    import { BigButton, Container } from "component-lib";
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
        tokenState: TokenState;
        onClose: () => void;
    }

    let { tokenState, onClose }: Props = $props();

    let mode = $state<"user" | "address">("user");
    let title = $derived(i18nKey("cryptoAccount.sendToken", { symbol: tokenState.symbol }));
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
                <SendToUser onComplete={onClose} {tokenState} />
            {:else if mode === "address"}
                <SendToAddress {onClose} {tokenState} />
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

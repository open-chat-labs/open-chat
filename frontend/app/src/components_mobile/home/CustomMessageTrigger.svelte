<script lang="ts">
    import { BigButton, Container, type SizeMode } from "component-lib";
    import {
        publish,
        type AttachmentContent,
        type MessageContext,
        type MessagePermission,
    } from "openchat-client";
    import Poll from "svelte-material-icons/ChartBoxOutline.svelte";
    import File from "svelte-material-icons/FileOutline.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
    import Gallery from "svelte-material-icons/ImageMultipleOutline.svelte";
    import Swap from "svelte-material-icons/SwapHorizontal.svelte";
    import { expoInOut } from "svelte/easing";
    import { fly } from "svelte/transition";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import MemeFighter from "../icons/MemeFighter.svelte";
    import FileAttacher from "./FileAttacher.svelte";

    interface Props {
        open: boolean;
        permittedMessages: Map<MessagePermission, boolean>;
        onClearAttachment: () => void;
        onTokenTransfer: (args: { ledger?: string; amount?: bigint }) => void;
        onCreatePrizeMessage?: () => void;
        onCreateP2PSwapMessage: () => void;
        onMakeMeme: () => void;
        onFileSelected: (content: AttachmentContent) => void;
        messageContext: MessageContext;
    }

    let {
        permittedMessages,
        open = $bindable(),
        onTokenTransfer,
        onFileSelected,
        onCreatePrizeMessage,
        onCreateP2PSwapMessage,
        onMakeMeme,
        messageContext,
    }: Props = $props();
    const width: SizeMode = { size: "6.5rem" };
    const height: SizeMode = { size: "4.5rem" };
    let mediaPermitted = $derived(
        permittedMessages.get("audio") ||
            permittedMessages.get("video") ||
            permittedMessages.get("image"),
    );
</script>

<div transition:fly={{ duration: 300, easing: expoInOut, y: 200 }} class="wrapper">
    <Container
        onSwipe={() => {}}
        padding={open ? ["sm", "md"] : ["zero", "md"]}
        gap={"sm"}
        supplementalClass={`custom_message_selector ${open ? "open" : ""}`}
        onClick={() => (open = false)}>
        {#if permittedMessages.get("crypto")}
            <BigButton {height} {width} onClick={() => onTokenTransfer({})}>
                {#snippet icon(color)}
                    <Bitcoin {color} />
                {/snippet}
                Send crypto
            </BigButton>
        {/if}
        {#if mediaPermitted}
            <FileAttacher {onFileSelected}>
                {#snippet children(onClick)}
                    <BigButton {height} {width} {onClick}>
                        {#snippet icon(color)}
                            <Gallery {color} />
                        {/snippet}
                        Gallery
                    </BigButton>
                {/snippet}
            </FileAttacher>
        {/if}
        {#if permittedMessages.get("file")}
            <FileAttacher {onFileSelected}>
                {#snippet children(onClick)}
                    <BigButton {height} {width} {onClick}>
                        {#snippet icon(color)}
                            <File {color} />
                        {/snippet}
                        File
                    </BigButton>
                {/snippet}
            </FileAttacher>
        {/if}
        {#if permittedMessages.get("prize")}
            <BigButton {height} {width} onClick={onCreatePrizeMessage}>
                {#snippet icon(color)}
                    <Gift {color} />
                {/snippet}
                Prize
            </BigButton>
        {/if}
        {#if permittedMessages.get("poll")}
            <BigButton {height} {width} onClick={() => publish("createPoll", messageContext)}>
                {#snippet icon(color)}
                    <Poll {color} />
                {/snippet}
                Poll
            </BigButton>
        {/if}
        {#if permittedMessages.get("p2pSwap")}
            <BigButton {height} {width} onClick={onCreateP2PSwapMessage}>
                {#snippet icon(color)}
                    <Swap {color} />
                {/snippet}
                Swap
            </BigButton>
        {/if}
        {#if permittedMessages.get("memeFighter")}
            <BigButton {height} {width} onClick={onMakeMeme}>
                {#snippet icon(color)}
                    <MemeFighter {color} />
                {/snippet}
                Meme
            </BigButton>
        {/if}
    </Container>
</div>

<style lang="scss">
    :global(.container.custom_message_selector) {
        transition:
            height 200ms ease-in-out,
            opacity 200ms ease-in-out;
        height: 0 !important;
        opacity: 0;
    }
    :global(.container.custom_message_selector.open) {
        height: 6.5rem !important;
        opacity: 1;
    }
</style>

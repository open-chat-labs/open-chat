<script lang="ts">
    import {
        disableCreatePrizeFeature,
        disableP2PSwapFeature,
        disableSendCryptoFeature,
    } from "@src/utils/features";
    import { Body, ColourVars, Column } from "component-lib";
    import {
        i18nKey,
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
    import Bitcoin from "../icons/Bitcoin.svelte";
    import MemeFighter from "../icons/MemeFighter.svelte";
    import FileAttacher from "./FileAttacher.svelte";
    import Translatable from "../Translatable.svelte";

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

    let mediaPermitted = $derived(
        permittedMessages.get("audio") ||
            permittedMessages.get("video") ||
            permittedMessages.get("image"),
    );
</script>

{#snippet attachOption(key: string, Icon: any, color: string, onclick: () => void)}
    <button class="attach-option" {onclick}>
        <Column gap="sm" crossAxisAlignment="center">
            <Icon size="1.5rem" {color} />
            <Body colour="textPrimary" fontWeight="semi-bold">
                <Translatable resourceKey={i18nKey(key)} />
            </Body>
        </Column>
    </button>
{/snippet}

<div class="attach-wrapper">
    <!-- Open Gallery -->
    {#if mediaPermitted}
        <FileAttacher {onFileSelected}>
            {#snippet children(onClick)}
                {@render attachOption("Open Gallery", Gallery, ColourVars.primary, onClick)}
            {/snippet}
        </FileAttacher>
    {/if}

    <!-- Send File -->
    {#if permittedMessages.get("file")}
        <FileAttacher {onFileSelected}>
            {#snippet children(onClick)}
                {@render attachOption("Send File", File, ColourVars.secondary, onClick)}
            {/snippet}
        </FileAttacher>
    {/if}

    <!-- Create Poll -->
    {#if permittedMessages.get("poll")}
        {@render attachOption("Create Poll", Poll, ColourVars.warning, () =>
            publish("createPoll", messageContext),
        )}
    {/if}

    <!-- Send Crypto -->
    {#if permittedMessages.get("crypto") && !disableSendCryptoFeature}
        {@render attachOption("Send Crypto", Bitcoin, ColourVars.tertiary, () =>
            onTokenTransfer({}),
        )}
    {/if}

    <!-- Offer P2P Swap -->
    {#if permittedMessages.get("p2pSwap") && !disableP2PSwapFeature}
        {@render attachOption("Offer Swap", Swap, ColourVars.success, onCreateP2PSwapMessage)}
    {/if}

    <!-- Create Prize -->
    {#if permittedMessages.get("prize") && !disableCreatePrizeFeature}
        {@render attachOption("Create Prize", Gift, ColourVars.error, () =>
            onCreatePrizeMessage?.(),
        )}
    {/if}

    <!-- Meme fighter -->
    {#if permittedMessages.get("memeFighter")}
        {@render attachOption("Meme Fighter", MemeFighter, ColourVars.textSecondary, onMakeMeme)}
    {/if}
</div>

<style lang="scss">
    .attach-wrapper {
        display: grid;
        overflow: auto;
        padding: var(--sp-xl);
        gap: var(--sp-xxl) var(--sp-xl);
        grid-template-columns: repeat(3, 1fr);
    }

    .attach-option {
        background-color: transparent;
        border: none;
        padding: 0;
        margin: 0;
    }
</style>

<script lang="ts">
    import { quickReactions } from "@src/stores/quickReactions";
    import { disableTipsFeature } from "@src/utils/features";
    import { Column, Row, IconButton, ColourVars, type Padding } from "component-lib";
    import {
        chatListScopeStore,
        cryptoLookup,
        currentUserIdStore,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        routeForMessage,
        type ChatIdentifier,
        type Message,
        type OpenChat,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ChatPlusOutline from "svelte-material-icons/ChatPlusOutline.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import EmoticonOutline from "svelte-material-icons/EmoticonOutline.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import SquareEditOutline from "svelte-material-icons/SquareEditOutline.svelte";
    import * as shareFunctions from "../../utils/share";
    import { copyToClipboard } from "../../utils/urls";
    import Bitcoin from "../icons/Bitcoin.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        inert: boolean;
        publicGroup: boolean;
        confirmed: boolean;
        failed: boolean;
        canShare: boolean;
        me: boolean;
        supportsReply: boolean;
        canQuoteReply: boolean;
        canStartThread: boolean;
        canEdit: boolean;
        canReact: boolean;
        msg: Message;
        threadRootMessage: Message | undefined;
        canTip: boolean;
        selectQuickReaction: (unicode: string) => void;
        showEmojiPicker: () => void;
        onReply: () => void;
        onEditMessage: () => void;
        onTipMessage: (ledger: string) => void;
        onOpenSheetMenu: () => void;
    }

    let {
        chatId,
        inert,
        publicGroup,
        confirmed,
        failed,
        canShare,
        me,
        supportsReply,
        canQuoteReply,
        canStartThread,
        canEdit,
        canReact,
        msg,
        threadRootMessage,
        canTip,
        selectQuickReaction,
        showEmojiPicker,
        onReply,
        onEditMessage,
        onTipMessage,
        onOpenSheetMenu,
    }: Props = $props();

    let inThread = $derived(threadRootMessage !== undefined);

    const padding: Padding = ["sm", "sm"];

    function shareMessage() {
        shareFunctions.shareMessage(
            $_,
            $currentUserIdStore,
            msg.sender === $currentUserIdStore,
            msg,
            $cryptoLookup,
        );
    }

    function copyMessage() {
        copyToClipboard(client.getContentAsText($_, msg.content));
    }

    function initiateThread() {
        page(
            `${routeForMessage($chatListScopeStore.kind, { chatId }, msg.messageIndex)}?open=true`,
        );
    }
</script>

<Column
    gap="sm"
    padding={["zero", "zero"]}
    overflow="visible"
    crossAxisAlignment={me ? "end" : "start"}>
    <!-- Quick reaction emoji -->
    <Row
        gap="xs"
        width="hug"
        padding={["sm", "md"]}
        backgroundColor={ColourVars.background1}
        supplementalClass={`message_bubble_menu ${me ? "me" : ""}`}>
        {#each $quickReactions as reaction}
            <IconButton {padding} onclick={() => selectQuickReaction(reaction)}>
                {#snippet icon()}
                    <span class="quick-reaction">
                        {reaction}
                    </span>
                {/snippet}
            </IconButton>
        {/each}
        {#if canReact && !failed}
            <IconButton {padding} onclick={showEmojiPicker}>
                {#snippet icon(color)}
                    <EmoticonOutline {color} />
                {/snippet}
            </IconButton>
        {/if}
    </Row>

    <!-- Message options -->
    <!-- TODO has same attrs as the row above, reduce duplication -->
    <Row
        gap="xs"
        width="hug"
        padding={["sm", "md"]}
        backgroundColor={ColourVars.background1}
        supplementalClass={`message_bubble_menu second ${me ? "me" : ""}`}>
        <!-- Edit -->
        {#if canEdit && !inert && !failed}
            <IconButton {padding} onclick={onEditMessage}>
                {#snippet icon(color)}
                    <SquareEditOutline {color} />
                {/snippet}
            </IconButton>
        {/if}

        <!-- Reply & start thread -->
        {#if confirmed && supportsReply && !inert && !failed}
            {#if canQuoteReply}
                <IconButton {padding} onclick={onReply}>
                    {#snippet icon(color)}
                        <Reply {color} />
                    {/snippet}
                </IconButton>
            {/if}
            {#if !inThread && canStartThread}
                <IconButton {padding} onclick={initiateThread}>
                    {#snippet icon(color)}
                        <ChatPlusOutline {color} />
                    {/snippet}
                </IconButton>
            {/if}
        {/if}

        <!-- Copy -->
        <IconButton {padding} onclick={copyMessage}>
            {#snippet icon(color)}
                <ContentCopy {color} />
            {/snippet}
        </IconButton>

        <!-- Share -->
        {#if confirmed && !inert && !failed}
            {#if publicGroup && canShare}
                <IconButton {padding} onclick={shareMessage}>
                    {#snippet icon(color)}
                        <ShareIcon {color} />
                    {/snippet}
                </IconButton>
            {/if}
        {/if}

        <!-- Tip with crypto -->
        <!-- TODO make sure this does not end up in store app build -->
        {#if canTip && !disableTipsFeature}
            <IconButton
                {padding}
                onclick={() => onTipMessage($lastCryptoSent ?? LEDGER_CANISTER_ICP)}>
                {#snippet icon(color)}
                    <Bitcoin {color} />
                {/snippet}
            </IconButton>
        {/if}

        <!-- Open more options -->
        <IconButton {padding} onclick={onOpenSheetMenu}>
            {#snippet icon(color)}
                <DotsVertical {color} />
            {/snippet}
        </IconButton>
    </Row>
</Column>

<style lang="scss">
    .quick-reaction {
        font-size: 1.3rem;
    }

    :global {
        .message_bubble_menu {
            box-shadow: var(--menu-sh);

            &.me {
                border-radius: var(--rad-huge) var(--rad-sm) var(--rad-sm) var(--rad-huge) !important;

                &.second {
                    border-bottom-right-radius: var(--rad-huge) !important;
                }
            }

            &:not(.me) {
                border-radius: var(--rad-md) var(--rad-huge) var(--rad-huge) var(--rad-sm) !important;
            }

            &.second:not(.me) {
                border-bottom-left-radius: var(--rad-huge) !important;
            }
        }
    }
</style>

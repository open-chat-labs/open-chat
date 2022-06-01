<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { rollbar } from "../../utils/logging";
    import { closeNotificationsForChat } from "../../utils/notifications";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import type { ChatController } from "../../fsm/chat.controller";
    import { onDestroy, tick } from "svelte";
    import {
        canForward,
        canInviteUsers,
        getFirstUnreadMention,
        getFirstUnreadMessageIndex,
        isPreviewing,
        newMessageId,
    } from "../../domain/chat/chat.utils";
    import type {
        EnhancedReplyContext,
        GroupChatSummary,
        Mention,
        Message,
    } from "../../domain/chat/chat";
    import PollBuilder from "./PollBuilder.svelte";
    import CryptoTransferBuilder from "./CryptoTransferBuilder.svelte";
    import { userStore } from "stores/user";
    import {
        canBlockUsers,
        canCreatePolls,
        canDeleteOtherUsersMessages,
        canPinMessages,
        canReactToMessages,
        canSendMessages,
    } from "../../domain/chat/chat.utils";
    import CurrentChatSearchHeader from "./CurrentChatSearchHeader.svelte";
    import GiphySelector from "./GiphySelector.svelte";
    import type { Cryptocurrency } from "../../domain/crypto";
    import { lastCryptoSent } from "../../stores/crypto";
    import { trackEvent } from "../../utils/tracking";
    import { messageToForwardStore } from "../../stores/messageToForward";

    export let controller: ChatController;
    export let blocked: boolean;
    export let joining: GroupChatSummary | undefined;

    let chatId = controller.chatId;
    let unreadMessages = 0;
    let firstUnreadMessage: number | undefined;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let creatingCryptoTransfer: { token: Cryptocurrency; amount: bigint } | undefined = undefined;
    let selectingGif = false;
    let footer: Footer;
    let pollBuilder: PollBuilder;
    let giphySelector: GiphySelector;
    let showSearchHeader = false;
    let searchTerm = "";

    $: pinned = controller.pinnedMessages;
    $: showFooter = !showSearchHeader;
    $: chat = controller.chat;
    $: fileToAttach = controller.fileToAttach;
    $: editingEvent = controller.editingEvent;
    $: replyingTo = controller.replyingTo;
    $: canSend = canSendMessages($chat, $userStore);
    $: preview = isPreviewing($chat);
    $: {
        if (chatId !== controller.chatId) {
            showSearchHeader = false;
            chatId = controller.chatId;
            unreadMessages = controller.unreadMessageCount;
            firstUnreadMention = getFirstUnreadMention(controller.markRead, controller.chatVal);
            firstUnreadMessage = getFirstUnreadMessageIndex(
                controller.markRead,
                controller.chatVal
            );

            tick().then(() => {
                if ($messageToForwardStore !== undefined) {
                    forwardMessage($messageToForwardStore);
                    messageToForwardStore.set(undefined);
                }
            });
        }
    }
    let unsub = controller.markRead.subscribe(() => {
        unreadMessages = controller.unreadMessageCount;
        firstUnreadMention = getFirstUnreadMention(controller.markRead, controller.chatVal);
        firstUnreadMessage = getFirstUnreadMessageIndex(controller.markRead, controller.chatVal);
    });

    function onWindowFocus() {
        closeNotificationsForChat(chatId);
    }

    onDestroy(unsub);

    function toggleMuteNotifications() {
        const op = controller.notificationsMuted ? "unmuted" : "muted";
        controller.api
            .toggleMuteNotifications(controller.chatId, !controller.notificationsMuted)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                        values: { operation: $_(op) },
                    });
                } else {
                    toastStore.showSuccessToast("toggleMuteNotificationsSucceeded", {
                        values: { operation: $_(op) },
                    });
                }
            })
            .catch((err) => {
                rollbar.error("Error toggling mute notifications", err);
                toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                    values: { operation: $_(op) },
                });
            });
    }

    function markAllRead() {
        controller.markAllRead();
    }

    function messageRead(
        ev: CustomEvent<{ chatId: string; messageIndex: number; messageId: bigint }>
    ) {
        controller.messageRead(ev.detail.messageIndex, ev.detail.messageId);
    }

    function createPoll() {
        if (!canCreatePolls($chat)) return;

        if (pollBuilder !== undefined) {
            pollBuilder.resetPoll();
        }
        creatingPoll = true;
    }

    function tokenTransfer(ev: CustomEvent<{ token: Cryptocurrency; amount: bigint } | undefined>) {
        creatingCryptoTransfer = ev.detail ?? {
            token: $lastCryptoSent,
            amount: BigInt(0),
        };
    }

    function attachGif(ev: CustomEvent<string>) {
        selectingGif = true;
        if (giphySelector !== undefined) {
            giphySelector.reset(ev.detail);
        }
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        showSearchHeader = false;
        controller.replyTo(ev.detail);
    }

    function searchChat(ev: CustomEvent<string>) {
        showSearchHeader = true;
        searchTerm = ev.detail;
    }

    function forwardMessage(msg: Message) {
        if (!canSend || !canForward(msg.content)) return;

        // TODO check storage requirements

        // Only forward the primary content not the caption
        let content = { ...msg.content };
        if ("caption" in content) {
            content.caption = "";
        }

        msg = {
            kind: "message",
            messageId: newMessageId(),
            messageIndex: controller.getNextMessageIndex(),
            sender: controller.user.userId,
            content,
            repliesTo: undefined,
            reactions: [],
            edited: false,
            forwarded: msg.content.kind !== "giphy_content",
        };

        controller.api
            .forwardMessage($chat, controller.user, [], msg)
            .then((resp) => {
                if (resp.kind === "success") {
                    controller.confirmMessage(msg, resp);
                    trackEvent("forward_message");
                } else {
                    controller.removeMessage(msg.messageId, controller.user.userId);
                    rollbar.warn("Error response forwarding message", resp);
                    toastStore.showFailureToast("errorSendingMessage");
                }
            })
            .catch((err) => {
                controller.removeMessage(msg.messageId, controller.user.userId);
                console.log(err);
                toastStore.showFailureToast("errorSendingMessage");
                rollbar.error("Exception forwarding message", err);
            });

        const nextEventIndex = controller.getNextEventIndex();
        const event = { event: msg, index: nextEventIndex, timestamp: BigInt(Date.now()) };
        controller.sendMessage(event);
    }
</script>

<svelte:window on:focus={onWindowFocus} />

<PollBuilder
    bind:this={pollBuilder}
    on:sendPoll={footer.sendMessageWithContent}
    bind:open={creatingPoll} />

{#if creatingCryptoTransfer !== undefined}
    <CryptoTransferBuilder
        token={creatingCryptoTransfer.token}
        draftAmountE8s={creatingCryptoTransfer.amount}
        on:sendTransfer={footer.sendMessageWithContent}
        on:close={() => (creatingCryptoTransfer = undefined)}
        {controller} />
{/if}

<GiphySelector
    bind:this={giphySelector}
    bind:open={selectingGif}
    on:sendGiphy={footer.sendMessageWithContent} />

<div class="wrapper">
    {#if showSearchHeader}
        <CurrentChatSearchHeader
            chat={$chat}
            bind:searchTerm
            on:goToMessageIndex
            on:close={() => (showSearchHeader = false)} />
    {:else}
        <CurrentChatHeader
            on:clearSelection
            on:blockUser
            on:unblockUser
            on:markAllRead={markAllRead}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:addParticipants
            on:showGroupDetails
            on:showParticipants
            on:leaveGroup
            on:showPinned
            on:createPoll={createPoll}
            on:searchChat={searchChat}
            {blocked}
            {preview}
            {unreadMessages}
            selectedChatSummary={chat}
            hasPinned={$pinned.size > 0} />
    {/if}
    <CurrentChatMessages
        on:replyPrivatelyTo
        on:replyTo={replyTo}
        on:replyInThread
        on:messageRead={messageRead}
        on:chatWith
        on:upgrade
        on:forward
        {controller}
        canPin={canPinMessages($chat)}
        canBlockUser={canBlockUsers($chat)}
        canDelete={canDeleteOtherUsersMessages($chat)}
        {canSend}
        canReact={canReactToMessages($chat)}
        canInvite={canInviteUsers($chat)}
        {preview}
        {firstUnreadMention}
        {firstUnreadMessage}
        footer={showFooter}
        {unreadMessages} />
    {#if showFooter}
        <Footer
            bind:this={footer}
            chat={$chat}
            fileToAttach={$fileToAttach}
            editingEvent={$editingEvent}
            replyingTo={$replyingTo}
            {joining}
            {preview}
            {blocked}
            {controller}
            on:joinGroup
            on:cancelPreview
            on:upgrade
            on:cancelReply={() => controller.cancelReply()}
            on:attachGif={attachGif}
            on:tokenTransfer={tokenTransfer}
            on:searchChat={searchChat}
            on:createPoll={createPoll} />
    {/if}
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        position: relative;
    }
</style>

<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { rollbar } from "../../utils/logging";
    import { closeNotificationsForChat } from "../../utils/notifications";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import type { ChatController } from "../../fsm/chat.controller";
    import { onDestroy } from "svelte";
    import {
        canInviteUsers,
        getFirstUnreadMention,
        getFirstUnreadMessageIndex,
        getMinVisibleMessageIndex,
        isPreviewing,
    } from "../../domain/chat/chat.utils";
    import type { EnhancedReplyContext, GroupChatSummary, Mention } from "../../domain/chat/chat";
    import PollBuilder from "./PollBuilder.svelte";
    import ICPTransferBuilder from "./ICPTransferBuilder.svelte";
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

    export let controller: ChatController;
    export let blocked: boolean;
    export let joining: GroupChatSummary | undefined;

    let chatId = controller.chatId;
    let unreadMessages = 0;
    let firstUnreadMessage: number | undefined;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let creatingICPTransfer = false;
    let selectingGif = false;
    let footer: Footer;
    let pollBuilder: PollBuilder;
    let icpTransferBuilder: ICPTransferBuilder;
    let giphySelector: GiphySelector;
    let showSearchHeader = false;
    let searchTerm = "";

    $: pinned = controller.pinnedMessages;
    $: showFooter = !showSearchHeader;

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

    function icpTransfer(ev: CustomEvent<bigint>) {
        if (icpTransferBuilder !== undefined) {
            icpTransferBuilder.reset(ev.detail);
        }
        creatingICPTransfer = true;
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

    $: chat = controller.chat;

    $: preview = isPreviewing($chat);
</script>

<svelte:window on:focus={onWindowFocus} />

<PollBuilder
    bind:this={pollBuilder}
    on:sendPoll={footer.sendMessageWithContent}
    bind:open={creatingPoll} />

<ICPTransferBuilder
    bind:this={icpTransferBuilder}
    on:sendTransfer={footer.sendMessageWithContent}
    {controller}
    bind:open={creatingICPTransfer} />

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
        on:messageRead={messageRead}
        on:chatWith
        on:upgrade
        {controller}
        canPin={canPinMessages($chat)}
        canBlockUser={canBlockUsers($chat)}
        canDelete={canDeleteOtherUsersMessages($chat)}
        canSend={canSendMessages($chat)}
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
            {joining}
            {preview}
            {blocked}
            {controller}
            on:joinGroup
            on:cancelPreview
            on:upgrade
            on:attachGif={attachGif}
            on:icpTransfer={icpTransfer}
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

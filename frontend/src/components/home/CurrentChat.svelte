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
    import { getMinVisibleMessageIndex, isPreviewing } from "../../domain/chat/chat.utils";
    import type { EnhancedReplyContext, GroupChatSummary, Mention } from "../../domain/chat/chat";
    import PollBuilder from "./PollBuilder.svelte";
    import ICPTransferBuilder from "./ICPTransferBuilder.svelte";
    import {
        canBlockUsers,
        canCreatePolls,
        canDeleteMessages,
        canPinMessages,
        canReactToMessages,
        canSendMessages,
    } from "../../domain/chat/chat.utils";
    import CurrentChatSearchHeader from "./CurrentChatSearchHeader.svelte";

    export let controller: ChatController;
    export let blocked: boolean;
    export let joining: GroupChatSummary | undefined;

    let chatId = controller.chatId;
    let unreadMessages = 0;
    let firstUnreadMessage: number | undefined;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let creatingICPTransfer = false;
    let footer: Footer;
    let pollBuilder: PollBuilder;
    let icpTransferBuilder: ICPTransferBuilder;
    let showSearchHeader = false;

    $: pinned = controller.pinnedMessages;
    $: showFooter = !showSearchHeader;

    $: {
        if (chatId !== controller.chatId) {
            showSearchHeader = false;
            chatId = controller.chatId;
            unreadMessages = controller.unreadMessageCount;
            firstUnreadMention = getFirstUnreadMention();
            firstUnreadMessage = getFirstUnreadMessageIndex();
        }
    }

    let unsub = controller.markRead.subscribe(() => {
        unreadMessages = controller.unreadMessageCount;
        firstUnreadMention = getFirstUnreadMention();
        firstUnreadMessage = getFirstUnreadMessageIndex();
    });

    function getFirstUnreadMention(): Mention | undefined {
        const chat = controller.chatVal;
        if (chat.kind === "direct_chat") return undefined;
        return chat.mentions.find(
            (m) => !controller.markRead.isRead(chat.chatId, m.messageIndex, m.messageId)
        );
    }

    function getFirstUnreadMessageIndex(): number | undefined {
        const chat = controller.chatVal;
        if (preview) return undefined;

        return controller.markRead.getFirstUnreadMessageIndex(
            chat.chatId,
            getMinVisibleMessageIndex(chat),
            chat.latestMessage?.event.messageIndex
        );
    }

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

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        showSearchHeader = false;
        controller.replyTo(ev.detail);
    }

    $: chat = controller.chat;

    $: preview = isPreviewing($chat);
</script>

<svelte:window on:focus={onWindowFocus} />

<PollBuilder bind:this={pollBuilder} on:sendPoll={footer.sendPoll} bind:open={creatingPoll} />

{#if $chat.kind === "direct_chat"}
    <ICPTransferBuilder
        receiverId={$chat.them}
        bind:this={icpTransferBuilder}
        on:sendTransfer={footer.sendICPTransfer}
        bind:open={creatingICPTransfer} />
{/if}

<div class="wrapper">
    {#if showSearchHeader}
        <CurrentChatSearchHeader
            chat={$chat}
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
            on:deleteGroup
            on:showPinned
            on:createPoll={createPoll}
            on:searchChat={() => (showSearchHeader = true)}
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
        {controller}
        canPin={canPinMessages($chat)}
        canBlockUser={canBlockUsers($chat)}
        canDelete={canDeleteMessages($chat)}
        canSend={canSendMessages($chat)}
        canReact={canReactToMessages($chat)}
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
            on:icpTransfer={icpTransfer}
            on:createPoll={createPoll} />
    {/if}
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

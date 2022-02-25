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
    import type { GroupChatSummary, Mention } from "../../domain/chat/chat";
    import PollBuilder from "./PollBuilder.svelte";

    export let controller: ChatController;
    export let blocked: boolean;
    export let joining: GroupChatSummary | undefined;

    let chatId = controller.chatId;
    let unreadMessages = 0;
    let firstUnreadMessage: number | undefined;
    let firstUnreadMention: Mention | undefined;
    let creatingPoll = false;
    let footer: Footer;

    $: pinned = controller.pinnedMessages;

    $: {
        if (chatId !== controller.chatId) {
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
        creatingPoll = true;
    }

    $: chat = controller.chat;

    $: preview = isPreviewing($chat);
</script>

<svelte:window on:focus={onWindowFocus} />

<PollBuilder on:sendPoll={footer.sendPoll} bind:open={creatingPoll} />

<div class="wrapper">
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
        {blocked}
        {preview}
        {unreadMessages}
        selectedChatSummary={chat}
        hasPinned={$pinned.size > 0} />
    <CurrentChatMessages
        on:replyPrivatelyTo
        on:messageRead={messageRead}
        on:chatWith
        {controller}
        {preview}
        {firstUnreadMention}
        {firstUnreadMessage}
        {unreadMessages} />
    <Footer
        bind:this={footer}
        {joining}
        {preview}
        {blocked}
        {controller}
        on:joinGroup
        on:cancelPreview
        on:upgrade
        on:createPoll={createPoll} />
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

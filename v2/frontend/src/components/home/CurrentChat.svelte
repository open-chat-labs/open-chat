<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { rollbar } from "../../utils/logging";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import type { ChatController } from "../../fsm/chat.controller";
    import { onDestroy } from "svelte";

    export let controller: ChatController;
    export let blocked: boolean;

    let unreadMessages = 0;

    let unsub = controller.markRead.subscribe(() => {
        unreadMessages = controller.unreadMessageCount;
    });

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

    $: chat = controller.chat;
</script>

<div class="wrapper">
    <CurrentChatHeader
        {blocked}
        {unreadMessages}
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
        selectedChatSummary={chat} />
    <CurrentChatMessages
        on:replyPrivatelyTo
        on:messageRead={messageRead}
        on:chatWith
        {controller}
        {unreadMessages} />
    <Footer {blocked} {controller} />
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import { rollbar } from "../../utils/logging";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import type { ChatController } from "../../fsm/chat.controller";

    export let controller: ChatController;
    export let blocked: boolean;

    // todo - I suspect this is not going to be reactive in the way that we want
    $: unreadMessages = controller.unreadMessageCount;

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

    $: chat = controller.chat;
</script>

<div class="wrapper">
    <CurrentChatHeader
        user={controller.user}
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
        selectedChatSummary={chat} />
    <CurrentChatMessages
        on:replyPrivatelyTo
        on:messageRead
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

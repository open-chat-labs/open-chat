<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { getMinVisibleMessageIndex } from "../../domain/chat/chat.utils";
    import { rollbar } from "../../utils/logging";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";

    export let machine: ActorRefFrom<ChatMachine>;
    export let blocked: boolean;

    $: unreadMessages = $machine.context.markRead.unreadMessageCount(
        $machine.context.chatSummary.chatId,
        getMinVisibleMessageIndex($machine.context.chatSummary),
        $machine.context.chatSummary.latestMessage?.event.messageIndex
    );

    function toggleMuteNotifications() {
        const op = $machine.context.chatSummary.notificationsMuted ? "unmuted" : "muted";
        $machine.context.serviceContainer
            .toggleMuteNotifications(
                $machine.context.chatSummary.chatId,
                !$machine.context.chatSummary.notificationsMuted
            )
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
        const latestMessageIndex = $machine.context.chatSummary.latestMessage?.event.messageIndex;
        if (latestMessageIndex) {
            $machine.context.markRead.markRangeRead($machine.context.chatSummary.chatId, {
                from: getMinVisibleMessageIndex($machine.context.chatSummary),
                to: latestMessageIndex,
            });
        }
    }
</script>

<div class="wrapper">
    <CurrentChatHeader
        user={$machine.context.user}
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
        selectedChatSummary={$machine.context.chatSummary} />
    <CurrentChatMessages on:messageRead on:chatWith {machine} {unreadMessages} />
    <Footer {machine} />
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

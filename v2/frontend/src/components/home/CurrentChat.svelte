<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { rollbar } from "../../utils/logging";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";

    export let machine: ActorRefFrom<ChatMachine>;
    export let blocked: boolean;

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
</script>

<div class="wrapper">
    <CurrentChatHeader
        user={$machine.context.user}
        {blocked}
        on:clearSelection
        on:blockUser
        on:unblockUser
        on:toggleMuteNotifications={toggleMuteNotifications}
        on:addParticipants
        on:showGroupDetails
        on:showParticipants
        on:leaveGroup
        selectedChatSummary={$machine.context.chatSummary} />
    <CurrentChatMessages on:messageRead on:chatWith {machine} />
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

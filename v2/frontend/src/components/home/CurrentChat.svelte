<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { rollbar } from "../../utils/logging";

    export let machine: ActorRefFrom<ChatMachine>;
    export let blocked: boolean;

    function showGroupDetails() {
        machine.send({ type: "SHOW_GROUP_DETAILS" });
    }

    function showParticipants() {
        machine.send({ type: "SHOW_PARTICIPANTS" });
    }

    function addParticipants() {
        machine.send({ type: "ADD_PARTICIPANT" });
    }

    function toggleMuteNotifications() {
        machine.send({ type: "TOGGLE_MUTE_NOTIFICATIONS" });
        $machine.context.serviceContainer
            .toggleMuteNotifications(
                $machine.context.chatSummary.chatId,
                $machine.context.chatSummary.notificationsMuted
            )
            .then((resp) => {
                if (resp !== "success") {
                    machine.send({ type: "TOGGLE_MUTE_NOTIFICATIONS" });
                }
            })
            .catch((err) => {
                rollbar.error("Error toggling mute notifications", err);
                machine.send({ type: "TOGGLE_MUTE_NOTIFICATIONS" });
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
        on:addParticipants={addParticipants}
        on:showGroupDetails={showGroupDetails}
        on:showParticipants={showParticipants}
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

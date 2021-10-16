<script lang="ts">
    import Panel from "../Panel.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import type { EditGroupState } from "../../stores/editGroup";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import { toastStore } from "../../stores/toast";
    import { rollbar } from "../../utils/logging";

    export let api: ServiceContainer;
    export let editGroupState: EditGroupState;
    export let chat: GroupChatSummary;
    export let userId: string;

    // let's handle all the api interactions here
    // we will also need to hold the temporary state for edited group here as well
    // and that's all completely fine and sooooo much simpler

    function dismissAsAdmin(ev: CustomEvent<string>): void {
        api.dismissAsAdmin(chat.chatId, ev.detail)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to dismiss as admin", resp);
                    toastStore.showFailureToast("dismissAsAdminFailed");
                }
            })
            .catch((err) => {
                rollbar.error("Unable to dismiss as admin", err);
                toastStore.showFailureToast("dismissAsAdminFailed");
            });
    }

    function makeAdmin(ev: CustomEvent<string>): void {
        api.makeAdmin(chat.chatId, ev.detail)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to make admin", resp);
                    toastStore.showFailureToast("makeAdminFailed");
                }
            })
            .catch((err) => {
                rollbar.error("Unable to make admin", err);
                toastStore.showFailureToast("makeAdminFailed");
            });
    }

    function removeParticipant(ev: CustomEvent<string>): void {
        api.removeParticipant(chat.chatId, ev.detail)
            .then((resp) => {
                if (resp !== "success") {
                    rollbar.warn("Unable to remove participant", resp);
                    toastStore.showFailureToast("removeParticipantFailed");
                }
            })
            .catch((err) => {
                rollbar.error("Unable to remove participant", err);
                toastStore.showFailureToast("removeParticipantFailed");
            });
    }

    function cancelAddParticipants(): void {
        // machine.send({ type: "REMOVE_PARTICIPANT", data: ev.detail });
    }

    function cancelShowParticipants(): void {
        // machine.send({ type: "REMOVE_PARTICIPANT", data: ev.detail });
    }
</script>

<Panel right>
    {#if editGroupState === "group_details"}
        <GroupDetails />
    {:else if editGroupState === "add_participants"}
        <AddParticipants
            closeIcon={"close"}
            {chat}
            {api}
            on:cancelAddParticipants={cancelAddParticipants} />
    {:else if editGroupState === "show_participants"}
        <Participants
            closeIcon={"close"}
            {chat}
            {userId}
            on:close={cancelShowParticipants}
            on:blockUser
            on:chatWith
            on:dismissAsAdmin={dismissAsAdmin}
            on:removeParticipant={removeParticipant}
            on:makeAdmin={makeAdmin} />
    {/if}
</Panel>

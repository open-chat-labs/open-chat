<script lang="ts">
    import Panel from "../Panel.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import type { EditGroupState, UpdatedGroup } from "../../fsm/editGroup";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import { toastStore } from "../../stores/toast";
    import { rollbar } from "../../utils/logging";

    export let api: ServiceContainer;
    export let editGroupHistory: EditGroupState[];
    export let chat: GroupChatSummary;
    export let userId: string;

    $: lastState = editGroupHistory[editGroupHistory.length - 1];

    let updatedGroup: UpdatedGroup = {
        name: chat.name,
        desc: chat.description,
        avatar: chat.blobUrl
            ? {
                  blobUrl: chat.blobUrl,
                  blobData: chat.blobData,
              }
            : undefined,
    };

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
        chat.participants = chat.participants.filter((p) => p.userId !== ev.detail);
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

    function pop() {
        editGroupHistory = editGroupHistory.slice(0, editGroupHistory.length - 1);
    }
</script>

<Panel right>
    {#if lastState === "group_details"}
        <GroupDetails {api} {userId} {updatedGroup} {chat} on:close={pop} on:showParticipants />
    {:else if lastState === "add_participants"}
        <AddParticipants
            closeIcon={editGroupHistory.length > 1 ? "back" : "close"}
            {chat}
            {api}
            on:cancelAddParticipants={pop} />
    {:else if lastState === "show_participants"}
        <Participants
            closeIcon={editGroupHistory.length > 1 ? "back" : "close"}
            {chat}
            {userId}
            on:close={pop}
            on:blockUser
            on:chatWith
            on:addParticipants
            on:dismissAsAdmin={dismissAsAdmin}
            on:removeParticipant={removeParticipant}
            on:makeAdmin={makeAdmin} />
    {/if}
</Panel>

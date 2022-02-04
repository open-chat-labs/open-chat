<script lang="ts">
    import Panel from "../Panel.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import type { EditGroupState } from "../../fsm/editGroup";
    import type { FullParticipant, GroupChatSummary } from "../../domain/chat/chat";
    import type { Readable } from "svelte/store";
    import type { ChatController } from "../../fsm/chat.controller";
    import type { UserSummary } from "../../domain/user/user";
    import { toastStore } from "../../stores/toast";

    export let editGroupHistory: EditGroupState[];
    export let controller: ChatController;
    export let userId: string;

    let savingParticipants = false;
    let chat = controller.chat as Readable<GroupChatSummary>;
    $: participants = controller.participants;
    $: blockedUsers = controller.blockedUsers;

    $: lastState = editGroupHistory[editGroupHistory.length - 1];

    let updatedGroup = {
        name: $chat.name,
        desc: $chat.description,
        avatar: $chat.blobUrl
            ? {
                  blobUrl: $chat.blobUrl,
                  blobData: $chat.blobData,
              }
            : undefined,
        joinAsViewer: false,
    };

    function dismissAsAdmin(ev: CustomEvent<string>): void {
        controller.dismissAsAdmin(ev.detail);
    }

    function makeAdmin(ev: CustomEvent<string>): void {
        controller.makeAdmin(ev.detail);
    }

    function removeParticipant(ev: CustomEvent<string>): void {
        participants.update((ps) => ps.filter((p) => p.userId !== ev.detail));
        controller.removeParticipant(ev.detail);
    }

    function pop() {
        editGroupHistory = editGroupHistory.slice(0, editGroupHistory.length - 1);
    }

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        controller.blockUser(ev.detail.userId);
    }

    async function transferOwnership(ev: CustomEvent<FullParticipant>) {
        const success = await controller.transferOwnership(userId, ev.detail);
        if (success) {
            toastStore.showSuccessToast("transferOwnershipSucceeded");
        } else {
            toastStore.showFailureToast("transferOwnershipFailed");
        }
    }

    async function unblockUser(ev: CustomEvent<UserSummary>) {
        const success = await controller.addParticipants(true, [ev.detail]);
        if (success) {
            toastStore.showSuccessToast("unblockUserSucceeded");
        } else {
            toastStore.showFailureToast("unblockUserFailed");
        }
    }

    async function saveParticipants(ev: CustomEvent<UserSummary[]>) {
        savingParticipants = true;
        const success = await controller.addParticipants(false, ev.detail);
        if (success) {
            pop();
        } else {
            toastStore.showFailureToast("addParticipantsFailed");
        }
        savingParticipants = false;
    }
</script>

<Panel right>
    {#if lastState === "group_details"}
        <GroupDetails
            {controller}
            {updatedGroup}
            on:close={pop}
            on:showParticipants
            on:updateChat />
    {:else if lastState === "add_participants"}
        <AddParticipants
            busy={savingParticipants}
            closeIcon={editGroupHistory.length > 1 ? "back" : "close"}
            on:saveParticipants={saveParticipants}
            on:cancelAddParticipants={pop} />
    {:else if lastState === "show_participants"}
        <Participants
            closeIcon={editGroupHistory.length > 1 ? "back" : "close"}
            {participants}
            {blockedUsers}
            {chat}
            {userId}
            on:close={pop}
            on:blockUser={blockUser}
            on:unblockUser={unblockUser}
            on:transferOwnership={transferOwnership}
            on:chatWith
            on:addParticipants
            on:dismissAsAdmin={dismissAsAdmin}
            on:removeParticipant={removeParticipant}
            on:makeAdmin={makeAdmin} />
    {/if}
</Panel>

<script lang="ts">
    import Panel from "../Panel.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import type { RightPanelState } from "../../fsm/rightPanel";
    import type { FullParticipant, GroupChatSummary } from "../../domain/chat/chat";
    import type { Readable } from "svelte/store";
    import type { ChatController } from "../../fsm/chat.controller";
    import type { UserSummary } from "../../domain/user/user";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let rightPanelHistory: RightPanelState[];
    export let controller: ChatController;
    export let userId: string;

    let savingParticipants = false;
    let chat = controller.chat as Readable<GroupChatSummary>;
    $: participants = controller.participants;
    $: blockedUsers = controller.blockedUsers;

    $: lastState = rightPanelHistory[rightPanelHistory.length - 1];

    // capture a snapshot of the chat as it is right now
    let originalGroup = { ...$chat };

    let updatedGroup = {
        name: $chat.name,
        desc: $chat.description,
        avatar: $chat.blobUrl
            ? {
                  blobUrl: $chat.blobUrl,
                  blobData: $chat.blobData,
              }
            : undefined,
        permissions: { ...$chat.permissions },
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
        rightPanelHistory = rightPanelHistory.slice(0, rightPanelHistory.length - 1);
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

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>): void {
        dispatch("goToMessageIndex", ev.detail);
        pop();
    }
</script>

<Panel right>
    {#if lastState === "group_details"}
        <GroupDetails
            {controller}
            {originalGroup}
            {updatedGroup}
            on:close={pop}
            on:deleteGroup
            on:makeGroupPrivate
            on:chatWith
            on:showParticipants
            on:updateChat />
    {:else if lastState === "add_participants"}
        <AddParticipants
            busy={savingParticipants}
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
            on:saveParticipants={saveParticipants}
            on:cancelAddParticipants={pop} />
    {:else if lastState === "show_participants"}
        <Participants
            closeIcon={rightPanelHistory.length > 1 ? "back" : "close"}
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
    {:else if lastState === "show_pinned"}
        <PinnedMessages
            on:chatWith
            on:goToMessageIndex={goToMessageIndex}
            {controller}
            on:close={pop} />
    {/if}
</Panel>

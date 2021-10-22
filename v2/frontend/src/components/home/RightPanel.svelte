<script lang="ts">
    import Panel from "../Panel.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import type { EditGroupState, UpdatedGroup } from "../../fsm/editGroup";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import type { Writable } from "svelte/store";
    import type { ChatController } from "../../fsm/chat.controller";

    export let api: ServiceContainer;
    export let editGroupHistory: EditGroupState[];
    export let controller: ChatController;
    export let userId: string;

    let chat = controller.chat as Writable<GroupChatSummary>;

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
    };

    function dismissAsAdmin(ev: CustomEvent<string>): void {
        controller.dismissAsAdmin(ev.detail);
    }

    function makeAdmin(ev: CustomEvent<string>): void {
        controller.makeAdmin(ev.detail);
    }

    function removeParticipant(ev: CustomEvent<string>): void {
        chat.update((c) => ({
            ...c,
            participants: c.participants.filter((p) => p.userId !== ev.detail),
        }));
        controller.removeParticipant(ev.detail);
    }

    function pop() {
        editGroupHistory = editGroupHistory.slice(0, editGroupHistory.length - 1);
    }

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        controller.blockUser(ev.detail.userId);
    }
</script>

<Panel right>
    {#if lastState === "group_details"}
        <GroupDetails {controller} {userId} {updatedGroup} on:close={pop} on:showParticipants />
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
            on:blockUser={blockUser}
            on:chatWith
            on:addParticipants
            on:dismissAsAdmin={dismissAsAdmin}
            on:removeParticipant={removeParticipant}
            on:makeAdmin={makeAdmin} />
    {/if}
</Panel>

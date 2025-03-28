<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat, MultiUserChat } from "openchat-client";
    import GroupDetailsBody from "./GroupDetailsBody.svelte";
    import { currentChatRules } from "openchat-client";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let chat: MultiUserChat;
    export let memberCount: number;

    $: canEdit = client.canEditGroupDetails(chat.id);

    function editGroup() {
        if (canEdit) {
            dispatch("editGroup", { chat, rules: { ...$currentChatRules, newVersion: false } });
        }
    }

    function clickClose() {
        dispatch("close");
    }
</script>

<GroupDetailsHeader level={chat.level} {canEdit} on:close={clickClose} on:editGroup={editGroup} />

<GroupDetailsBody {chat} {memberCount} on:deleteGroup />

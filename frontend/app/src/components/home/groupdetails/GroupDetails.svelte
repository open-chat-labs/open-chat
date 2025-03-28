<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat, MultiUserChat } from "openchat-client";
    import GroupDetailsBody from "./GroupDetailsBody.svelte";
    import { currentChatRules, defaultChatRules } from "openchat-client";
    import { publish } from "@src/utils/pubsub";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let chat: MultiUserChat;
    export let memberCount: number;

    $: canEdit = client.canEditGroupDetails(chat.id);
    $: rules = $currentChatRules ?? defaultChatRules(chat.level);

    function editGroup() {
        if (canEdit) {
            publish("editGroup", { chat, rules: { ...rules, newVersion: false } });
        }
    }

    function clickClose() {
        dispatch("close");
    }
</script>

<GroupDetailsHeader level={chat.level} {canEdit} onClose={clickClose} onEditGroup={editGroup} />

<GroupDetailsBody {chat} {memberCount} />

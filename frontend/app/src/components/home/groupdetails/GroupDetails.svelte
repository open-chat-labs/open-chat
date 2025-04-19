<script lang="ts">
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import { app, defaultChatRules, publish } from "openchat-client";
    import { getContext } from "svelte";
    import GroupDetailsBody from "./GroupDetailsBody.svelte";
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        memberCount: number;
        onClose: () => void;
    }

    let { chat, memberCount, onClose }: Props = $props();

    let canEdit = $derived(client.canEditGroupDetails(chat.id));
    let rules = $derived(app.selectedChat.rules ?? defaultChatRules(chat.level));

    function editGroup() {
        if (canEdit) {
            publish("editGroup", { chat, rules: { ...rules, newVersion: false } });
        }
    }
</script>

<GroupDetailsHeader level={chat.level} {canEdit} {onClose} onEditGroup={editGroup} />

<GroupDetailsBody {chat} {memberCount} />

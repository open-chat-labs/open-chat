<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import { getContext } from "svelte";
    import type { OpenChat, MultiUserChat } from "openchat-client";
    import GroupDetailsBody from "./GroupDetailsBody.svelte";
    import { currentChatRules, defaultChatRules } from "openchat-client";
    import { publish } from "@src/utils/pubsub";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        memberCount: number;
        onClose: () => void;
    }

    let { chat, memberCount, onClose }: Props = $props();

    let canEdit = $derived(client.canEditGroupDetails(chat.id));
    let rules = $derived($currentChatRules ?? defaultChatRules(chat.level));

    function editGroup() {
        if (canEdit) {
            publish("editGroup", { chat, rules: { ...rules, newVersion: false } });
        }
    }
</script>

<GroupDetailsHeader level={chat.level} {canEdit} {onClose} onEditGroup={editGroup} />

<GroupDetailsBody {chat} {memberCount} />

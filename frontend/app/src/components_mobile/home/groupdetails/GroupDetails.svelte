<script lang="ts">
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import { defaultChatRules, publish, selectedChatRulesStore } from "openchat-client";
    import { getContext } from "svelte";
    import { updateGroupState } from "../createOrUpdateGroup/group.svelte";
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
    let rules = $derived($selectedChatRulesStore ?? defaultChatRules(chat.level));

    function editGroup() {
        if (canEdit) {
            updateGroupState.initialise({
                id: chat.id,
                kind: "candidate_group_chat",
                name: chat.name,
                description: chat.description,
                historyVisible: chat.historyVisible,
                public: chat.public,
                frozen: chat.frozen,
                members: [],
                permissions: { ...chat.permissions },
                rules: { ...rules, newVersion: false },
                avatar: {
                    blobUrl: chat.blobUrl,
                    blobData: chat.blobData,
                },
                gateConfig: { ...chat.gateConfig },
                level: chat.level,
                membership: chat.membership,
                eventsTTL: chat.eventsTTL,
                messagesVisibleToNonMembers: chat.messagesVisibleToNonMembers,
                externalUrl: chat.kind === "channel" ? chat.externalUrl : undefined,
                verified: chat.kind === "group_chat" ? chat.verified : false,
            });
            publish("updateGroup");
        }
    }
</script>

<GroupDetailsHeader level={chat.level} {canEdit} {onClose} onEditGroup={editGroup} />

<GroupDetailsBody {chat} {memberCount} />

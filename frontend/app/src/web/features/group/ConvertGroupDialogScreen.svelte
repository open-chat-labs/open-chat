<!-- Converting a group to a community (ConvertToCommunityDialog), as the old pages did: with the
     group's history setting and the community's default rules, then on to the new community. -->
<script lang="ts">
    import {
        chatIdentifiersEqual,
        defaultChatRules,
        selectedChatSummaryStore,
        type OpenChat,
    } from "@client";
    import ConvertToCommunityDialog from "@openchat/ui/src/features/components/ConvertToCommunityDialog.svelte";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "convert_group" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const group = $derived(
        $selectedChatSummaryStore?.kind === "group_chat" &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, dialog.chatId)
            ? $selectedChatSummaryStore
            : undefined,
    );

    // the dialog stays on its confirm step and says it failed when this rejects
    async function convert() {
        if (group === undefined) throw new Error("no group");
        const outcome = await client.convertGroupToCommunity(group, defaultChatRules("community"));
        if (outcome.kind === "failed") {
            toastStore.showFailureToast(outcome.message);
            throw new Error("not converted");
        }
        return { communityId: outcome.channelId.communityId };
    }
</script>

{#if group !== undefined}
    <ConvertToCommunityDialog
        groupName={group.name}
        onConfirm={convert}
        onGoTo={(communityId) => communityId && navigate(`/community/${communityId}`)}
        onCancel={onClose}
    />
{/if}

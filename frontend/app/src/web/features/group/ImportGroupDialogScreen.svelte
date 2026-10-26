<!-- Importing a group into a community you own, as a channel (ImportToCommunityDialog), as the old
     pages did, then on to the community. With no community of your own there's nothing to pick. -->
<script lang="ts">
    import {
        chatIdentifiersEqual,
        communitiesStore,
        ROLE_OWNER,
        selectedChatSummaryStore,
        type OpenChat,
    } from "@client";
    import ImportToCommunityDialog, {
        type ImportCommunity,
    } from "@openchat/ui/src/features/components/ImportToCommunityDialog.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "import_group" }>> = $props();

    const client = getContext<OpenChat>("client");

    const group = $derived(
        $selectedChatSummaryStore?.kind === "group_chat" &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, dialog.chatId)
            ? $selectedChatSummaryStore
            : undefined,
    );

    // the communities you own
    const communities = $derived(
        [...$communitiesStore.values()]
            .filter((c) => c.membership.role === ROLE_OWNER)
            .map(
                (c): ImportCommunity => ({
                    id: c.id.communityId,
                    name: c.name,
                    avatarUrl: c.avatar.blobUrl,
                    members: c.memberCount,
                    channels: c.channels.length,
                }),
            ),
    );

    onMount(() => {
        if (communities.length === 0) {
            toastStore.showFailureToast(i18nKey("communities.noOwned"));
            onClose();
        }
    });

    // the dialog stays open and says it failed when this rejects
    async function importGroup(community: ImportCommunity) {
        if (group === undefined) throw new Error("no group");
        const channelId = await client.importToCommunity(group.id, {
            kind: "community",
            communityId: community.id,
        });
        if (channelId === undefined) {
            toastStore.showFailureToast(i18nKey("communities.errors.importFailed"));
            throw new Error("not imported");
        }
        navigate(`/community/${channelId.communityId}`);
    }
</script>

{#if group !== undefined && communities.length > 0}
    <ImportToCommunityDialog
        groupName={group.name}
        {communities}
        onConfirm={importGroup}
        onCancel={onClose}
    />
{/if}

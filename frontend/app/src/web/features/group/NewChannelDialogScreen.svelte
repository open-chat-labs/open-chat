<!-- A new channel in the selected community, or an embedded one (NewChannelDialog): the client's
     blank channel with the dialog's name, description, visibility and URL (newChannelCandidate),
     created through UpdateGroupState as the old flows did, then opened. -->
<script lang="ts">
    import {
        chatListScopeStore,
        routeForChatIdentifier,
        selectedCommunitySummaryStore,
        type OpenChat,
    } from "@client";
    import NewChannelDialog, {
        type NameCheck,
        type NewChannel,
    } from "@openchat/ui/src/features/components/NewChannelDialog.svelte";
    import {
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        UpdateGroupState,
    } from "@src/logic/groupOrCommunity/group.svelte";
    import { newChannelCandidate } from "@src/logic/groupOrCommunity/newChannel";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, tick } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "new_channel" }>> = $props();

    const client = getContext<OpenChat>("client");

    const community = $derived(
        $selectedCommunitySummaryStore?.id.communityId === dialog.communityId.communityId
            ? $selectedCommunitySummaryStore
            : undefined,
    );

    // the dialog arms at two characters; a name is 3 to 40, as the old editors had it
    function checkName(name: string): Promise<NameCheck> {
        const n = name.trim().length;
        return Promise.resolve(n >= MIN_NAME_LENGTH && n <= MAX_NAME_LENGTH ? "ok" : "invalid");
    }

    // the dialog keeps the form and says it failed when this rejects
    async function create(form: NewChannel) {
        const blank = client.createCandidateGroup("channel", form.embedded);
        if (blank === undefined) throw new Error("not in a community");
        const editor = new UpdateGroupState();
        editor.initialise(blank);
        editor.candidateGroup = newChannelCandidate(blank, form);
        const outcome = await editor.saveGroup(client);
        switch (outcome.kind) {
            case "created_without_invites":
            case "created": {
                const chatId = outcome.chatId;
                // the new channel is in the chat list by the next tick
                void tick().then(() =>
                    navigate(routeForChatIdentifier($chatListScopeStore.kind, chatId)),
                );
                return;
            }
            case "failed":
                toastStore.showFailureToast(outcome.message);
                throw new Error("not created");
            default:
                throw new Error(outcome.kind);
        }
    }
</script>

{#if community !== undefined}
    <NewChannelDialog
        communityName={community.name}
        embedded={dialog.embedded}
        defaultPublic={community.public && client.canCreatePublicChannel(community.id)}
        {checkName}
        onCreate={create}
        onCancel={onClose}
    />
{/if}

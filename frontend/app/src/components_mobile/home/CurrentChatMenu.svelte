<script lang="ts">
    import { disableMakeProposalFeature } from "@src/utils/features";
    import { MenuItem } from "component-lib";
    import {
        allUsersStore,
        type ChatSummary,
        currentUserIdStore,
        directChatBotsStore,
        favouritesStore,
        isProposalGroupStore,
        type MultiUserChat,
        notificationsSupported,
        type OpenChat,
        platformModeratorStore,
        publish,
        selectedChatPinnedMessagesStore,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { canDeleteDirectChat, publishDeleteDirectChat } from "../../utils/directChat";
    import { toastStore } from "../../stores/toast";
    import Translatable from "@shared_components/Translatable.svelte";
    import { setFrozen } from "@src/logic/moderation/freeze";
    import { unsuspendUser as unsuspend } from "@src/logic/moderation/chatModeration";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedChatSummary: ChatSummary;
        blocked: boolean;
        hasPinned: boolean;
        onShowGroupDetails: () => void;
        onSearchChat: (search: string) => void;
    }

    let { selectedChatSummary, blocked, hasPinned, onShowGroupDetails, onSearchChat }: Props =
        $props();

    let botIdToUninstall = $derived(
        selectedChatSummary.kind === "direct_chat" &&
            $directChatBotsStore.has(selectedChatSummary.them.userId)
            ? selectedChatSummary.them.userId
            : undefined,
    );
    let governanceCanisterId = $derived(
        selectedChatSummary.kind !== "direct_chat" &&
            selectedChatSummary.subtype?.kind === "governance_proposals"
            ? selectedChatSummary.subtype.governanceCanisterId
            : undefined,
    );
    let canMakeProposals = $derived(
        !disableMakeProposalFeature &&
            (client.tryGetNervousSystem(governanceCanisterId)?.submittingProposalsEnabled ?? false),
    );
    // let canMakeProposals = $derived(true);
    let userId = $derived(
        selectedChatSummary.kind === "direct_chat" ? selectedChatSummary.them.userId : "",
    );
    let isBot = $derived($allUsersStore.get(userId)?.kind === "bot");
    let isSuspended = $derived($allUsersStore.get(userId)?.suspended ?? false);
    let showDeleteDirectChat = $derived(canDeleteDirectChat(selectedChatSummary));

    function toggleMuteNotifications(
        mute: boolean | undefined,
        muteAtEveryone: boolean | undefined,
    ) {
        publish("toggleMuteNotifications", {
            chatId: selectedChatSummary.id,
            mute,
            muteAtEveryone,
        });
    }

    function addToFavourites() {
        client.addToFavourites(selectedChatSummary.id);
    }

    function removeFromFavourites() {
        client.removeFromFavourites(selectedChatSummary.id);
    }

    function copyUrl() {
        publish("copyUrl");
    }

    function showGroupDetails() {
        onShowGroupDetails();
    }

    function showPinned(chat: MultiUserChat) {
        publish("showPinned", { chat, pinned: $selectedChatPinnedMessagesStore });
    }

    function searchChat() {
        onSearchChat("");
    }

    function showProposalFilters() {
        publish("showProposalFilters");
    }

    async function blockUser(blocking: boolean) {
        if (selectedChatSummary.kind !== "direct_chat") return;
        toastStore.showOutcome(
            await client.setBlockedInDirectChat(selectedChatSummary.them.userId, blocking),
        );
    }

    function leaveGroup() {
        if (selectedChatSummary.kind === "direct_chat") return;
        publish("leaveGroup", {
            kind: "leave",
            chatId: selectedChatSummary.id,
            level: selectedChatSummary.level,
        });
    }

    async function setGroupFrozen(frozen: boolean) {
        if (selectedChatSummary.kind === "group_chat") {
            const target = { kind: "group" as const, id: selectedChatSummary.id };
            const outcome = await setFrozen(client, target, frozen);
            // this menu says only when it fails (the timeline shows the change)
            if (outcome.kind === "failed") toastStore.showOutcome(outcome);
        }
    }

    function onSuspendUser() {
        publish("suspendUser", userId);
    }

    async function unsuspendUser() {
        toastStore.showOutcome(await unsuspend(client, userId));
    }

    function makeProposal() {
        publish("makeProposal");
    }

    function removeBot(botId: string) {
        client
            .uninstallBot({ kind: "direct_chat", userId: $currentUserIdStore }, botId)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
                }
            });
    }

</script>

<MenuItem onclick={searchChat}>
    <Translatable resourceKey={i18nKey("searchChat")} />
</MenuItem>
{#if !$favouritesStore.has(selectedChatSummary.id)}
    <MenuItem onclick={addToFavourites}>
        <Translatable resourceKey={i18nKey("communities.addToFavourites")} />
    </MenuItem>
{:else}
    <MenuItem onclick={removeFromFavourites}>
        <Translatable resourceKey={i18nKey("communities.removeFromFavourites")} />
    </MenuItem>
{/if}
<MenuItem onclick={copyUrl}>
    <Translatable resourceKey={i18nKey("copyUrl")} />
</MenuItem>
{#if selectedChatSummary.kind === "direct_chat"}
    <MenuItem onclick={showGroupDetails}>
        <Translatable resourceKey={i18nKey("chatDetails")} />
    </MenuItem>
{/if}
{#if $isProposalGroupStore}
    <MenuItem onclick={showProposalFilters}>
        <Translatable resourceKey={i18nKey("proposal.filter")} />
    </MenuItem>
{/if}
{#if selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel"}
    {#if hasPinned}
        <MenuItem onclick={() => showPinned(selectedChatSummary)}>
            <Translatable resourceKey={i18nKey("showPinned")} />
        </MenuItem>
    {/if}
    <MenuItem onclick={showGroupDetails}>
        <Translatable resourceKey={i18nKey("groupDetails", undefined, selectedChatSummary.level)} />
    </MenuItem>

    {#if canMakeProposals}
        <MenuItem onclick={makeProposal}>
            <Translatable resourceKey={i18nKey("proposal.makeProposal")} />
        </MenuItem>
    {/if}

    {#if $platformModeratorStore && selectedChatSummary.kind === "group_chat"}
        {#if client.isChatFrozen(selectedChatSummary.id)}
            <MenuItem danger onclick={() => setGroupFrozen(false)}>
                <Translatable resourceKey={i18nKey("unfreezeGroup")} />
            </MenuItem>
        {:else}
            <MenuItem danger onclick={() => setGroupFrozen(true)}>
                <Translatable resourceKey={i18nKey("freezeGroup")} />
            </MenuItem>
        {/if}
    {/if}

    {#if client.canLeaveGroup(selectedChatSummary.id)}
        <MenuItem danger onclick={leaveGroup}>
            <Translatable
                resourceKey={i18nKey("leaveGroup", undefined, selectedChatSummary.level, true)} />
        </MenuItem>
    {/if}
{/if}
{#if selectedChatSummary.kind === "direct_chat" && !isBot}
    {#if notificationsSupported}
        {#if selectedChatSummary.membership.notificationsMuted === true}
            <MenuItem onclick={() => toggleMuteNotifications(false, undefined)}>
                <Translatable resourceKey={i18nKey("unmuteNotifications")} />
            </MenuItem>
        {:else}
            <MenuItem onclick={() => toggleMuteNotifications(true, undefined)}>
                <Translatable resourceKey={i18nKey("muteNotifications")} />
            </MenuItem>
        {/if}
    {/if}
    {#if blocked}
        <MenuItem onclick={() => blockUser(false)}>
            <Translatable resourceKey={i18nKey("unblockUser")} />
        </MenuItem>
    {:else}
        <MenuItem onclick={() => blockUser(true)}>
            <Translatable resourceKey={i18nKey("blockUser")} />
        </MenuItem>
    {/if}
    {#if $platformModeratorStore}
        {#if isSuspended}
            <MenuItem onclick={unsuspendUser}>
                <Translatable resourceKey={i18nKey("unsuspendUser")} />
            </MenuItem>
        {:else}
            <MenuItem onclick={onSuspendUser}>
                <Translatable resourceKey={i18nKey("suspendUser")} />
            </MenuItem>
        {/if}
    {/if}
{/if}
{#if botIdToUninstall !== undefined}
    <MenuItem onclick={() => removeBot(botIdToUninstall)}>
        <Translatable resourceKey={i18nKey("bots.manage.remove")} />
    </MenuItem>
{/if}
{#if showDeleteDirectChat}
    <MenuItem danger onclick={() => publishDeleteDirectChat(selectedChatSummary)}>
        <Translatable resourceKey={i18nKey("deleteChat")} />
    </MenuItem>
{/if}

<script lang="ts">
    import { MenuItem } from "component-lib";
    import {
        allUsersStore,
        chatIdentifiersEqual,
        type ChatSummary,
        currentUserIdStore,
        directChatBotsStore,
        favouritesStore,
        type GroupChatSummary,
        isDiamondStore,
        isProposalGroupStore,
        mobileWidth,
        notificationsSupported,
        type OpenChat,
        platformModeratorStore,
        publish,
        setRightPanelHistory,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import ChatQuestionIcon from "svelte-material-icons/ChatQuestion.svelte";
    import TickIcon from "svelte-material-icons/Check.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import Import from "svelte-material-icons/Import.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import Tune from "svelte-material-icons/Tune.svelte";
    import VideoOutline from "svelte-material-icons/VideoOutline.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import { activeVideoCall } from "../../stores/video";
    import ConvertToCommunity from "../icons/ConvertToCommunity.svelte";
    import HeartMinus from "../icons/HeartMinus.svelte";
    import HeartPlus from "../icons/HeartPlus.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedChatSummary: ChatSummary;
        blocked: boolean;
        hasPinned: boolean;
        onShowGroupDetails: () => void;
        onSearchChat: (search: string) => void;
        onImportToCommunity: (group: GroupChatSummary) => void;
    }

    let {
        selectedChatSummary,
        blocked,
        hasPinned,
        onShowGroupDetails,
        onSearchChat,
        onImportToCommunity,
    }: Props = $props();

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
        client.tryGetNervousSystem(governanceCanisterId)?.submittingProposalsEnabled ?? false,
    );
    let userId = $derived(
        selectedChatSummary.kind === "direct_chat" ? selectedChatSummary.them.userId : "",
    );
    let isBot = $derived($allUsersStore.get(userId)?.kind === "bot");
    let isSuspended = $derived($allUsersStore.get(userId)?.suspended ?? false);
    let canConvert = $derived(
        selectedChatSummary.kind === "group_chat" &&
            client.canConvertGroupToCommunity(selectedChatSummary.id),
    );
    let canImportToCommunity = $derived(client.canImportToCommunity(selectedChatSummary.id));
    let canStartVideoCalls = $derived(
        !blocked && client.canStartVideoCalls(selectedChatSummary.id),
    );

    let videoCallInProgress = $derived(selectedChatSummary.videoCallInProgress !== undefined);
    let isPublic = $derived(!client.isChatPrivate(selectedChatSummary));

    let inCall = $derived(
        $activeVideoCall !== undefined &&
            videoCallInProgress &&
            chatIdentifiersEqual($activeVideoCall.chatId, selectedChatSummary?.id),
    );

    let videoMenuText = $derived(
        videoCallInProgress
            ? i18nKey("videoCall.joinVideo")
            : isPublic
              ? i18nKey("videoCall.startBroadcast")
              : i18nKey("videoCall.startVideo"),
    );

    let canRegisterWebhook = $derived(client.canRegisterWebhook(selectedChatSummary.id));

    let canStartOrJoinVideoCall = $derived(!inCall && (videoCallInProgress || canStartVideoCalls));

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

    function showPinned() {
        setRightPanelHistory([
            {
                kind: "show_pinned",
            },
        ]);
    }

    function searchChat() {
        onSearchChat("");
    }

    function showProposalFilters() {
        publish("showProposalFilters");
    }

    function showGroupMembers() {
        publish("showGroupMembers");
    }

    function blockUser() {
        if (selectedChatSummary.kind === "direct_chat") {
            client.blockUserFromDirectChat(selectedChatSummary.them.userId).then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
                } else {
                    toastStore.showFailureToast(i18nKey("blockUserFailed"));
                }
            });
        }
    }

    function unblockUser() {
        if (selectedChatSummary.kind === "direct_chat") {
            client.unblockUserFromDirectChat(selectedChatSummary.them.userId).then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
                } else {
                    toastStore.showFailureToast(i18nKey("unblockUserFailed"));
                }
            });
        }
    }

    function showInviteGroupUsers() {
        publish("showInviteGroupUsers", true);
    }

    function leaveGroup() {
        if (selectedChatSummary.kind === "direct_chat") return;
        publish("leaveGroup", {
            kind: "leave",
            chatId: selectedChatSummary.id,
            level: selectedChatSummary.level,
        });
    }

    function convertToCommunity() {
        if (!$isDiamondStore) {
            publish("upgrade");
        } else {
            if (selectedChatSummary.kind === "group_chat") {
                publish("convertGroupToCommunity", selectedChatSummary);
            }
        }
    }

    function importToCommunity() {
        if (selectedChatSummary.kind === "group_chat") {
            onImportToCommunity(selectedChatSummary);
        }
    }

    function freezeGroup() {
        if (selectedChatSummary.id.kind === "group_chat") {
            client.freezeGroup(selectedChatSummary.id, undefined).then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("failedToFreezeGroup"));
                }
            });
        }
    }

    function unfreezeGroup() {
        if (selectedChatSummary.id.kind === "group_chat") {
            client.unfreezeGroup(selectedChatSummary.id).then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("failedToUnfreezeGroup"));
                }
            });
        }
    }

    function onSuspendUser() {
        publish("suspendUser", userId);
    }

    function unsuspendUser() {
        client.unsuspendUser(userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("unsuspendedUser"));
            } else {
                toastStore.showFailureToast(i18nKey("failedToUnsuspendUser"));
            }
        });
    }

    function makeProposal() {
        publish("makeProposal");
    }

    function registerWebhook() {
        publish("registerWebhook");
    }

    function startVideoCall() {
        publish("startVideoCall", {
            chatId: selectedChatSummary.id,
            callType: isPublic ? "broadcast" : "default",
            join: videoCallInProgress,
        });
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

{#if canStartOrJoinVideoCall}
    <MenuItem onclick={startVideoCall}>
        {#snippet icon(color, size)}
            <VideoOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={videoMenuText} />
    </MenuItem>
{/if}
{#if !$favouritesStore.has(selectedChatSummary.id)}
    <MenuItem danger onclick={addToFavourites}>
        {#snippet icon(color, size)}
            <HeartPlus {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("communities.addToFavourites")} />
    </MenuItem>
{:else}
    <MenuItem danger onclick={removeFromFavourites}>
        {#snippet icon(color, size)}
            <HeartMinus {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("communities.removeFromFavourites")} />
    </MenuItem>
{/if}
<MenuItem onclick={copyUrl}>
    {#snippet icon(color, size)}
        <ContentCopy {color} {size} />
    {/snippet}
    <Translatable resourceKey={i18nKey("copyUrl")} />
</MenuItem>
{#if $mobileWidth}
    {#if selectedChatSummary.kind === "direct_chat"}
        <MenuItem onclick={showGroupDetails}>
            {#snippet icon(color, size)}
                <FileDocument {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("chatDetails")} />
        </MenuItem>
    {/if}
    {#if $isProposalGroupStore}
        <MenuItem onclick={showProposalFilters}>
            {#snippet icon(color, size)}
                <Tune {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("proposal.filter")} />
        </MenuItem>
    {/if}
    <MenuItem onclick={searchChat}>
        {#snippet icon(color, size)}
            <Magnify {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("searchChat")} />
    </MenuItem>
{/if}
{#if selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel"}
    {#if $mobileWidth}
        {#if hasPinned}
            <MenuItem onclick={showPinned}>
                {#snippet icon(color, size)}
                    <Pin {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("showPinned")} />
            </MenuItem>
        {/if}
        <MenuItem onclick={showGroupDetails}>
            {#snippet icon(color, size)}
                <FileDocument {color} {size} />
            {/snippet}
            <Translatable
                resourceKey={i18nKey("groupDetails", undefined, selectedChatSummary.level)} />
        </MenuItem>
        <MenuItem onclick={showGroupMembers}>
            {#snippet icon(color, size)}
                <AccountMultiple {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("members")} />
        </MenuItem>
        {#if client.canInviteUsers(selectedChatSummary.id)}
            <MenuItem onclick={showInviteGroupUsers}>
                {#snippet icon(color, size)}
                    <AccountMultiplePlus {color} {size} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey(
                        "group.inviteUsers",
                        undefined,
                        selectedChatSummary.level,
                        true,
                    )} />
            </MenuItem>
        {/if}
    {/if}

    {#if notificationsSupported}
        {#if selectedChatSummary.membership.notificationsMuted === true}
            <MenuItem onclick={() => toggleMuteNotifications(false, undefined)}>
                {#snippet icon(color, size)}
                    <Bell {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("unmuteNotifications")} />
            </MenuItem>
        {:else}
            <MenuItem onclick={() => toggleMuteNotifications(true, undefined)}>
                {#snippet icon(color, size)}
                    <BellOff {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("muteNotifications")} />
            </MenuItem>
        {/if}
        {#if selectedChatSummary.membership.atEveryoneMuted === true}
            <MenuItem onclick={() => toggleMuteNotifications(undefined, false)}>
                {#snippet icon(color, size)}
                    <Bell {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("unmuteAtEveryone")} />
            </MenuItem>
        {:else}
            <MenuItem onclick={() => toggleMuteNotifications(undefined, true)}>
                {#snippet icon(color, size)}
                    <BellOff {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("muteAtEveryone")} />
            </MenuItem>
        {/if}
    {/if}

    {#if canMakeProposals}
        <MenuItem onclick={makeProposal}>
            {#snippet icon(color, size)}
                <ChatQuestionIcon {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("proposal.makeProposal")} />
        </MenuItem>
    {/if}

    {#if canRegisterWebhook}
        <MenuItem onclick={registerWebhook}>
            {#snippet icon(color, size)}
                <Webhook {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("webhook.registerTitle")} />
        </MenuItem>
    {/if}

    {#if $platformModeratorStore && selectedChatSummary.kind === "group_chat"}
        {#if client.isChatFrozen(selectedChatSummary.id)}
            <MenuItem danger onclick={unfreezeGroup}>
                {#snippet icon(color, size)}
                    <TickIcon {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("unfreezeGroup")} />
            </MenuItem>
        {:else}
            <MenuItem danger onclick={freezeGroup}>
                {#snippet icon(color, size)}
                    <CancelIcon {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("freezeGroup")} />
            </MenuItem>
        {/if}
    {/if}

    {#if client.canLeaveGroup(selectedChatSummary.id)}
        <MenuItem danger onclick={leaveGroup}>
            {#snippet icon(color, size)}
                <LocationExit {color} {size} />
            {/snippet}
            <Translatable
                resourceKey={i18nKey("leaveGroup", undefined, selectedChatSummary.level, true)} />
        </MenuItem>
    {/if}
    {#if canConvert}
        <MenuItem danger onclick={convertToCommunity}>
            {#snippet icon(color, size)}
                <ConvertToCommunity {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("communities.convert")} />
        </MenuItem>
    {/if}
    {#if canImportToCommunity}
        <MenuItem danger onclick={importToCommunity}>
            {#snippet icon(color, size)}
                <Import {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("communities.import")} />
        </MenuItem>
    {/if}
{/if}
{#if selectedChatSummary.kind === "direct_chat" && !isBot}
    {#if hasPinned}
        <MenuItem onclick={showPinned}>
            {#snippet icon(color, size)}
                <Pin {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("showPinned")} />
        </MenuItem>
    {/if}
    {#if notificationsSupported}
        {#if selectedChatSummary.membership.notificationsMuted === true}
            <MenuItem onclick={() => toggleMuteNotifications(false, undefined)}>
                {#snippet icon(color, size)}
                    <Bell {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("unmuteNotifications")} />
            </MenuItem>
        {:else}
            <MenuItem onclick={() => toggleMuteNotifications(true, undefined)}>
                {#snippet icon(color, size)}
                    <BellOff {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("muteNotifications")} />
            </MenuItem>
        {/if}
    {/if}
    {#if blocked}
        <MenuItem onclick={unblockUser}>
            {#snippet icon(color, size)}
                <CancelIcon {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("unblockUser")} />
        </MenuItem>
    {:else}
        <MenuItem onclick={blockUser}>
            {#snippet icon(color, size)}
                <CancelIcon {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("blockUser")} />
        </MenuItem>
    {/if}
    {#if $platformModeratorStore}
        {#if isSuspended}
            <MenuItem onclick={unsuspendUser}>
                {#snippet icon(color, size)}
                    <TickIcon {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("unsuspendUser")} />
            </MenuItem>
        {:else}
            <MenuItem onclick={onSuspendUser}>
                {#snippet icon(color, size)}
                    <CancelIcon {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("suspendUser")} />
            </MenuItem>
        {/if}
    {/if}
{/if}
{#if botIdToUninstall !== undefined}
    <MenuItem onclick={() => removeBot(botIdToUninstall)}>
        {#snippet icon(color, size)}
            <DeleteOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("bots.manage.remove")} />
    </MenuItem>
{/if}

<script lang="ts">
    import {
        allUsersStore,
        chatIdentifiersEqual,
        type ChatSummary,
        currentUserIdStore,
        directChatBotsStore,
        favouritesStore,
        type GroupChatSummary,
        iconSize,
        isDiamondStore,
        isProposalGroupStore,
        lastRightPanelState,
        messagesRead,
        mobileWidth,
        notificationsSupported,
        type OpenChat,
        platformModeratorStore,
        publish,
        setRightPanelHistory,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import ChatQuestionIcon from "svelte-material-icons/ChatQuestion.svelte";
    import TickIcon from "svelte-material-icons/Check.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import Headphones from "svelte-material-icons/Headphones.svelte";
    import Import from "svelte-material-icons/Import.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import Tune from "svelte-material-icons/Tune.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { toastStore } from "../../stores/toast";
    import { activeVideoCall } from "../../stores/video";
    import HoverIcon from "../HoverIcon.svelte";
    import ConvertToCommunity from "../icons/ConvertToCommunity.svelte";
    import HeartMinus from "../icons/HeartMinus.svelte";
    import HeartPlus from "../icons/HeartPlus.svelte";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
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
    let groupDetailsSelected = $derived($lastRightPanelState.kind === "group_details");
    let pinnedSelected = $derived($lastRightPanelState.kind === "show_pinned");
    let membersSelected = $derived($lastRightPanelState.kind === "show_group_members");
    let inviteMembersSelected = $derived($lastRightPanelState.kind === "invite_group_users");
    let desktop = $derived(!$mobileWidth);
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

    let hasUnreadPinned = $state(false);

    $effect(() => {
        setUnreadPinned(hasPinned, selectedChatSummary);
    });

    onMount(() => {
        return messagesRead.subscribe(() => setUnreadPinned(hasPinned, selectedChatSummary));
    });

    function setUnreadPinned(hasPinned: boolean, chat: ChatSummary) {
        hasUnreadPinned =
            hasPinned &&
            (chat.kind === "group_chat" || chat.kind === "channel") &&
            client.unreadPinned(chat.id, chat.dateLastPinned);
    }

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

{#if desktop}
    {#if $isProposalGroupStore}
        <HoverIcon onclick={showProposalFilters} title={$_("showFilters")}>
            <Tune size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    {/if}
    <HoverIcon onclick={searchChat} title={$_("searchChat")}>
        <Magnify size={$iconSize} color={"var(--icon-txt)"} />
    </HoverIcon>

    {#if hasPinned}
        <HoverIcon onclick={showPinned} title={$_("showPinned")}>
            <div
                class="pin"
                class:unread={!pinnedSelected && hasUnreadPinned}
                class:rtl={$rtlStore}>
                <Pin
                    size={$iconSize}
                    color={pinnedSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </div>
        </HoverIcon>
    {/if}

    {#if selectedChatSummary.kind === "direct_chat"}
        <HoverIcon onclick={showGroupDetails}>
            <FileDocument
                size={$iconSize}
                color={groupDetailsSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </HoverIcon>
    {/if}

    {#if selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel"}
        <HoverIcon
            onclick={showGroupDetails}
            title={interpolate($_, i18nKey("groupDetails", undefined, selectedChatSummary.level))}>
            <FileDocument
                size={$iconSize}
                color={groupDetailsSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon onclick={showGroupMembers} title={$_("members")}>
            <AccountMultiple
                size={$iconSize}
                color={membersSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </HoverIcon>
        {#if selectedChatSummary.public || client.canInviteUsers(selectedChatSummary.id)}
            <HoverIcon
                onclick={showInviteGroupUsers}
                title={interpolate(
                    $_,
                    i18nKey("group.inviteUsers", undefined, selectedChatSummary.level, true),
                )}>
                <AccountMultiplePlus
                    size={$iconSize}
                    color={inviteMembersSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
    {/if}
{/if}
<div class="menu">
    <MenuIcon position={"bottom"} align={"end"}>
        {#snippet menuIcon()}
            <HoverIcon title={$_("chatMenu")}>
                <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        {/snippet}
        {#snippet menuItems()}
            <Menu>
                {#if canStartOrJoinVideoCall}
                    <MenuItem onclick={startVideoCall}>
                        {#snippet icon()}
                            <Headphones size={$iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <Translatable resourceKey={videoMenuText} />
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if !$favouritesStore.has(selectedChatSummary.id)}
                    <MenuItem onclick={addToFavourites}>
                        {#snippet icon()}
                            <HeartPlus size={$iconSize} color={"var(--menu-warn)"} />
                        {/snippet}
                        {#snippet text()}
                            <Translatable resourceKey={i18nKey("communities.addToFavourites")} />
                        {/snippet}
                    </MenuItem>
                {:else}
                    <MenuItem onclick={removeFromFavourites}>
                        {#snippet icon()}
                            <HeartMinus size={$iconSize} color={"var(--menu-warn)"} />
                        {/snippet}
                        {#snippet text()}
                            <Translatable
                                resourceKey={i18nKey("communities.removeFromFavourites")} />
                        {/snippet}
                    </MenuItem>
                {/if}
                <MenuItem onclick={copyUrl}>
                    {#snippet icon()}
                        <ContentCopy size={$iconSize} color={"var(--icon-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <Translatable resourceKey={i18nKey("copyUrl")} />
                    {/snippet}
                </MenuItem>
                {#if $mobileWidth}
                    {#if selectedChatSummary.kind === "direct_chat"}
                        <MenuItem onclick={showGroupDetails}>
                            {#snippet icon()}
                                <FileDocument size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("chatDetails")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if $isProposalGroupStore}
                        <MenuItem onclick={showProposalFilters}>
                            {#snippet icon()}
                                <Tune size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("proposal.filter")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    <MenuItem onclick={searchChat}>
                        {#snippet icon()}
                            <Magnify size={$iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <Translatable resourceKey={i18nKey("searchChat")} />
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel"}
                    {#if $mobileWidth}
                        {#if hasPinned}
                            <MenuItem onclick={showPinned}>
                                {#snippet icon()}
                                    <Pin
                                        size={$iconSize}
                                        color={hasUnreadPinned
                                            ? "var(--icon-selected)"
                                            : "var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("showPinned")} />
                                {/snippet}
                            </MenuItem>
                        {/if}
                        <MenuItem onclick={showGroupDetails}>
                            {#snippet icon()}
                                <FileDocument size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable
                                    resourceKey={i18nKey(
                                        "groupDetails",
                                        undefined,
                                        selectedChatSummary.level,
                                    )} />
                            {/snippet}
                        </MenuItem>
                        <MenuItem onclick={showGroupMembers}>
                            {#snippet icon()}
                                <AccountMultiple
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("members")} />
                            {/snippet}
                        </MenuItem>
                        {#if client.canInviteUsers(selectedChatSummary.id)}
                            <MenuItem onclick={showInviteGroupUsers}>
                                {#snippet icon()}
                                    <AccountMultiplePlus
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "group.inviteUsers",
                                            undefined,
                                            selectedChatSummary.level,
                                            true,
                                        )} />
                                {/snippet}
                            </MenuItem>
                        {/if}
                    {/if}

                    {#if notificationsSupported}
                        {#if selectedChatSummary.membership.notificationsMuted === true}
                            <MenuItem onclick={() => toggleMuteNotifications(false, undefined)}>
                                {#snippet icon()}
                                    <Bell size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("unmuteNotifications")} />
                                {/snippet}
                            </MenuItem>
                        {:else}
                            <MenuItem onclick={() => toggleMuteNotifications(true, undefined)}>
                                {#snippet icon()}
                                    <BellOff size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("muteNotifications")} />
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if selectedChatSummary.membership.atEveryoneMuted === true}
                            <MenuItem onclick={() => toggleMuteNotifications(undefined, false)}>
                                {#snippet icon()}
                                    <Bell size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("unmuteAtEveryone")} />
                                {/snippet}
                            </MenuItem>
                        {:else}
                            <MenuItem onclick={() => toggleMuteNotifications(undefined, true)}>
                                {#snippet icon()}
                                    <BellOff size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("muteAtEveryone")} />
                                {/snippet}
                            </MenuItem>
                        {/if}
                    {/if}

                    {#if canMakeProposals}
                        <MenuItem onclick={makeProposal}>
                            {#snippet icon()}
                                <ChatQuestionIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("proposal.makeProposal")} />
                            {/snippet}
                        </MenuItem>
                    {/if}

                    {#if canRegisterWebhook}
                        <MenuItem onclick={registerWebhook}>
                            {#snippet icon()}
                                <Webhook size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("webhook.registerTitle")} />
                            {/snippet}
                        </MenuItem>
                    {/if}

                    {#if $platformModeratorStore && selectedChatSummary.kind === "group_chat"}
                        {#if client.isChatFrozen(selectedChatSummary.id)}
                            <MenuItem warning onclick={unfreezeGroup}>
                                {#snippet icon()}
                                    <TickIcon size={$iconSize} color={"var(--menu-warn"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("unfreezeGroup")} />
                                {/snippet}
                            </MenuItem>
                        {:else}
                            <MenuItem warning onclick={freezeGroup}>
                                {#snippet icon()}
                                    <CancelIcon size={$iconSize} color={"var(--menu-warn"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("freezeGroup")} />
                                {/snippet}
                            </MenuItem>
                        {/if}
                    {/if}

                    {#if client.canLeaveGroup(selectedChatSummary.id)}
                        <MenuItem warning onclick={leaveGroup}>
                            {#snippet icon()}
                                <LocationExit size={$iconSize} color={"var(--menu-warn)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable
                                    resourceKey={i18nKey(
                                        "leaveGroup",
                                        undefined,
                                        selectedChatSummary.level,
                                        true,
                                    )} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if canConvert}
                        <MenuItem warning onclick={convertToCommunity}>
                            {#snippet icon()}
                                <ConvertToCommunity size={$iconSize} color={"var(--menu-warn)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("communities.convert")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if canImportToCommunity}
                        <MenuItem warning onclick={importToCommunity}>
                            {#snippet icon()}
                                <Import size={$iconSize} color={"var(--menu-warn)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("communities.import")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                {/if}
                {#if selectedChatSummary.kind === "direct_chat" && !isBot}
                    {#if hasPinned}
                        <MenuItem onclick={showPinned}>
                            {#snippet icon()}
                                <Pin size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("showPinned")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if notificationsSupported}
                        {#if selectedChatSummary.membership.notificationsMuted === true}
                            <MenuItem onclick={() => toggleMuteNotifications(false, undefined)}>
                                {#snippet icon()}
                                    <Bell size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("unmuteNotifications")} />
                                {/snippet}
                            </MenuItem>
                        {:else}
                            <MenuItem onclick={() => toggleMuteNotifications(true, undefined)}>
                                {#snippet icon()}
                                    <BellOff size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("muteNotifications")} />
                                {/snippet}
                            </MenuItem>
                        {/if}
                    {/if}
                    {#if blocked}
                        <MenuItem onclick={unblockUser}>
                            {#snippet icon()}
                                <CancelIcon size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("unblockUser")} />
                            {/snippet}
                        </MenuItem>
                    {:else}
                        <MenuItem onclick={blockUser}>
                            {#snippet icon()}
                                <CancelIcon size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("blockUser")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if $platformModeratorStore}
                        {#if isSuspended}
                            <MenuItem onclick={unsuspendUser}>
                                {#snippet icon()}
                                    <TickIcon size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("unsuspendUser")} />
                                {/snippet}
                            </MenuItem>
                        {:else}
                            <MenuItem onclick={onSuspendUser}>
                                {#snippet icon()}
                                    <CancelIcon
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("suspendUser")} />
                                {/snippet}
                            </MenuItem>
                        {/if}
                    {/if}
                {/if}
                {#if botIdToUninstall !== undefined}
                    <MenuItem onclick={() => removeBot(botIdToUninstall)}>
                        {#snippet icon()}
                            <DeleteOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <Translatable resourceKey={i18nKey("bots.manage.remove")} />
                        {/snippet}
                    </MenuItem>
                {/if}
            </Menu>
        {/snippet}
    </MenuIcon>
</div>

<style lang="scss">
    .menu {
        flex: 0 0 20px;
    }

    $dot-size: 9px;

    .pin {
        position: relative;
        display: grid;
        align-content: center;

        &.unread::after {
            content: "";
            width: $dot-size;
            height: $dot-size;
            background-color: var(--accent);
            border-radius: 50%;
            position: absolute;
            bottom: -$sp2;
            right: -$sp2;
        }

        &.unread.rtl::after {
            left: -$sp2;
            right: auto;
        }
    }
</style>

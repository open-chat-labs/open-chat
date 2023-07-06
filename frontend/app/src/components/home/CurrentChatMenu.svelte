<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import TickIcon from "svelte-material-icons/Check.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import ConvertToCommunity from "../icons/ConvertToCommunity.svelte";
    import FilterOutline from "svelte-material-icons/FilterOutline.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { _ } from "svelte-i18n";
    import type { AccessRules, ChatSummary, GroupChatSummary, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { notificationsSupported } from "../../utils/notifications";
    import { toastStore } from "../../stores/toast";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { rightPanelHistory } from "../../stores/rightPanel";
    import { rtlStore } from "../../stores/rtl";
    import { communitiesEnabled } from "../../utils/features";
    import HeartMinus from "../icons/HeartMinus.svelte";
    import HeartPlus from "../icons/HeartPlus.svelte";
    import { interpolateLevel } from "../../utils/i18n";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let selectedChatSummary: ChatSummary;
    export let blocked: boolean;
    export let showSuspendUserModal = false;
    export let hasPinned: boolean;
    export let unreadMessages: number;

    $: favouritesStore = client.favouritesStore;
    $: messagesRead = client.messagesRead;
    $: isProposalGroup = client.isProposalGroup;
    $: userId = selectedChatSummary.kind === "direct_chat" ? selectedChatSummary.them.userId : "";
    $: userStore = client.userStore;
    $: isBot = $userStore[userId]?.kind === "bot";
    $: isSuspended = $userStore[userId]?.suspended ?? false;
    $: lastState = $rightPanelHistory[$rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: groupDetailsSelected = lastState.kind === "group_details";
    $: pinnedSelected = lastState.kind === "show_pinned";
    $: membersSelected = lastState.kind === "show_group_members";
    $: inviteMembersSelected = lastState.kind === "invite_group_users";
    $: desktop = !$mobileWidth;
    $: canConvert =
        selectedChatSummary.kind === "group_chat" &&
        client.canConvertGroupToCommunity(selectedChatSummary.id);

    let hasUnreadPinned = false;

    $: {
        setUnreadPinned(hasPinned, selectedChatSummary);
    }

    onMount(() => {
        return messagesRead.subscribe(() => setUnreadPinned(hasPinned, selectedChatSummary));
    });

    function setUnreadPinned(hasPinned: boolean, chat: ChatSummary) {
        hasUnreadPinned =
            hasPinned &&
            (chat.kind === "group_chat" || chat.kind === "channel") &&
            client.unreadPinned(chat.id, chat.dateLastPinned);
    }

    function toggleMuteNotifications(mute: boolean) {
        dispatch("toggleMuteNotifications", { chatId: selectedChatSummary.id, mute });
    }

    function addToFavourites() {
        client.addToFavourites(selectedChatSummary.id);
    }

    function removeFromFavourites() {
        client.removeFromFavourites(selectedChatSummary.id);
    }

    function showGroupDetails() {
        dispatch("showGroupDetails");
    }

    function showPinned() {
        dispatch("showPinned");
    }

    function searchChat() {
        dispatch("searchChat", "");
    }

    function showProposalFilters() {
        dispatch("showProposalFilters");
    }

    function showGroupMembers() {
        dispatch("showGroupMembers", true);
    }

    function markAllRead() {
        dispatch("markAllRead");
    }

    function blockUser() {
        if (selectedChatSummary.kind === "direct_chat") {
            dispatch("blockUser", { userId: selectedChatSummary.them });
        }
    }

    function unblockUser() {
        if (selectedChatSummary.kind === "direct_chat") {
            dispatch("unblockUser", { userId: selectedChatSummary.them });
        }
    }

    function showInviteGroupUsers() {
        dispatch("showInviteGroupUsers", true);
    }

    function leaveGroup() {
        if (selectedChatSummary.kind === "direct_chat") return;
        dispatch("leaveGroup", {
            kind: "leave",
            chatId: selectedChatSummary.id,
            level: selectedChatSummary.level,
        });
    }

    function convertToCommunity() {
        if (selectedChatSummary.kind === "group_chat" && selectedChatSummary.public) {
            dispatch("convertGroupToCommunity", selectedChatSummary);
        }
    }

    function freezeGroup() {
        if (selectedChatSummary.id.kind === "group_chat") {
            client.freezeGroup(selectedChatSummary.id, undefined).then((success) => {
                if (!success) {
                    toastStore.showFailureToast("failedToFreezeGroup");
                }
            });
        }
    }

    function unfreezeGroup() {
        if (selectedChatSummary.id.kind === "group_chat") {
            client.unfreezeGroup(selectedChatSummary.id).then((success) => {
                if (!success) {
                    toastStore.showFailureToast("failedToUnfreezeGroup");
                }
            });
        }
    }

    function onSuspendUser() {
        showSuspendUserModal = true;
    }

    function unsuspendUser() {
        client.unsuspendUser(userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast("unsuspendedUser");
            } else {
                toastStore.showFailureToast("failedToUnsuspendUser");
            }
        });
    }
</script>

{#if desktop}
    {#if $isProposalGroup}
        <span on:click={showProposalFilters}>
            <HoverIcon>
                <FilterOutline size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    {/if}
    <span on:click={searchChat}>
        <HoverIcon title={$_("searchChat")}>
            <Magnify size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>

    {#if hasPinned}
        <span on:click={showPinned}>
            <HoverIcon title={$_("showPinned")}>
                <div
                    class="pin"
                    class:unread={!pinnedSelected && hasUnreadPinned}
                    class:rtl={$rtlStore}>
                    <Pin
                        size={$iconSize}
                        color={pinnedSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
                </div>
            </HoverIcon>
        </span>
    {/if}

    {#if selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel"}
        <span on:click={showGroupDetails}>
            <HoverIcon title={interpolateLevel("groupDetails", selectedChatSummary.level)}>
                <FileDocument
                    size={$iconSize}
                    color={groupDetailsSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        </span>
        <span on:click={showGroupMembers}>
            <HoverIcon title={$_("members")}>
                <AccountMultiple
                    size={$iconSize}
                    color={membersSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        </span>
        {#if client.canInviteUsers(selectedChatSummary.id)}
            <span on:click={showInviteGroupUsers}>
                <HoverIcon title={$_("group.inviteUsers")}>
                    <AccountMultiplePlus
                        size={$iconSize}
                        color={inviteMembersSelected
                            ? "var(--icon-selected)"
                            : "var(--icon-txt)"} />
                </HoverIcon>
            </span>
        {/if}
    {/if}
{/if}
<div class="menu">
    <MenuIcon position={"bottom"} align={"end"}>
        <div slot="icon">
            <HoverIcon>
                <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
        <div slot="menu">
            <Menu>
                {#if $communitiesEnabled}
                    {#if !$favouritesStore.has(selectedChatSummary.id)}
                        <MenuItem on:click={addToFavourites}>
                            <HeartPlus size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                            <div slot="text">
                                {$_("communities.addToFavourites")}
                            </div>
                        </MenuItem>
                    {:else}
                        <MenuItem on:click={removeFromFavourites}>
                            <HeartMinus size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                            <div slot="text">
                                {$_("communities.removeFromFavourites")}
                            </div>
                        </MenuItem>
                    {/if}
                {/if}
                {#if $mobileWidth}
                    {#if $isProposalGroup}
                        <MenuItem on:click={showProposalFilters}>
                            <FilterOutline
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("proposal.filter")}</div>
                        </MenuItem>
                    {/if}
                    <MenuItem on:click={searchChat}>
                        <Magnify size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <div slot="text">{$_("searchChat")}</div>
                    </MenuItem>
                {/if}
                {#if selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel"}
                    {#if $mobileWidth}
                        {#if hasPinned}
                            <MenuItem on:click={showPinned}>
                                <Pin
                                    size={$iconSize}
                                    color={hasUnreadPinned
                                        ? "var(--icon-selected)"
                                        : "var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("showPinned")}</div>
                            </MenuItem>
                        {/if}
                        <MenuItem on:click={showGroupDetails}>
                            <FileDocument
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                {interpolateLevel("groupDetails", selectedChatSummary.level)}
                            </div>
                        </MenuItem>
                        <MenuItem on:click={showGroupMembers}>
                            <AccountMultiple
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("members")}</div>
                        </MenuItem>
                        {#if client.canInviteUsers(selectedChatSummary.id)}
                            <MenuItem on:click={showInviteGroupUsers}>
                                <AccountMultiplePlus
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("group.inviteUsers")}</div>
                            </MenuItem>
                        {/if}
                    {/if}

                    {#if notificationsSupported}
                        {#if selectedChatSummary.membership.notificationsMuted === true}
                            <MenuItem on:click={() => toggleMuteNotifications(false)}>
                                <Bell
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("unmuteNotifications")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem on:click={() => toggleMuteNotifications(true)}>
                                <BellOff
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("muteNotifications")}</div>
                            </MenuItem>
                        {/if}
                    {/if}
                    <MenuItem disabled={unreadMessages === 0} on:click={markAllRead}>
                        <CheckboxMultipleMarked
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">{$_("markAllRead")}</div>
                    </MenuItem>

                    {#if client.user.isPlatformModerator}
                        {#if client.isFrozen(selectedChatSummary.id)}
                            <MenuItem warning on:click={unfreezeGroup}>
                                <TickIcon size={$iconSize} color={"var(--menu-warn"} slot="icon" />
                                <div slot="text">{$_("unfreezeGroup")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem warning on:click={freezeGroup}>
                                <CancelIcon
                                    size={$iconSize}
                                    color={"var(--menu-warn"}
                                    slot="icon" />
                                <div slot="text">{$_("freezeGroup")}</div>
                            </MenuItem>
                        {/if}
                    {/if}

                    {#if client.canLeaveGroup(selectedChatSummary.id)}
                        <MenuItem warning on:click={leaveGroup}>
                            <LocationExit size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                            <div slot="text">
                                {interpolateLevel("leaveGroup", selectedChatSummary.level, true)}
                            </div>
                        </MenuItem>
                    {/if}
                    {#if $communitiesEnabled && canConvert}
                        <MenuItem warning on:click={convertToCommunity}>
                            <ConvertToCommunity
                                size={$iconSize}
                                color={"var(--menu-warn)"}
                                slot="icon" />
                            <div slot="text">{$_("communities.convert")}</div>
                        </MenuItem>
                    {/if}
                {/if}
                {#if selectedChatSummary.kind === "direct_chat" && !isBot}
                    {#if hasPinned}
                        <MenuItem on:click={showPinned}>
                            <Pin size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                            <div slot="text">{$_("showPinned")}</div>
                        </MenuItem>
                    {/if}
                    {#if notificationsSupported}
                        {#if selectedChatSummary.membership.notificationsMuted === true}
                            <MenuItem on:click={() => toggleMuteNotifications(false)}>
                                <Bell
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("unmuteNotifications")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem on:click={() => toggleMuteNotifications(true)}>
                                <BellOff
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("muteNotifications")}</div>
                            </MenuItem>
                        {/if}
                    {/if}
                    <MenuItem disabled={unreadMessages === 0} on:click={markAllRead}>
                        <CheckboxMultipleMarked
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">{$_("markAllRead")}</div>
                    </MenuItem>

                    {#if blocked}
                        <MenuItem on:click={unblockUser}>
                            <CancelIcon
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("unblockUser")}</div>
                        </MenuItem>
                    {:else}
                        <MenuItem on:click={blockUser}>
                            <CancelIcon
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("blockUser")}</div>
                        </MenuItem>
                    {/if}
                    {#if client.user.isPlatformModerator}
                        {#if isSuspended}
                            <MenuItem on:click={unsuspendUser}>
                                <TickIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("unsuspendUser")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem on:click={onSuspendUser}>
                                <CancelIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("suspendUser")}</div>
                            </MenuItem>
                        {/if}
                    {/if}
                {/if}
            </Menu>
        </div>
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

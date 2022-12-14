<script lang="ts">
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import TickIcon from "svelte-material-icons/Check.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
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
    import type { ChatSummary, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { notificationsSupported } from "../../utils/notifications";
    import { toastStore } from "../../stores/toast";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { rightPanelHistory } from "../../stores/rightPanel";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let selectedChatSummary: ChatSummary;
    export let blocked: boolean;
    export let showSuspendUserModal = false;
    export let hasPinned: boolean;
    export let unreadMessages: number;

    $: isProposalGroup = client.isProposalGroup;
    $: userId = selectedChatSummary.kind === "direct_chat" ? selectedChatSummary.them : "";
    $: userStore = client.userStore;
    $: isBot = $userStore[userId]?.kind === "bot";
    $: isSuspended = $userStore[userId]?.suspended ?? false;
    $: lastState = $rightPanelHistory[$rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: groupDetailsSelected = lastState.kind === "group_details";
    $: membersSelected = lastState.kind === "show_members";
    $: addMembersSelected = lastState.kind === "add_members";
    $: desktop = !$mobileWidth;

    function toggleMuteNotifications(mute: boolean) {
        dispatch("toggleMuteNotifications", { chatId: selectedChatSummary.chatId, mute });
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

    function showMembers() {
        dispatch("showMembers");
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

    function addMembers() {
        dispatch("addMembers");
    }

    function leaveGroup() {
        dispatch("leaveGroup", { kind: "leave", chatId: selectedChatSummary.chatId });
    }

    function freezeGroup() {
        client.freezeGroup(selectedChatSummary.chatId, undefined).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToFreezeGroup");
            }
        });
    }

    function unfreezeGroup() {
        client.unfreezeGroup(selectedChatSummary.chatId).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToUnfreezeGroup");
            }
        });
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
        <HoverIcon on:click={showProposalFilters}>
            <FilterOutline size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    {/if}
    <HoverIcon on:click={searchChat}>
        <Magnify size={$iconSize} color={"var(--icon-txt)"} />
    </HoverIcon>

    {#if selectedChatSummary.kind === "group_chat"}
        <HoverIcon title={$_("groupDetails")} on:click={showGroupDetails}>
            <FileDocument
                size={$iconSize}
                color={groupDetailsSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </HoverIcon>
        <HoverIcon title={$_("members")} on:click={showMembers}>
            <AccountMultiple
                size={$iconSize}
                color={membersSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </HoverIcon>
        {#if client.canAddMembers(selectedChatSummary.chatId)}
            <HoverIcon title={$_("addMembers")} on:click={addMembers}>
                <AccountMultiplePlus
                    size={$iconSize}
                    color={addMembersSelected ? "var(--icon-selected)" : "var(--icon-txt)"} />
            </HoverIcon>
        {/if}
    {/if}
{/if}
<div class="menu">
    <MenuIcon>
        <div slot="icon">
            <HoverIcon>
                <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
        <div slot="menu">
            <Menu>
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
                {#if selectedChatSummary.kind === "group_chat"}
                    {#if $mobileWidth}
                        <MenuItem on:click={showGroupDetails}>
                            <FileDocument
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("groupDetails")}</div>
                        </MenuItem>
                        <MenuItem on:click={showMembers}>
                            <AccountMultiple
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("members")}</div>
                        </MenuItem>
                        {#if client.canAddMembers(selectedChatSummary.chatId)}
                            <MenuItem on:click={addMembers}>
                                <AccountMultiplePlus
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("addMembers")}</div>
                            </MenuItem>
                        {/if}
                    {/if}

                    {#if hasPinned}
                        <MenuItem on:click={showPinned}>
                            <Pin size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                            <div slot="text">{$_("showPinned")}</div>
                        </MenuItem>
                    {/if}
                    {#if notificationsSupported}
                        {#if selectedChatSummary.notificationsMuted === true}
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

                    {#if client.user.isSuperAdmin}
                        {#if client.isFrozen(selectedChatSummary.chatId)}
                            <MenuItem on:click={unfreezeGroup}>
                                <TickIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("unfreezeGroup")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem on:click={freezeGroup}>
                                <CancelIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("freezeGroup")}</div>
                            </MenuItem>
                        {/if}
                    {/if}

                    {#if client.canLeaveGroup(selectedChatSummary.chatId)}
                        <MenuItem warning on:click={leaveGroup}>
                            <LocationExit
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("leaveGroup")}</div>
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
                        {#if selectedChatSummary.notificationsMuted === true}
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
                    {#if client.user.isSuperAdmin}
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

<style type="text/scss">
    .menu {
        flex: 0 0 20px;
    }
</style>

<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import DeleteAlertOutline from "svelte-material-icons/DeleteAlertOutline.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { ChatSummary, GroupChatSummary } from "../../domain/chat/chat";
    import Typing from "../Typing.svelte";
    import { typing } from "../../stores/typing";
    import { userStore } from "../../stores/user";
    import type { Writable } from "svelte/store";
    import { toastStore } from "../../stores/toast";
    import Link from "../Link.svelte";
    import { supported as notificationsSupported } from "../../utils/notifications";
    import { iconSize } from "../../stores/iconSize";
    import { now } from "../../stores/now";

    const dispatch = createEventDispatcher();

    export let selectedChatSummary: Writable<ChatSummary>;
    export let blocked: boolean;
    export let unreadMessages: number;

    let supportsNotifications = notificationsSupported();

    $: isGroup = $selectedChatSummary.kind === "group_chat";

    function clearSelection() {
        dispatch("clearSelection");
    }

    function toggleMuteNotifications() {
        dispatch("toggleMuteNotifications");
    }

    function markAllRead() {
        dispatch("markAllRead");
    }

    function deleteGroup() {
        dispatch("deleteGroup");
    }

    function blockUser() {
        if ($selectedChatSummary.kind === "direct_chat") {
            dispatch("blockUser", { userId: $selectedChatSummary.them });
        }
    }

    function unblockUser() {
        if ($selectedChatSummary.kind === "direct_chat") {
            dispatch("unblockUser", { userId: $selectedChatSummary.them });
        }
    }

    function showGroupDetails() {
        if ($selectedChatSummary.kind === "group_chat") {
            dispatch("showGroupDetails");
        }
    }

    function showParticipants() {
        if ($selectedChatSummary.kind === "group_chat") {
            dispatch("showParticipants");
        }
    }

    function addParticipants() {
        if ($selectedChatSummary.kind === "group_chat") {
            dispatch("addParticipants");
        }
    }

    function leaveGroup() {
        if ($selectedChatSummary.kind === "group_chat") {
            if ($selectedChatSummary.myRole === "owner") {
                toastStore.showFailureToast("ownerCantLeave");
            } else {
                dispatch("leaveGroup", $selectedChatSummary.chatId);
            }
        }
    }

    function formatLastOnlineDate(now: number, lastOnline: number | undefined): string {
        if (lastOnline === undefined) {
            return "";
        }

        const secondsSinceLastOnline = (now - lastOnline) / 1000;

        const minutesSinceLastOnline = Math.floor(secondsSinceLastOnline / 60);

        if (minutesSinceLastOnline < 2) {
            return $_("onlineNow");
        }

        let durationText: string;
        if (minutesSinceLastOnline < 60) {
            durationText = $_("durationMins", { values: { duration: minutesSinceLastOnline } });
        } else {
            const hoursSinceLastOnline = Math.floor(minutesSinceLastOnline / 60);
            if (hoursSinceLastOnline === 1) {
                durationText = $_("oneHour");
            } else if (hoursSinceLastOnline < 24) {
                durationText = $_("durationHours", { values: { duration: hoursSinceLastOnline } });
            } else {
                const daysSinceLastOnline = Math.floor(hoursSinceLastOnline / 24);
                durationText =
                    daysSinceLastOnline === 1
                        ? $_("oneDay")
                        : $_("durationDays", { values: { duration: daysSinceLastOnline } });
            }
        }
        return $_("lastOnline", { values: { duration: durationText } });
    }

    function normaliseChatSummary(chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus($now, $userStore, chatSummary.them),
                subtext: formatLastOnlineDate($now, $userStore[chatSummary.them]?.lastOnline),
                typing: $typing[chatSummary.chatId]?.has(chatSummary.them),
            };
        }
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: getAvatarUrl(chatSummary, "../assets/group.svg"),
            subtext: chatSummary.public
                ? $_("publicGroupWithN", { values: { number: chatSummary.participantCount } })
                : $_("privateGroupWithN", { values: { number: chatSummary.participantCount } }),
            typing: false,
        };
    }

    function canAddParticipants(chat: GroupChatSummary): boolean {
        return chat.public || chat.myRole === "admin" || chat.myRole === "owner";
    }

    $: chat = normaliseChatSummary($selectedChatSummary);
</script>

<SectionHeader shadow={true} flush={true}>
    {#if $screenWidth === ScreenWidth.ExtraSmall}
        <div class="back" class:rtl={$rtlStore} on:click={clearSelection}>
            <HoverIcon>
                {#if $rtlStore}
                    <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                {:else}
                    <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                {/if}
            </HoverIcon>
        </div>
    {/if}
    <div class="avatar">
        <Avatar
            statusBorder={"var(--section-bg)"}
            {blocked}
            status={chat.userStatus}
            url={chat.avatarUrl}
            size={AvatarSize.Small} />
    </div>
    <div class="chat-details">
        <div class="chat-name" title={chat.name}>
            {#if isGroup}
                <span on:click={showGroupDetails} class="group-details">
                    {chat.name}
                </span>
            {:else}
                {chat.name}
            {/if}
        </div>
        <div class="chat-subtext" title={chat.subtext}>
            {#if blocked}
                {$_("blocked")}
            {:else if chat.typing}
                <Typing />
            {:else if isGroup}
                <Link on:click={showParticipants}>
                    {chat.subtext}
                </Link>
            {:else}
                {chat.subtext}
            {/if}
        </div>
    </div>
    <div class="menu">
        <MenuIcon>
            <div slot="icon">
                <HoverIcon>
                    <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
            <div slot="menu">
                <Menu>
                    {#if $selectedChatSummary.kind === "direct_chat"}
                        {#if blocked}
                            <MenuItem on:click={unblockUser}>
                                <Cancel size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("unblockUser")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem on:click={blockUser}>
                                <Cancel size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("blockUser")}</div>
                            </MenuItem>
                        {/if}
                    {:else if $selectedChatSummary.kind === "group_chat"}
                        {#if $selectedChatSummary.myRole === "owner"}
                            <MenuItem on:click={deleteGroup}>
                                <DeleteAlertOutline
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("deleteGroup")}</div>
                            </MenuItem>
                        {/if}
                        <MenuItem on:click={showGroupDetails}>
                            <AccountMultiplePlus
                                size={$iconSize}
                                color={"var(--icon-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("groupDetails")}</div>
                        </MenuItem>
                        <MenuItem on:click={leaveGroup}>
                            <LocationExit size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                            <div slot="text">{$_("leaveGroup")}</div>
                        </MenuItem>
                        <MenuItem on:click={showParticipants}>
                            <AccountMultiplePlus
                                size={$iconSize}
                                color={"var(--icon-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("participants")}</div>
                        </MenuItem>
                        {#if canAddParticipants($selectedChatSummary)}
                            <MenuItem on:click={addParticipants}>
                                <AccountPlusOutline
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("addParticipants")}</div>
                            </MenuItem>
                        {/if}
                    {/if}
                    {#if supportsNotifications}
                        {#if $selectedChatSummary.notificationsMuted === true}
                            <MenuItem on:click={toggleMuteNotifications}>
                                <Bell size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("unmuteNotifications")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem on:click={toggleMuteNotifications}>
                                <BellOff size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("muteNotifications")}</div>
                            </MenuItem>
                        {/if}
                    {/if}
                    {#if unreadMessages > 0}
                        <MenuItem on:click={markAllRead}>
                            <CheckboxMultipleMarked
                                size={$iconSize}
                                color={"var(--icon-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("markAllRead")}</div>
                        </MenuItem>
                    {:else}
                        <MenuItem disabled={true}>
                            <CheckboxMultipleMarked
                                size={$iconSize}
                                color={"var(--icon-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("markAllRead")}</div>
                        </MenuItem>
                    {/if}
                </Menu>
            </div>
        </MenuIcon>
    </div>
</SectionHeader>

<style type="text/scss">
    .chat-name {
        @include font(book, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp1;
    }

    .chat-subtext {
        @include font(light, normal, fs-100);
        @include ellipsis();
    }

    .avatar {
        flex: 0 0 55px;
    }

    .group-details {
        cursor: pointer;
    }

    .chat-details {
        flex: 1;
        overflow: auto;
    }

    .menu {
        flex: 0 0 20px;
    }

    .back {
        flex: 0 0 10px;
        margin-right: 5px;

        &.rtl {
            margin-right: 0;
            margin-left: 5px;
        }
    }
</style>

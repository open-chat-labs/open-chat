<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserSummary } from "../../domain/user/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import { toastStore } from "../../stores/toast";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { ChatSummary, GroupChatSummary } from "../../domain/chat/chat";
    import { getParticipantsString } from "../../domain/chat/chat.utils";
    import Typing from "../Typing.svelte";
    import { typing } from "../../stores/typing";
    import { userStore } from "../../stores/user";
    const dispatch = createEventDispatcher();

    export let selectedChatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let blocked: boolean;

    $: isGroup = selectedChatSummary.kind === "group_chat";

    function clearSelection() {
        dispatch("clearSelection");
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

    function showGroupDetails() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("showGroupDetails");
        }
    }

    function showParticipants() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("showParticipants");
        }
    }

    function addParticipants() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("addParticipants");
        }
    }

    function copyCode() {
        if (selectedChatSummary.kind === "group_chat") {
            console.log("copy the group chat invite code to the clipboard");
            toastStore.showSuccessToast("inviteCodeCopied");
        }
    }

    function leaveGroup() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("leaveGroup", selectedChatSummary.chatId);
        }
    }

    function formatLastOnlineDate(secondsSinceLastOnline: number): string {
        if (isNaN(secondsSinceLastOnline)) {
            return "";
        }
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
                userStatus: getUserStatus($userStore, chatSummary.them),
                subtext: formatLastOnlineDate($userStore[chatSummary.them]?.secondsSinceLastOnline),
                typing: $typing[chatSummary.chatId]?.has(chatSummary.them),
            };
        }
        const participantIds = chatSummary.participants.map((p) => p.userId);
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: getAvatarUrl(chatSummary, "../assets/group.svg"),
            subtext: getParticipantsString(
                user!,
                $userStore,
                participantIds,
                $_("unknownUser"),
                $_("you")
            ),
            typing: false,
        };
    }

    function canAdminister(chat: GroupChatSummary): boolean {
        return (
            chat.public ||
            chat.participants.find((p) => p.userId === user!.userId)?.role === "admin"
        );
    }

    $: chat = normaliseChatSummary(selectedChatSummary);

    // for direct chats we want to either show when the user was last online or if they are typing
    // for group chats we also show if any participants are typing (they all get listed)
    // if no one is typing we check how many users there are. If > 5 we just say n members (m online)
    // if 5 or fewer, we list the usernames sorted by online status
</script>

<SectionHeader flush={true}>
    {#if $screenWidth === ScreenWidth.ExtraSmall}
        <div class="back" class:rtl={$rtlStore} on:click={clearSelection}>
            <HoverIcon>
                {#if $rtlStore}
                    <ArrowRight size={"1.2em"} color={"#aaa"} />
                {:else}
                    <ArrowLeft size={"1.2em"} color={"#aaa"} />
                {/if}
            </HoverIcon>
        </div>
    {/if}
    <div class="avatar">
        <Avatar status={chat.userStatus} url={chat.avatarUrl} size={AvatarSize.Small} />
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
            {#if chat.typing}
                <Typing />
            {:else}
                {chat.subtext}
            {/if}
        </div>
    </div>
    <div class="menu">
        <MenuIcon>
            <div slot="icon">
                <HoverIcon>
                    <DotsVertical size={"1.2em"} color={"#aaa"} />
                </HoverIcon>
            </div>
            <div slot="menu">
                {#if selectedChatSummary.kind === "direct_chat"}
                    {#if blocked}
                        <Menu>
                            <MenuItem on:click={unblockUser}>
                                <Cancel size={"1.2em"} color={"#aaa"} slot="icon" />
                                <div slot="text">{$_("unblockUser")}</div>
                            </MenuItem>
                        </Menu>
                    {:else}
                        <Menu>
                            <MenuItem on:click={blockUser}>
                                <Cancel size={"1.2em"} color={"#aaa"} slot="icon" />
                                <div slot="text">{$_("blockUser")}</div>
                            </MenuItem>
                        </Menu>
                    {/if}
                {:else if selectedChatSummary.kind === "group_chat"}
                    <Menu>
                        <MenuItem on:click={showGroupDetails}>
                            <AccountMultiplePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("groupDetails")}</div>
                        </MenuItem>
                        <MenuItem on:click={leaveGroup}>
                            <LocationExit size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("leaveGroup")}</div>
                        </MenuItem>
                        <MenuItem on:click={copyCode}>
                            <ContentCopy size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("copyInviteCode")}</div>
                        </MenuItem>
                        <MenuItem on:click={showParticipants}>
                            <AccountMultiplePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("participants")}</div>
                        </MenuItem>
                        {#if canAdminister(selectedChatSummary)}
                            <MenuItem on:click={addParticipants}>
                                <AccountPlusOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                                <div slot="text">{$_("addParticipants")}</div>
                            </MenuItem>
                        {/if}
                    </Menu>
                {/if}
            </div>
        </MenuIcon>
    </div>
</SectionHeader>

<style type="text/scss">
    .chat-name {
        @include font(bold, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp2;
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

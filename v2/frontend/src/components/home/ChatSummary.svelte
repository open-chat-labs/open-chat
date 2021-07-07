<script lang="ts">
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import { AvatarSize, avatarUrl as getAvatarUrl, UserStatus } from "../../domain/user";
    import type { UserLookup } from "../../domain/user";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import { formatMessageDate } from "../../utils/date";
    import { _ } from "svelte-i18n";
    import { getContentAsText } from "../../domain/chat";
    import type { ChatSummary, DirectChatSummary } from "../../domain/chat";

    export let users: UserLookup;
    export let chatSummary: ChatSummary;
    export let selected: boolean;

    function getUnreadMessages({ lastestMessageId, lastReadByUs }: ChatSummary): number {
        return lastestMessageId - lastReadByUs;
    }

    function getUserStatus({ them }: DirectChatSummary): UserStatus {
        return (users[them]?.secondsSinceLastOnline ?? Number.MAX_VALUE) < 120
            ? UserStatus.Online
            : UserStatus.Offline;
    }

    function latestMessageText({ latestMessage }: ChatSummary): string {
        return latestMessage ? getContentAsText(latestMessage.content) : "";
    }

    function normaliseChatSummary(chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: users[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl(chatSummary.them),
                userStatus: getUserStatus(chatSummary),
            };
        }
        return {
            name: chatSummary.subject,
            userStatus: UserStatus.None,
            avatarUrl: "assets/group.svg",
        };
    }

    const { name, userStatus, avatarUrl } = normaliseChatSummary(chatSummary);
    const lastMessage = latestMessageText(chatSummary);
    const unreadMessages = getUnreadMessages(chatSummary);
</script>

<a role="button" class="chat-summary" class:selected href={`/#/${chatSummary.chatId}`}>
    <div class="avatar">
        <Avatar url={avatarUrl} status={userStatus} size={AvatarSize.Small} />
    </div>
    <div class="details">
        <div class="name-date">
            <h4 class="chat-name">{name}</h4>
            <!-- this date formatting is OK for now but we might want to use something like this: 
            https://date-fns.org/v2.22.1/docs/formatDistanceToNow -->
            <p class="chat-date">{formatMessageDate(new Date(Number(chatSummary.displayDate)))}</p>
        </div>
        <div class="chat-msg">{lastMessage}</div>
        {#if unreadMessages > 0}
            <div
                title={$_("chatSummary.unread", { values: { count: unreadMessages.toString() } })}
                class="unread-msgs">
                {unreadMessages > 9 ? "9+" : unreadMessages}
            </div>
        {/if}
    </div>
    {#if $rtlStore}
        <div class="icon rtl"><ChevronLeft /></div>
    {:else}
        <div class="icon"><ChevronRight /></div>
    {/if}
</a>

<style type="text/scss">
    .chat-summary {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: $sp3;
        margin-bottom: $sp3;
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        position: relative;

        &.selected::before {
            content: "";
            position: absolute;
            left: 0;
            height: 100%;
            width: $sp2;
            background-color: var(--chatSummary-bd-selected);
        }

        &:hover,
        &.selected {
            background-color: var(--chatSummary-hv);

            .icon {
                opacity: 1;
            }
        }
    }
    .avatar {
        flex: 0 0 55px;
    }
    .details {
        flex: 1;
        padding: 0 $sp2;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: $sp7;
        overflow: hidden;

        .name-date {
            display: flex;
            .chat-name {
                color: var(--theme-box-text);
                @include ellipsis();
                flex: auto;
            }
            .chat-date {
                @include font(light, normal, fs-70);
                color: var(--chatSummary-txt2);
            }
        }

        .chat-msg {
            @include ellipsis();
            @include font(light, normal, fs-70);
            color: var(--chatSummary-txt2);
        }
    }

    .icon {
        position: absolute;
        top: calc(50% - 8px);
        opacity: 0;
        transition: opactity ease-in-out 300ms;
        color: var(--button-bg);
        &:not(.rtl) {
            right: $sp3;
        }
        &.rtl {
            left: $sp3;
        }
    }

    .unread-msgs {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: hotpink;
        text-shadow: 1px 1px 1px rgba(150, 50, 50, 0.8);
        border-radius: 50%;
        font-weight: bold;
        font-size: 10px;
        color: #ffffff;
        position: absolute;
        width: 18px;
        height: 18px;
        bottom: 5px;
        left: 35px;
    }
</style>

<script lang="ts">
    import type { ChatSummary, EventWrapper, Message } from "../../../domain/chat/chat";
    import { AvatarSize, UserStatus } from "../../../domain/user/user";
    import Avatar from "../../Avatar.svelte";
    import { userStore } from "../../../stores/user";
    import { iconSize } from "../../../stores/iconSize";
    import { now } from "../../../stores/time";
    import { _ } from "svelte-i18n";
    import { TypersByChat, typing } from "../../../stores/typing";
    import Typing from "../../Typing.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { createEventDispatcher } from "svelte";
    import { getContentAsText, getTypingString } from "../../../domain/chat/chat.utils";
    import { getUserStatus, groupAvatarUrl, userAvatarUrl } from "domain/user/user.utils";

    export let chatSummary: ChatSummary;
    export let rootEvent: EventWrapper<Message>;

    const dispatch = createEventDispatcher();

    $: chat = normaliseChatSummary($now, chatSummary, $typing);

    function close() {
        dispatch("close");
    }

    function normaliseChatSummary(now: number, chatSummary: ChatSummary, typing: TypersByChat) {
        const subtext =
            getTypingString($userStore, chatSummary, typing) ||
            `${$_("thread.title")}: ${getContentAsText(rootEvent.event.content)}`;
        const someoneTyping = getTypingString($userStore, chatSummary, typing);
        if (chatSummary.kind === "direct_chat") {
            return {
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: userAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus(now, $userStore, chatSummary.them),
                subtext,
                typing: someoneTyping,
            };
        }
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: groupAvatarUrl(chatSummary),
            subtext,
            typing: someoneTyping,
        };
    }
</script>

<SectionHeader flush={true} shadow={true}>
    <div class="avatar">
        <Avatar
            statusBorder={"var(--section-bg)"}
            status={chat.userStatus}
            url={chat.avatarUrl}
            size={AvatarSize.Small} />
    </div>
    <div class="chat-details">
        <div class="chat-name" title={chat.name}>
            {chat.name}
        </div>
        <div class="chat-subtext" title={chat.subtext}>
            {#if chat.typing}
                {chat.typing} <Typing />
            {:else}
                {chat.subtext}
            {/if}
        </div>
    </div>
    <div title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
</SectionHeader>

<style type="text/scss">
    .chat-name {
        @include font(book, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp1;
    }

    .chat-subtext {
        @include font(book, normal, fs-80);
        @include ellipsis();
        color: var(--link-underline);
    }

    .chat-details {
        flex: 1;
        overflow: auto;
        padding: 0 $sp2;
    }

    .avatar {
        flex: 0 0 55px;
    }
</style>

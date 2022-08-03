<script lang="ts">
    import type { ChatSummary, EventWrapper, Message } from "../../../domain/chat/chat";
    import { AvatarSize, UserStatus } from "../../../domain/user/user";
    import Avatar from "../../Avatar.svelte";
    import { userStore } from "../../../stores/user";
    import { iconSize } from "../../../stores/iconSize";
    import { rtlStore } from "../../../stores/rtl";
    import { now } from "../../../stores/time";
    import { _ } from "svelte-i18n";
    import { TypersByKey, byThread } from "../../../stores/typing";
    import Typing from "../../Typing.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Markdown from "../../home/Markdown.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import { getContentAsText, getTypingString } from "../../../domain/chat/chat.utils";
    import { getUserStatus, groupAvatarUrl, userAvatarUrl } from "domain/user/user.utils";
    import { mobileWidth } from "stores/screenDimensions";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let chatSummary: ChatSummary;
    export let rootEvent: EventWrapper<Message>;
    export let pollsAllowed: boolean;
    export let threadRootMessageIndex: number;

    $: chat = normaliseChatSummary($now, chatSummary, $byThread);

    function close() {
        dispatch("closeThread", chatSummary.chatId);
    }

    function normaliseChatSummary(now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        const someoneTyping = getTypingString(
            $userStore,
            `${chatSummary.chatId}_${threadRootMessageIndex}`,
            typing
        );

        const msgTxt = getContentAsText(rootEvent.event.content);
        const subtext =
            someoneTyping ?? ($mobileWidth ? `${$_("thread.title")}: ${msgTxt}` : msgTxt);
        if (chatSummary.kind === "direct_chat") {
            return {
                title: $mobileWidth ? $userStore[chatSummary.them]?.username : $_("thread.title"),
                avatarUrl: userAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus(now, $userStore, chatSummary.them),
                subtext,
                typing: someoneTyping !== undefined,
            };
        }
        return {
            title: $mobileWidth ? chatSummary.name : $_("thread.title"),
            userStatus: UserStatus.None,
            avatarUrl: groupAvatarUrl(chatSummary),
            subtext,
            typing: someoneTyping !== undefined,
        };
    }

    function createPoll() {
        dispatch("createPoll");
    }
</script>

<SectionHeader flush={true} shadow={true}>
    <div class="close" on:click={close}>
        <HoverIcon>
            {#if $mobileWidth}
                {#if $rtlStore}
                    <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                {:else}
                    <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                {/if}
            {:else}
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </div>
    <div class="avatar">
        <Avatar
            statusBorder={"var(--section-bg)"}
            status={chat.userStatus}
            url={chat.avatarUrl}
            size={AvatarSize.Small} />
    </div>
    <div class="chat-details">
        <div class="chat-name" title={chat.title}>
            {chat.title}
        </div>
        <div class="chat-subtext" title={chat.subtext}>
            {#if chat.typing}
                {chat.subtext} <Typing />
            {:else}
                <Markdown text={chat.subtext} oneLine={true} suppressLinks={true} />
            {/if}
        </div>
    </div>
    {#if pollsAllowed}
        <div class="menu">
            <MenuIcon>
                <div slot="icon">
                    <HoverIcon>
                        <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
                <div slot="menu">
                    <Menu>
                        <MenuItem on:click={createPoll}>
                            <Poll size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                            <div slot="text">{$_("poll.create")}</div>
                        </MenuItem>
                    </Menu>
                </div>
            </MenuIcon>
        </div>
    {/if}
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

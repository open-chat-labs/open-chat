<script lang="ts">
    import type {
        ChatSummary,
        EventWrapper,
        Message,
        OpenChat,
        TypersByKey,
    } from "openchat-client";
    import { AvatarSize, UserStatus } from "openchat-client";
    import Avatar from "../../Avatar.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { rtlStore } from "../../../stores/rtl";
    import { now } from "../../../stores/time";
    import { _ } from "svelte-i18n";
    import Typing from "../../Typing.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Markdown from "../../home/Markdown.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { mobileWidth } from "stores/screenDimensions";
    import { createEventDispatcher, getContext } from "svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chatSummary: ChatSummary;
    export let rootEvent: EventWrapper<Message>;
    export let threadRootMessageIndex: number;

    $: byContext = client.typersByContext;
    $: userStore = client.userStore;
    $: chat = normaliseChatSummary($now, chatSummary, $byContext);

    function close() {
        dispatch("closeThread", chatSummary.id);
    }

    function normaliseChatSummary(now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        const someoneTyping = client.getTypingString(
            $_,
            $userStore,
            { chatId: chatSummary.id, threadRootMessageIndex },
            typing
        );

        const msgTxt = client.getContentAsText($_, rootEvent.event.content);
        const subtext =
            someoneTyping ?? ($mobileWidth ? `${$_("thread.title")}: ${msgTxt}` : msgTxt);
        if (chatSummary.kind === "direct_chat") {
            return {
                title: $mobileWidth
                    ? $userStore[chatSummary.them.userId]?.username
                    : $_("thread.title"),
                avatarUrl: client.userAvatarUrl($userStore[chatSummary.them.userId]),
                userId: chatSummary.them.userId,
                subtext,
                typing: someoneTyping !== undefined,
            };
        }
        return {
            title: $mobileWidth ? chatSummary.name : $_("thread.title"),
            userStatus: UserStatus.None,
            avatarUrl: client.groupAvatarUrl(chatSummary),
            userId: undefined,
            subtext,
            typing: someoneTyping !== undefined,
        };
    }
</script>

<SectionHeader gap={true} flush={true} shadow={true}>
    <div class="avatar">
        <Avatar
            statusBorder={"var(--section-bg)"}
            showStatus={true}
            userId={chat.userId}
            url={chat.avatarUrl}
            size={AvatarSize.Default} />
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
</SectionHeader>

<style lang="scss">
    .chat-name {
        @include font(book, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp1;
    }

    .chat-subtext {
        @include font(book, normal, fs-80);
        @include ellipsis();
        color: var(--txt-light);
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

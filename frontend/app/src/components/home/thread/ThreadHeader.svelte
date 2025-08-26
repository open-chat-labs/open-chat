<script lang="ts">
    import type {
        ChatIdentifier,
        ChatSummary,
        EventWrapper,
        Message,
        OpenChat,
        TypersByKey,
    } from "openchat-client";
    import {
        allUsersStore,
        AvatarSize,
        byContext,
        iconSize,
        mobileWidth,
        selectedCommunitySummaryStore,
        UserStatus,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { rtlStore } from "../../../stores/rtl";
    import { now } from "../../../stores/time";
    import Avatar from "../../Avatar.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Typing from "../../Typing.svelte";
    import Markdown from "../../home/Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatSummary: ChatSummary;
        rootEvent: EventWrapper<Message>;
        threadRootMessageIndex: number;
        onCloseThread: (id: ChatIdentifier) => void;
    }

    let { chatSummary, rootEvent, threadRootMessageIndex, onCloseThread }: Props = $props();

    function close() {
        onCloseThread(chatSummary.id);
    }

    function normaliseChatSummary(_now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        const someoneTyping = client.getTypingString(
            $_,
            $allUsersStore,
            { chatId: chatSummary.id, threadRootMessageIndex },
            typing,
        );

        const msgTxt = rootEvent ? client.getContentAsText($_, rootEvent.event.content) : "";
        const subtext =
            someoneTyping ?? ($mobileWidth ? `${$_("thread.title")}: ${msgTxt}` : msgTxt);
        if (chatSummary.kind === "direct_chat") {
            return {
                title: $mobileWidth
                    ? $allUsersStore.get(chatSummary.them.userId)?.username
                    : $_("thread.title"),
                avatarUrl: client.userAvatarUrl($allUsersStore.get(chatSummary.them.userId)),
                userId: chatSummary.them.userId,
                subtext,
                typing: someoneTyping !== undefined,
            };
        }
        return {
            title: $mobileWidth ? chatSummary.name : $_("thread.title"),
            userStatus: UserStatus.None,
            avatarUrl: client.groupAvatarUrl(chatSummary, $selectedCommunitySummaryStore),
            userId: undefined,
            subtext,
            typing: someoneTyping !== undefined,
        };
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            if (!document.getElementById("portal-element")) {
                close();
            }
        }
    }
    let chat = $derived(normaliseChatSummary($now, chatSummary, $byContext));
</script>

<svelte:window onkeydown={onKeyDown} />

<SectionHeader gap flush shadow>
    <div class="avatar">
        <Avatar
            statusBorder={"var(--section-bg)"}
            showStatus
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
                <Markdown text={chat.subtext} oneLine suppressLinks />
            {/if}
        </div>
    </div>
    <div class="close" onclick={close}>
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

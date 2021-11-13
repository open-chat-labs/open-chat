<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import type { UserSummary, UserLookup } from "../../domain/user/user";
    import HoverIcon from "../HoverIcon.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Loading from "../Loading.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import type { Message, EnhancedReplyContext } from "../../domain/chat/chat";
    import RepliesTo from "./RepliesTo.svelte";
    import { pop } from "../../utils/transition";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { afterUpdate, createEventDispatcher, getContext, onDestroy, onMount } from "svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import EmoticonLolOutline from "svelte-material-icons/EmoticonLolOutline.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import { toShortTimeString } from "../../utils/date";
    import { fillMessage, messageMetaData } from "../../utils/media";
    import UnresolvedReply from "./UnresolvedReply.svelte";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let chatType: "group_chat" | "direct_chat";
    export let user: UserSummary | undefined;
    export let senderId: string;
    export let msg: Message;
    export let me: boolean;
    export let eventIndex: number;
    export let timestamp: bigint;
    export let first: boolean;
    export let last: boolean;
    export let confirmed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let admin: boolean;

    let msgElement: HTMLElement;
    let userLookup = getContext<UserLookup>("userLookup");
    let sender = userLookup[senderId];

    let groupChat = chatType === "group_chat";
    let username = sender?.username;
    let metaData = messageMetaData(msg.content);
    let showEmojiPicker = false;
    let debug = false;

    $: deleted = msg.content.kind === "deleted_content";
    $: fill = fillMessage(msg);

    afterUpdate(() => {
        console.log("updating ChatMessage component");

        if (readByMe) {
            observer.unobserve(msgElement);
        }
    });

    onMount(() => {
        if (!me && !readByMe) {
            // todo - leaving this console log here for now just to make sure we are not *over* observing
            console.log("beginning to observe: ", msg.messageIndex);
            observer.observe(msgElement);
        } else {
        }
    });

    onDestroy(() => observer.unobserve(msgElement));

    function chatWithUser() {
        dispatch("chatWith", senderId);
    }

    function createReplyContext(): EnhancedReplyContext {
        return {
            kind: "rehydrated_reply_context",
            senderId,
            chatId: chatId,
            eventIndex: eventIndex,
            content: msg.content,
            sender,
            messageId: msg.messageId,
            messageIndex: msg.messageIndex,
        };
    }

    function reply() {
        dispatch("replyTo", createReplyContext());
    }

    function replyPrivately() {
        dispatch("replyPrivatelyTo", createReplyContext());
    }

    function deleteMessage() {
        dispatch("deleteMessage", msg);
    }

    // function editMessage() {
    //     dispatch("editMessage");
    // }

    function selectReaction(ev: CustomEvent<string>) {
        toggleReaction(ev.detail);
    }

    function toggleReaction(reaction: string) {
        dispatch("selectReaction", {
            message: msg,
            reaction,
        });
        showEmojiPicker = false;
    }

    $: mobile = $screenWidth === ScreenWidth.ExtraSmall;
</script>

{#if showEmojiPicker}
    <Overlay dismissible={true} bind:active={showEmojiPicker}>
        <ModalContent hideFooter={true} hideHeader={true} fill={true}>
            <span slot="body">
                <div class="emoji-header">
                    <h4>{$_("chooseReaction")}</h4>
                    <span
                        title={$_("close")}
                        class="close-emoji"
                        on:click={() => (showEmojiPicker = false)}>
                        <HoverIcon>
                            <Close size={"1.2em"} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                </div>
                {#await import("./EmojiPicker.svelte")}
                    <div class="loading-emoji"><Loading /></div>
                {:then picker}
                    <svelte:component
                        this={picker.default}
                        on:emojiSelected={selectReaction}
                        mode={"reaction"} />
                {/await}
            </span>
            <span slot="footer" />
        </ModalContent>
    </Overlay>
{/if}

<div class="message-wrapper" class:last>
    <div
        bind:this={msgElement}
        class="message"
        class:me
        data-index={msg.messageIndex}
        data-id={msg.messageId}
        id={`event-${eventIndex}`}>
        {#if me && !deleted}
            <div class="actions" class:mobile>
                <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                    <HoverIcon>
                        <EmoticonLolOutline size={"1.4em"} color={"#fff"} />
                    </HoverIcon>
                </div>
            </div>
        {/if}

        <div
            class="message-bubble"
            class:focused
            class:fill={fill && !deleted}
            class:me
            class:deleted
            class:first
            class:last
            class:readByMe
            class:rtl={$rtlStore}>
            {#if first && !me && groupChat && !deleted}
                <div class="sender" class:fill class:rtl={$rtlStore}>
                    <Link on:click={chatWithUser}>
                        <h4 class="username">{username}</h4>
                    </Link>
                </div>
            {/if}
            {#if msg.repliesTo !== undefined && !deleted}
                {#if msg.repliesTo.kind === "rehydrated_reply_context"}
                    <RepliesTo {chatId} {user} on:goToMessageIndex repliesTo={msg.repliesTo} />
                {:else}
                    <UnresolvedReply on:goToMessage repliesTo={msg.repliesTo} />
                {/if}
            {/if}

            <ChatMessageContent {fill} {me} content={msg.content} />

            {#if debug}
                <pre>EventIdx: {eventIndex}</pre>
                <pre>MsgIdx: {msg.messageIndex}</pre>
                <pre>MsgId: {msg.messageId}</pre>
                <pre>Confirmed: {confirmed}</pre>
                <pre>ReadByThem: {readByThem}</pre>
                <pre>ReadByUs: {readByMe}</pre>
            {/if}

            {#if metaData && !deleted}
                <span class="meta-wrapper">
                    {#await metaData then meta}
                        {meta}
                    {/await}
                </span>
            {/if}

            <div class="time-and-ticks">
                <span class="time">
                    {toShortTimeString(new Date(Number(timestamp)))}
                </span>
                {#if me}
                    {#if confirmed}
                        <CheckCircle size={"0.9em"} color={"var(--currentChat-msg-me-txt)"} />
                    {:else}
                        <CheckCircleOutline
                            size={"0.9em"}
                            color={"var(--currentChat-msg-me-txt)"} />
                    {/if}
                    {#if chatType === "direct_chat"}
                        {#if readByThem}
                            <CheckCircle size={"0.9em"} color={"var(--currentChat-msg-me-txt)"} />
                        {:else}
                            <CheckCircleOutline
                                size={"0.9em"}
                                color={"var(--currentChat-msg-me-txt)"} />
                        {/if}
                    {/if}
                {/if}
            </div>

            {#if !deleted}
                <div class="menu" class:rtl={$rtlStore}>
                    <MenuIcon>
                        <div class="menu-icon" slot="icon">
                            <HoverIcon compact={true}>
                                <ChevronDown
                                    size={"1.4em"}
                                    color={me ? "#fff" : "var(--icon-txt)"} />
                            </HoverIcon>
                        </div>
                        <div slot="menu">
                            <Menu>
                                {#if confirmed}
                                    <MenuItem on:click={reply}>
                                        <Reply
                                            size={"1.2em"}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("reply")}</div>
                                    </MenuItem>
                                {/if}
                                {#if confirmed && groupChat && !me}
                                    <MenuItem on:click={replyPrivately}>
                                        <ReplyOutline
                                            size={"1.2em"}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("replyPrivately")}</div>
                                    </MenuItem>
                                {/if}
                                {#if me || admin}
                                    <!-- <MenuItem on:click={editMessage}>
                                        <PencilOutline size={"1.2em"} color={"var(--icon-txt)"} slot="icon" />
                                        <div slot="text">{$_("editMessage")}</div>
                                    </MenuItem> -->
                                    <MenuItem on:click={deleteMessage}>
                                        <DeleteOutline
                                            size={"1.2em"}
                                            color={"var(--icon-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("deleteMessage")}</div>
                                    </MenuItem>
                                {/if}
                            </Menu>
                        </div>
                    </MenuIcon>
                </div>
            {/if}
        </div>
        {#if !me && !deleted}
            <div class="actions" class:mobile>
                <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                    <HoverIcon>
                        <EmoticonLolOutline size={"1.4em"} color={"#fff"} />
                    </HoverIcon>
                </div>
            </div>
        {/if}
    </div>

    {#if msg.reactions.length > 0 && !deleted}
        <div class="message-reactions" class:me>
            {#each msg.reactions as { reaction, userIds }}
                <div
                    in:pop={{ duration: 500 }}
                    on:click={() => toggleReaction(reaction)}
                    class="message-reaction">
                    {reaction}
                    <span class="reaction-count">
                        {userIds.size > 9 ? "9+" : userIds.size}
                    </span>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style type="text/scss">
    $size: 10px;

    :global(.time-and-ticks > svg) {
        width: 16px;
        height: 16px;
    }

    :global(.message .loading) {
        min-height: 100px;
        min-width: 250px;
    }

    :global(.message-bubble .content a) {
        text-decoration: underline;
    }

    :global(.message-bubble .content ul) {
        margin: 0 $sp4;
    }

    :global(.message-bubble:hover .menu-icon .wrapper) {
        background-color: var(--icon-hv);
    }

    :global(.message-bubble.me:hover .menu-icon .wrapper) {
        background-color: var(--icon-inverted-hv);
    }

    :global(.me .menu-icon:hover .wrapper) {
        background-color: var(--icon-inverted-hv);
    }

    :global(.message-bubble.fill.me:hover .menu-icon .wrapper) {
        background-color: var(--icon-hv);
    }

    .message-wrapper {
        &.last {
            margin-bottom: $sp4;
        }
    }

    .time-and-ticks {
        @include font(light, normal, fs-60);
        display: flex;
        align-items: center;
        float: right;
        margin-top: 6px;

        .time {
            margin: 0 $sp2;
        }
    }

    .message-bubble.fill .time-and-ticks {
        position: absolute;
        padding: $sp3;
        bottom: 0;
        right: 0;
        background-color: rgba(0, 0, 0, 0.3);
        color: #fff;
        border-radius: $sp4 0 0 0;
        padding: $sp3 $sp4;

        &.rtl {
            left: 0;
            right: unset;
            border-radius: 0 $sp4 0 0;
        }
    }

    .meta-wrapper {
        display: inline-block;
        align-items: center;
        @include font(light, normal, fs-60);
        @include ellipsis();
    }

    .sender {
        margin-bottom: $sp1;

        &.fill {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.3);
            color: #fff;
            padding: $sp2 $sp4;
            border-radius: 0 0 $sp4 0;

            &.rtl {
                right: 0;
                border-radius: 0 0 0 $sp4;
            }
        }
    }

    .menu {
        $offset: -2px;
        position: absolute;
        top: $offset;
        right: $offset;

        &.rtl {
            left: $offset;
            right: unset;
        }
    }

    .menu-icon {
        transition: opacity ease-in-out 200ms;
        opacity: 0;
    }

    .message-reactions {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;

        &.me {
            justify-content: flex-end;
        }

        .message-reaction {
            border-radius: $sp4;
            background-color: var(--reaction-bg);
            color: var(--reaction-txt);
            cursor: pointer;
            height: $sp5;
            padding: $sp2;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-left: 1px;
            margin-right: 1px;
            margin-bottom: $sp2;

            .reaction-count {
                @include font(book, normal, fs-60);
                margin-left: $sp2;
            }
        }
    }

    .message {
        display: flex;
        justify-content: flex-start;
        margin-bottom: $sp2;

        &.me {
            justify-content: flex-end;
        }

        .actions {
            transition: opacity 200ms ease-in-out;
            display: flex;
            opacity: 0;
            // padding: $sp3;
            justify-content: center;
            align-items: center;

            &.mobile {
                opacity: 0.3;
            }
        }

        &:hover .actions {
            opacity: 1;
        }
    }

    .message-bubble {
        $radius: 20px;
        $inner-radius: 4px;
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms,
            border ease-in-out 300ms, transform ease-in-out 200ms;
        position: relative;
        padding: 6px $sp3 6px $sp3;
        border: 1px solid var(--currentChat-msg-bd);
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        border-radius: $radius;
        max-width: 90%;
        min-width: 90px;
        overflow: hidden;

        .username {
            color: inherit;
            color: var(--accent);
        }

        &:hover {
            .menu-icon {
                opacity: 1;
            }
        }

        &:not(.readByMe) {
            box-shadow: 0 0 0 5px yellow;
        }

        &.last:not(.first) {
            border-radius: $inner-radius $radius $radius $radius;
        }
        &.first:not(.last) {
            border-radius: $radius $radius $radius $inner-radius;
        }
        &:not(.first):not(.last) {
            border-radius: $inner-radius $radius $radius $inner-radius;
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);
            border-color: var(--currentChat-msg-me-bd);

            &.last:not(.first) {
                border-radius: $radius $inner-radius $radius $radius;
            }
            &.first:not(.last) {
                border-radius: $radius $radius $inner-radius $radius;
            }
            &:not(.first):not(.last) {
                border-radius: $radius $inner-radius $inner-radius $radius;
            }
        }

        &.rtl {
            &.last:not(.first) {
                border-radius: $radius $inner-radius $radius $radius;
            }
            &.first:not(.last) {
                border-radius: $radius $radius $inner-radius $radius;
            }
            &:not(.first):not(.last) {
                border-radius: $radius $inner-radius $inner-radius $radius;
            }

            &.me {
                &.last:not(.first) {
                    border-radius: $inner-radius $radius $radius $radius;
                }
                &.first:not(.last) {
                    border-radius: $radius $radius $radius $inner-radius;
                }
                &:not(.first):not(.last) {
                    border-radius: $inner-radius $radius $radius $inner-radius;
                }
            }

            .time-and-ticks {
                right: unset;
                left: $sp3;
            }
        }

        &.fill {
            padding: 0;
            overflow: hidden;
            border: none;
            min-width: 0;
        }

        &.focused {
            transform: scale(0.9);
            border: 4px solid yellow;
        }

        &.deleted {
            opacity: 0.8;
        }
    }

    .username {
        margin: 0;
        @include font(bold, normal, fs-100);
        color: #fff;
    }

    .emoji-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp3 $sp4;
        background-color: var(--section-bg);

        .close-emoji {
            flex: 0 0 20px;
        }
    }
</style>

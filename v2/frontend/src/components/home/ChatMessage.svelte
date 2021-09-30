<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import { AvatarSize } from "../../domain/user/user";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import HoverIcon from "../HoverIcon.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Loading from "../Loading.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Avatar from "../Avatar.svelte";
    import type { Message, EnhancedReplyContext } from "../../domain/chat/chat";
    import RepliesTo from "./RepliesTo.svelte";
    import { pop } from "../../utils/transition";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { afterUpdate, createEventDispatcher, onDestroy, onMount } from "svelte";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import EmoticonLolOutline from "svelte-material-icons/EmoticonLolOutline.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import { toShortTimeString } from "../../utils/date";
    import Tick from "./Tick.svelte";
    import DoubleTick from "./DoubleTick.svelte";
    import { fillMessage, messageMetaData } from "../../utils/media";
    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let chatType: "group_chat" | "direct_chat";
    export let user: UserSummary | undefined;
    export let msg: Message;
    export let me: boolean;
    export let userLookup: UserLookup;
    export let eventIndex: number;
    export let timestamp: bigint;
    export let last: boolean;
    export let confirmed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;

    let msgElement: HTMLElement;

    let senderId = msg.sender;
    let groupChat = chatType === "group_chat";
    let sender = userLookup[senderId];
    let username = sender?.username;
    let userStatus = getUserStatus(userLookup, senderId);
    let metaData = messageMetaData(msg.content);
    let fill = fillMessage(msg);
    let showEmojiPicker = false;

    $: deleted = msg.content.kind === "deleted_content";

    afterUpdate(() => {
        // todo - keep an eye on this
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
            senderId,
            chatId: chatId,
            eventIndex: eventIndex,
            content: msg.content,
            sender,
            messageId: msg.messageId,
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

    function editMessage() {
        dispatch("editMessage");
    }

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
</script>

{#if showEmojiPicker}
    <Overlay active={showEmojiPicker}>
        <ModalContent hideFooter={true} hideHeader={true} fill={true}>
            <span slot="body">
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
        id={`event-${eventIndex}`}>
        {#if me && !deleted}
            <div class="actions">
                <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                    <HoverIcon>
                        <EmoticonLolOutline size={"1.2em"} color={"#fff"} />
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
            class:last
            class:readByMe
            class:rtl={$rtlStore}>
            {#if msg.repliesTo !== undefined && !deleted}
                <RepliesTo {chatId} {user} {userLookup} on:goToMessage repliesTo={msg.repliesTo} />
            {/if}

            <ChatMessageContent {me} content={msg.content} />

            {#if metaData && !deleted}
                {#await metaData then meta}
                    <div class="meta">
                        {meta}
                    </div>
                {/await}
            {/if}
            <div class="time-and-ticks">
                {#if msg.edited}
                    <span class="edited">{$_("edited")}</span>
                {/if}
                <span class="time">
                    {toShortTimeString(new Date(Number(timestamp)))}
                </span>
                {#if me && confirmed}
                    {#if readByThem}
                        <DoubleTick />
                    {:else}
                        <Tick />
                    {/if}
                {/if}
            </div>

            {#if !deleted}
                <div class="menu" class:rtl={$rtlStore}>
                    <MenuIcon>
                        <div class="menu-icon" slot="icon">
                            <HoverIcon>
                                <ChevronDown size={"1.2em"} color={me ? "#fff" : "#aaa"} />
                            </HoverIcon>
                        </div>
                        <div slot="menu">
                            <Menu>
                                <MenuItem on:click={reply}>
                                    <Reply size={"1.2em"} color={"#aaa"} slot="icon" />
                                    <div slot="text">{$_("reply")}</div>
                                </MenuItem>
                                {#if groupChat && !me}
                                    <MenuItem on:click={replyPrivately}>
                                        <ReplyOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                                        <div slot="text">{$_("replyPrivately")}</div>
                                    </MenuItem>
                                {/if}
                                {#if me}
                                    <!-- <MenuItem on:click={editMessage}>
                                        <PencilOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                                        <div slot="text">{$_("editMessage")}</div>
                                    </MenuItem> -->
                                    <MenuItem on:click={deleteMessage}>
                                        <DeleteOutline size={"1.2em"} color={"#aaa"} slot="icon" />
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
            <div class="actions">
                <div class="reaction" on:click={() => (showEmojiPicker = true)}>
                    <HoverIcon>
                        <EmoticonLolOutline size={"1.2em"} color={"#fff"} />
                    </HoverIcon>
                </div>
            </div>
        {/if}
    </div>

    <div class="message-footer" class:last>
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
        {#if groupChat && !me && last}
            <div class="message-sender">
                <Link on:click={chatWithUser}>
                    <div class="avatar-section">
                        <div class="avatar">
                            <Avatar
                                url={avatarUrl(sender)}
                                status={userStatus}
                                size={AvatarSize.Tiny} />
                        </div>

                        <h4 class="username">{username}</h4>
                    </div>
                </Link>
            </div>
        {/if}
    </div>
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

    .message-wrapper {
        &.last {
            margin-bottom: $sp4;
        }
    }

    .meta {
        position: absolute;
        bottom: $sp2;
        left: $sp4;
        @include font(light, normal, fs-60);
    }

    .time-and-ticks {
        position: absolute;
        bottom: $sp2;
        right: $sp3;
        display: flex;
        @include font(light, normal, fs-60);

        .time {
            margin: 0 $sp3;
        }

        .edited {
            @include font(light, italic, fs-60);
        }
    }

    .menu {
        position: absolute;
        top: $sp1;
        right: $sp1;

        &.rtl {
            left: $sp1;
            right: unset;
        }
    }

    .menu-icon {
        transition: opacity ease-in-out 200ms;
        opacity: 0;
    }

    .avatar-section {
        position: relative;
        display: inline-flex;
        align-items: center;

        .avatar {
            flex: 0 0 45px;
        }
    }

    .message-footer {
        .message-sender {
            margin-bottom: $sp2;
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
            padding: $sp3;
            justify-content: center;
            align-items: center;
        }

        &:hover .actions {
            // todo - need to consider how this works on mobile
            opacity: 1;
        }
    }

    .message-bubble {
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms,
            border ease-in-out 300ms, transform ease-in-out 200ms;
        position: relative;
        padding: $sp4;
        border: 1px solid var(--currentChat-msg-bd);
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        border-radius: $sp5;
        max-width: 90%;
        min-width: 50%;

        &:hover {
            box-shadow: 0 5px 10px var(--currentChat-msg-hv);
            .menu-icon {
                opacity: 0.6;
            }
        }

        &:not(.readByMe) {
            box-shadow: 0 0 0 5px yellow;
        }

        &.last {
            border-radius: $sp5 $sp5 $sp5 0;
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);
            border-color: var(--currentChat-msg-me-bd);

            &:hover {
                background-color: var(--currentChat-msg-me-hv);
            }

            &.last {
                border-radius: $sp5 $sp5 0 $sp5;
            }
        }

        &.rtl {
            &.last {
                border-radius: $sp5 $sp5 0 $sp5;
            }

            &.me {
                &.last {
                    border-radius: $sp5 $sp5 $sp5 0;
                }
            }

            .time-and-ticks {
                right: unset;
                left: $sp3;
            }

            .meta {
                left: unset;
                right: $sp4;
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
</style>

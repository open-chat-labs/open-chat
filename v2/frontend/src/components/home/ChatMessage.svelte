<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import { AvatarSize } from "../../domain/user/user";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import HoverIcon from "../HoverIcon.svelte";
    import ChatMessageContent from "./ChatMessageContent.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Avatar from "../Avatar.svelte";
    import type {
        ChatSummary,
        DirectMessage,
        EnhancedReplyContext,
        GroupMessage,
        ReplyContext,
    } from "../../domain/chat/chat";
    import RepliesTo from "./RepliesTo.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { afterUpdate, createEventDispatcher } from "svelte";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import { toShortTimeString } from "../../utils/date";
    import Tick from "./Tick.svelte";
    import DoubleTick from "./DoubleTick.svelte";
    import { fillMessage, messageMetaData } from "../../utils/media";
    const dispatch = createEventDispatcher();

    export let chatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let msg: GroupMessage | DirectMessage;
    export let me: boolean;
    export let userLookup: UserLookup;
    export let index: number;
    export let timestamp: bigint;
    export let last: boolean;

    let confirmed: boolean = true; // todo - where does this come from
    let read: boolean = true; // todo - where does this come from
    let msgElement: HTMLElement;

    let senderId = getSenderId();
    let groupChat = chatSummary.kind === "group_chat";
    let sender = userLookup[senderId];
    let username = sender?.username;
    let userStatus = getUserStatus(userLookup, senderId);
    let metaData = messageMetaData(msg.content);

    afterUpdate(() => {
        // todo - keep an eye on this
        console.log("updating ChatMessage component");
    });

    function getSenderId() {
        if (msg.kind === "direct_message" && chatSummary.kind === "direct_chat") {
            return msg.sentByMe ? user!.userId : chatSummary.them;
        }
        if (msg.kind === "group_message") {
            return msg.sender;
        }
        throw Error("Unable to determine sender Id");
    }

    function chatWithUser() {
        dispatch("chatWith", senderId);
    }

    function createReplyContext(privately: boolean): EnhancedReplyContext<ReplyContext> {
        if (privately) {
            return {
                kind: "direct_private_reply_context",
                chatId: chatSummary.chatId,
                eventIndex: index,
                content: msg.content,
                sender,
            };
        } else if (groupChat) {
            return {
                kind: "group_reply_context",
                content: msg.content,
                userId: senderId,
                eventIndex: index,
                sender,
            };
        } else {
            return {
                kind: "direct_standard_reply_context",
                content: msg.content,
                sentByMe: me,
                eventIndex: index,
                sender,
            };
        }
    }

    function reply() {
        dispatch("replyTo", createReplyContext(false));
    }

    function replyPrivately() {
        dispatch("replyPrivatelyTo", createReplyContext(true));
    }

    // todo - I think perhaps ChatMessageContent cannot make all of the decisions about rendering the content
    // ideally we want to make decisions at this level about padding and stuff based on the content type
    // e.g. image / video with no caption should fill the whole chat bubble
</script>

<div bind:this={msgElement} class="chat-message-wrapper" class:me id={`message-${index}`}>
    <div
        class="chat-message"
        class:fill={fillMessage(msg)}
        class:me
        class:last
        class:rtl={$rtlStore}>
        {#if msg.repliesTo !== undefined}
            <RepliesTo {chatSummary} {user} {userLookup} on:goToMessage repliesTo={msg.repliesTo} />
        {/if}

        <ChatMessageContent {me} content={msg.content} />

        <pre>{msg.messageIndex}</pre>

        {#if metaData}
            {#await metaData then meta}
                <div class="meta">
                    {meta}
                </div>
            {/await}
        {/if}
        <div class="time-and-ticks">
            <span class="time">
                {toShortTimeString(new Date(Number(timestamp)))}
            </span>
            {#if me && confirmed}
                {#if read}
                    <DoubleTick />
                {:else}
                    <Tick />
                {/if}
            {/if}
        </div>

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
                    </Menu>
                </div>
            </MenuIcon>
        </div>
    </div>
</div>

{#if groupChat && !me && last}
    <Link on:click={chatWithUser}>
        <div class="avatar-section">
            <div class="avatar">
                <Avatar url={avatarUrl(senderId)} status={userStatus} size={AvatarSize.Tiny} />
            </div>

            <h4 class="username">{username}</h4>
        </div>
    </Link>
{/if}

<style type="text/scss">
    $size: 10px;

    :global(.time-and-ticks > svg) {
        width: 16px;
        height: 16px;
    }

    :global(.chat-message .loading) {
        min-height: 100px;
        min-width: 250px;
    }

    :global(.chat-message .content a) {
        text-decoration: underline;
    }

    :global(.chat-message .content ul) {
        margin: 0 $sp4;
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
        margin-bottom: $sp5;
        display: flex;
        align-items: center;

        .avatar {
            flex: 0 0 45px;
        }
    }

    .chat-message-wrapper {
        display: flex;
        justify-content: flex-start;
        align-items: flex-end;

        &.me {
            justify-content: flex-end;
        }
    }

    .chat-message {
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms,
            border ease-in-out 500ms;
        position: relative;
        padding: $sp4;
        border: 1px solid var(--currentChat-msg-bd);
        max-width: 90%;
        min-width: 50%;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        margin-bottom: $sp3;
        border-radius: $sp5;

        &:hover {
            box-shadow: 0 5px 10px var(--currentChat-msg-hv);
            .menu-icon {
                opacity: 0.6;
            }
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
                margin-bottom: $sp5;
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
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp2;
        @include font(bold, normal, fs-100);
        color: #fff;
    }
</style>

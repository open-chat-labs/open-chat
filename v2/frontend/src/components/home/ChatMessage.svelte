<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import SvelteMarkdown from "svelte-markdown";
    import { AvatarSize } from "../../domain/user/user";
    import HoverIcon from "../HoverIcon.svelte";
    import Typing from "../Typing.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Avatar from "../Avatar.svelte";
    import type { Message } from "../../domain/chat/chat";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import RepliesTo from "./RepliesTo.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import { createEventDispatcher } from "svelte";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    const dispatch = createEventDispatcher();

    export let machine: ActorRefFrom<ChatMachine>;
    export let msg: Message;

    $: me = $machine.context.user?.userId === msg.sender;
    $: username = $machine.context.userLookup[msg.sender]?.username;
    $: textContent = getContentAsText(msg.content);
    $: groupChat = $machine.context.chatSummary.kind === "group_chat";

    function chatWithUser() {
        dispatch("chatWith", msg.sender);
    }

    function reply() {
        console.log("reply");
    }

    function replyPrivately() {
        console.log("reply privately");
    }
</script>

<div class="chat-message-wrapper" class:me id={`message-${msg.messageIndex}`}>
    <div class="chat-message" class:me class:rtl={$rtlStore} class:focus>
        {#if groupChat && !me}
            <Link on:click={chatWithUser} underline="hover">
                <h4 class="username">{username}</h4>
            </Link>
        {/if}
        {#if msg.repliesTo !== undefined}
            <RepliesTo {machine} repliesTo={msg.repliesTo} />
        {/if}
        <SvelteMarkdown source={textContent} />

        <div class="time">10:23</div>

        <pre class="debug">({msg.messageIndex})</pre>
        <div class="menu" class:rtl={$rtlStore}>
            <MenuIcon index={msg.messageIndex}>
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
    {#if groupChat && !me}
        <span class="avatar">
            <Avatar
                url={avatarUrl(msg.sender)}
                status={getUserStatus($machine.context.userLookup, msg.sender)}
                size={AvatarSize.Small} />

            <div class="typing">
                <Typing />
            </div>
        </span>
    {/if}
</div>

<style type="text/scss">
    $size: 10px;
    $stem-offset: 30px;

    .debug {
        margin-top: 10px;
    }

    .typing {
        position: absolute;
        top: 13px;
        left: 14px;
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

    .avatar {
        margin: 0 $sp3;
        position: relative;
    }

    .chat-message-wrapper {
        display: flex;
        justify-content: flex-start;

        &.me {
            justify-content: flex-end;
        }
    }

    .chat-message {
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms,
            border ease-in-out 500ms;
        position: relative;
        padding: $sp4;
        border-radius: $sp4 $sp4 $sp4 0;
        border: 1px solid var(--currentChat-msg-bd);
        margin-bottom: $sp4;
        max-width: 80%;
        min-width: 25%;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);

        &.rtl {
            border-radius: $sp4 $sp4 0 $sp4;
        }

        &:hover {
            box-shadow: 0 5px 10px var(--currentChat-msg-hv);
            .menu-icon {
                opacity: 0.6;
            }
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);
            border-color: var(--currentChat-msg-me-bd);
            border-radius: $sp4 $sp4 0 $sp4;

            &.rtl {
                border-radius: $sp4 $sp4 $sp4 0;
            }
            &:hover {
                background-color: var(--currentChat-msg-me-hv);
            }
        }

        &:after {
            content: "";
            position: absolute;
            border-style: solid;
            border-width: $size $size 0;
            border-color: var(--currentChat-msg-bg) transparent;
            display: block;
            width: 0;
            @include z-index("bubble-stem");
            bottom: -1px;
            transform: rotate(135deg) translateX(9px);
            left: 0;
        }

        &.rtl:after {
            right: -13px;
            bottom: -14px;
            transform: rotate(225deg) translateX(9px);
            left: unset;
        }

        &.me {
            &:after {
                transition: border-color ease-in-out 200ms;
                border-color: var(--currentChat-msg-me-bd) transparent;
                right: -13px;
                bottom: -14px;
                transform: rotate(225deg) translateX(9px);
                left: unset;
            }
            &.rtl:after {
                left: 0;
                bottom: -1px;
                transform: rotate(135deg) translateX(9px);
                right: unset;
            }
            &:hover {
                &:after {
                    border-color: var(--currentChat-msg-me-hv) transparent;
                }
            }
        }

        &:before {
            content: "";
            position: absolute;
            border-style: solid;
            border-width: $size $size 0;
            border-color: var(--currentChat-msg-bd) transparent;
            display: block;
            width: 0;
            @include z-index("bubble-stem");
            transform: rotate(135deg) scale(1.2) translateX($size);
            bottom: -1px;
            left: 0;
        }

        &.rtl:before {
            right: -15px;
            left: unset;
            bottom: -17px;
            transform: rotate(225deg) scale(1.1) translateX($size);
        }

        &.me {
            &:before {
                right: -15px;
                left: unset;
                border-color: var(--currentChat-msg-me-bd) transparent;
                bottom: -17px;
                transform: rotate(225deg) scale(1.1) translateX($size);
            }
            &.rtl:before {
                left: 0;
                bottom: -1px;
                transform: rotate(135deg) scale(1.2) translateX($size);
                right: unset;
            }
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp2;
        @include font(bold, normal, fs-100);
    }
</style>

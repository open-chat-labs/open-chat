<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import SvelteMarkdown from "svelte-markdown";
    import { AvatarSize } from "../../domain/user/user";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import HoverIcon from "../HoverIcon.svelte";
    import Typing from "../Typing.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Avatar from "../Avatar.svelte";
    import type { ChatSummary, Message } from "../../domain/chat/chat";
    import RepliesTo from "./RepliesTo.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import { afterUpdate, beforeUpdate, createEventDispatcher } from "svelte";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import { toShortTimeString } from "../../utils/date";
    import Tick from "./Tick.svelte";
    import DoubleTick from "./DoubleTick.svelte";
    const dispatch = createEventDispatcher();

    export let chatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let msg: Message;
    export let showStem: boolean;
    export let me: boolean;
    export let userLookup: UserLookup;
    let confirmed: boolean = true; // todo - where does this come from
    let read: boolean = true; // todo - where does this come from
    let msgElement: HTMLElement;

    $: groupChat = chatSummary.kind === "group_chat";
    $: username = userLookup[msg.sender]?.username;
    $: textContent = getContentAsText(msg.content);
    $: userStatus = getUserStatus(userLookup, msg.sender);

    afterUpdate(() => {
        // todo - keep an eye on this
        console.log("updating ChatMessage component");
    });

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

<div
    bind:this={msgElement}
    class="chat-message-wrapper"
    class:me
    id={`message-${msg.messageIndex}`}>
    <div class="chat-message" class:me class:showStem class:rtl={$rtlStore} class:focus>
        {#if groupChat && !me}
            <Link on:click={chatWithUser} underline="hover">
                <h4 class="username">{username}</h4>
            </Link>
        {/if}
        {#if msg.repliesTo !== undefined}
            <RepliesTo {chatSummary} {user} {userLookup} on:goToMessage repliesTo={msg.repliesTo} />
        {/if}
        <div class="content">
            <SvelteMarkdown source={textContent} />
        </div>

        <div class="time-and-ticks">
            <span class="time">
                {toShortTimeString(new Date(Number(msg.timestamp)))}
            </span>
            {#if me && confirmed}
                {#if read}
                    <DoubleTick />
                {:else}
                    <Tick />
                {/if}
            {/if}
        </div>

        <pre class="debug">({msg.messageIndex})</pre>
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
    {#if groupChat && !me && showStem}
        <span class="avatar">
            <Avatar url={avatarUrl(msg.sender)} status={userStatus} size={AvatarSize.Small} />

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

    :global(.time-and-ticks > svg) {
        width: 16px;
        height: 16px;
    }

    :global(.chat-message .content a) {
        text-decoration: underline;
    }

    :global(.chat-message .content ul) {
        margin: 0 $sp4;
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

    .avatar {
        margin: 0 $sp3;
        position: relative;
        margin-bottom: $sp4;
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
        min-width: 25%;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(book, normal, fs-100);
        margin-bottom: $sp2;
        border-radius: $sp4;

        &.showStem {
            margin-bottom: $sp4;
            border-radius: $sp4 $sp4 $sp4 0;
        }

        &.rtl.showStem {
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
            border-radius: $sp4;

            &.showStem {
                border-radius: $sp4 $sp4 0 $sp4;
            }

            &.rtl.showStem {
                border-radius: $sp4 $sp4 $sp4 0;
            }
            &:hover {
                background-color: var(--currentChat-msg-me-hv);
            }
        }

        &.showStem:after {
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

        &.showStem.rtl:after {
            right: -13px;
            bottom: -14px;
            transform: rotate(225deg) translateX(9px);
            left: unset;
        }

        &.showStem.me {
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

        &.showStem:before {
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

        &.showStem.rtl:before {
            right: -15px;
            left: unset;
            bottom: -17px;
            transform: rotate(225deg) scale(1.1) translateX($size);
        }

        &.showStem.me {
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

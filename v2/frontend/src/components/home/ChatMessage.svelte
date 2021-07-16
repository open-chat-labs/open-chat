<svelte:options immutable={true} />

<script lang="ts">
    import Link from "../Link.svelte";
    import type { Message } from "../../domain/chat/chat";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import RepliesTo from "./RepliesTo.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import { createEventDispatcher } from "svelte";
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
        {textContent}

        <pre class="debug">({msg.messageIndex})</pre>
    </div>
</div>

<style type="text/scss">
    $size: 10px;
    $stem-offset: 30px;

    .debug {
        margin-top: 10px;
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

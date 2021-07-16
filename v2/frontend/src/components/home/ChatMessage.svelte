<svelte:options immutable={true} />

<script lang="ts">
    import type { Message } from "../../domain/chat/chat";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom, mapState } from "xstate";
    import RepliesTo from "./RepliesTo.svelte";
    import { rtlStore } from "../../stores/rtl";
    import { getContentAsText } from "../../domain/chat/chat.utils";

    export let machine: ActorRefFrom<ChatMachine>;
    export let msg: Message;

    const me = $machine.context.user?.userId === msg.sender;
    const username = me
        ? $machine.context.user?.username
        : $machine.context.userLookup[msg.sender]?.username;
    const textContent = getContentAsText(msg.content);
</script>

<div class="chat-message-wrapper" class:me>
    <div class="chat-message" class:me class:rtl={$rtlStore}>
        <h4 class="username">{`${username} (${msg.messageIndex})`}</h4>
        {#if msg.repliesTo !== undefined}
            <RepliesTo {machine} repliesTo={msg.repliesTo} />
        {/if}
        {textContent}
    </div>
</div>

<style type="text/scss">
    $size: 10px;

    .chat-message-wrapper {
        display: flex;
        justify-content: flex-start;

        &.me {
            justify-content: flex-end;
        }
    }
    .chat-message {
        transition: box-shadow ease-in-out 200ms, background-color ease-in-out 200ms;
        position: relative;
        padding: $sp4;
        border-radius: $sp4;
        border: 1px solid var(--currentChat-msg-bd);
        margin-bottom: $sp4;
        width: 80%;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        @include font(light, normal, fs-90);

        &:hover {
            box-shadow: 0 5px 10px var(--currentChat-msg-hv);
        }

        &.me {
            background-color: var(--currentChat-msg-me-bg);
            color: var(--currentChat-msg-me-txt);
            border-color: var(--currentChat-msg-me-bd);
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
            bottom: -$size;
            margin-left: -$size;
            left: 15%;
        }

        &.rtl:after {
            margin-left: 0;
            margin-right: -$size;
            right: 15%;
        }

        &.me {
            &:after {
                border-color: var(--currentChat-msg-me-bd) transparent;
                left: 85%;
            }
            &.rtl:after {
                right: 85%;
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
            margin-left: -$size;
            bottom: -11px;
            left: 15%;
        }

        &.rtl:before {
            margin-left: 0;
            margin-right: -$size;
            right: 15%;
        }

        &.me {
            &:before {
                left: 85%;
                right: unset;
                border-color: var(--currentChat-msg-me-bd) transparent;
            }
            &.rtl:before {
                right: 85%;
            }
        }
    }

    .username {
        margin: 0;
        margin-bottom: $sp2;
        @include font(bold, normal, fs-100);
    }
</style>

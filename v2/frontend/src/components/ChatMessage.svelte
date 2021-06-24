<script lang="ts">
    import type { ChatMessage } from "../services/chats";
    import { rtlStore } from "../stores/rtl";
    export let msg: ChatMessage;
    export let me: boolean;
</script>

<div class="chat-message-wrapper" class:me>
    <div class="chat-message" class:me class:rtl={$rtlStore}>
        <h4 class="username">{msg.username}</h4>
        {msg.message}
    </div>
</div>

<style type="text/scss">
    @import "../styles/mixins";

    $size: 10px;

    .chat-message-wrapper {
        display: flex;
        justify-content: flex-start;

        &.me {
            justify-content: flex-end;
        }
    }
    .chat-message {
        transition: box-shadow ease-in-out 200ms,
            background-color ease-in-out 200ms;
        position: relative;
        padding: 20px;
        border-radius: 20px;
        border: 1px solid var(--currentChat-msg-bd);
        margin-bottom: 20px;
        font-size: 14px;
        width: 80%;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);

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
        margin-bottom: 5px;
    }
</style>

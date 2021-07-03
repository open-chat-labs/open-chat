<script lang="ts">
    import { push } from "svelte-spa-router";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import { avatarUrl, AvatarSize, UserStatus } from "../../domain/user";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import type { ChatSummary } from "../../domain/chat";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let chatSummary: ChatSummary;
    export let selected: boolean;

    // $: {
    //     selected = $chatStore?.chatId === chat.chatId;
    // }

    function onSelect() {
        dispatch("selectChat", chatSummary);
    }
</script>

<a href={`/#/${chatSummary.chatId}`}>
    <div role="button" class="chat-summary" class:selected>
        <span class="avatar">
            <Avatar
                url={avatarUrl(chatSummary.chatId)}
                status={UserStatus.Online}
                size={AvatarSize.Small} />
        </span>
        <span class="details">
            <h4 class="chat-name">{chatSummary.name}</h4>
            <p class="chat-msg">{chatSummary.lastMessage}</p>
        </span>
        {#if $rtlStore}
            <span class="icon"><ChevronLeft /></span>
        {:else}
            <span class="icon"><ChevronRight /></span>
        {/if}
    </div>
</a>

<style type="text/scss">
    @import "../../styles/mixins";

    .chat-summary {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: $sp3;
        margin-bottom: $sp3;
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        position: relative;

        &.selected::before {
            content: "";
            position: absolute;
            left: 0;
            height: 100%;
            width: $sp2;
            background-color: var(--chatSummary-bd-selected);
        }

        &:hover,
        &.selected {
            background-color: var(--chatSummary-hv);

            .icon {
                opacity: 1;
            }
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        padding: 0 $sp2;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 45px;
        .chat-name {
            margin: 0;
            color: var(--theme-box-text);
            @include ellipsis(200px);
        }
        .chat-msg {
            @include ellipsis(200px);
            @include font(light, normal, fs-70);
            color: var(--chatSummary-txt2);
            margin: 0;
        }
    }

    .icon {
        opacity: 0;
        transition: opactity ease-in-out 300ms;
        color: var(--button-bg);
    }
</style>

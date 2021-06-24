<script lang="ts">
  import { push } from "svelte-spa-router";
  import type { ChatDetails, ChatSummary } from "../services/chats";
  import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
  import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
  import { AvatarSize, UserStatus } from "../services/user";
  import { rtlStore } from "../stores/rtl";
  import Avatar from "./Avatar.svelte";
  import { chatStore } from "../stores/chats";

  export let chat: ChatSummary;
  let selected: boolean;

  $: {
    selected = $chatStore?.chatId === chat.chatId;
  }

  function onSelect() {
    push(`/chat/${chat.chatId}`);
  }
</script>

<div role="button" class="chat-summary" class:selected on:click={onSelect}>
  <span class="avatar">
    <Avatar
      url={chat.avatar}
      status={UserStatus.Online}
      size={AvatarSize.Small} />
  </span>
  <span class="details">
    <h4 class="chat-name">{chat.name}</h4>
    <p class="chat-msg">{chat.lastMessage}</p>
  </span>
  {#if $rtlStore}
    <span class="icon"><ChevronLeft /></span>
  {:else}
    <span class="icon"><ChevronRight /></span>
  {/if}
</div>

<style type="text/scss">
  @import "../styles/mixins";

  .chat-summary {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--chatSummary-bg);
    color: var(--chatSummary-txt1);
    padding: 10px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: background-color ease-in-out 100ms,
      border-color ease-in-out 100ms;
    // border: 4px solid var(--chatSummary-bd);
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
    padding: 0 5px;
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
      font-size: 10px;
      color: var(--chatSummary-txt2);
      margin: 0;
      font-weight: 200;
    }
  }

  .icon {
    opacity: 0;
    transition: opactity ease-in-out 300ms;
  }
</style>

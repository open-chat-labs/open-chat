<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { MessageMatch } from "../../domain/search/search";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import type { UserLookup } from "../../domain/user/user";
    import type { ChatSummary } from "../../domain/chat/chat";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import { avatarUrl } from "../../domain/user/user.utils";
    import Avatar from "../Avatar.svelte";

    export let msg: MessageMatch;
    export let userLookup: UserLookup;
    export let chat: ChatSummary;

    $: title = chat.kind === "group_chat" ? chat.name : userLookup[msg.sender]?.username;
    $: dataContent = chat.kind === "group_chat" ? chat : userLookup[msg.sender];
    $: content = getContentAsText(msg.content);
</script>

<div class="msg" on:click>
    <span class="avatar">
        <Avatar url={avatarUrl(dataContent)} status={UserStatus.None} size={AvatarSize.Small} />
    </span>
    <div class="details">
        <h4 class="title">
            {title}
        </h4>
        <p title={content} class="content">{content}</p>
    </div>
</div>

<style type="text/scss">
    .msg {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: $sp3;
        margin-bottom: $sp3;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;
        height: 65px;

        &:hover {
            background-color: var(--chatSummary-hv);
        }
    }

    .avatar {
        flex: 0 0 50px;
    }

    .details {
        flex: 1;
        padding: 0 5px;
        overflow: hidden;
    }

    .title {
        margin-bottom: $sp3;
    }

    .content {
        @include font(light, normal, fs-80);
        @include ellipsis();
    }
</style>

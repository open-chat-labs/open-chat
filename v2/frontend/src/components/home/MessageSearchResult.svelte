<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { MessageMatch } from "../../domain/search/search";
    import { getContentAsText } from "../../domain/chat/chat.utils";
    import type { UserLookup } from "../../domain/user/user";

    export let msg: MessageMatch;
    export let userLookup: UserLookup;

    $: sender = userLookup[msg.sender];
    $: username = sender?.username;
    $: content = getContentAsText(msg.content);
</script>

<div class="msg" on:click>
    <h4 class="title">{username}</h4>
    <p class="details" title={content}>
        {content}
    </p>
</div>

<style type="text/scss">
    .msg {
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

    .title {
        margin-bottom: $sp3;
    }

    .details {
        @include font(light, normal, fs-80);
        @include ellipsis();
    }
</style>

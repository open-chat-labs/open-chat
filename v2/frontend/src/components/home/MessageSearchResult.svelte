<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { MessageMatch } from "../../domain/search/search";
    import { getContentAsText } from "../../domain/chat/chat.utils";

    export let msg: MessageMatch;

    $: content = getContentAsText(msg.content);
</script>

<div class="msg" on:click>
    <p class="details" title={content}>
        {content}
    </p>
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
    .details {
        flex: 1;
        padding: 0 5px;
        @include ellipsis();
    }
</style>

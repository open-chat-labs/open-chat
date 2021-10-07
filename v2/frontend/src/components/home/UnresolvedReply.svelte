<svelte:options immutable={true} />

<script lang="ts">
    import type { RawReplyContext } from "../../domain/chat/chat";
    import { rtlStore } from "../../stores/rtl";
    import Link from "../Link.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { push } from "svelte-spa-router";

    export let repliesTo: RawReplyContext;

    function zoomToMessage() {
        if (repliesTo.chatIdIfOther === undefined) {
            dispatch("goToMessage", repliesTo.eventIndex);
        } else {
            push(`/${repliesTo.chatIdIfOther}/${repliesTo.eventIndex}`);
        }
    }
</script>

<Link on:click={zoomToMessage}>
    <div class="reply-wrapper" class:rtl={$rtlStore}>
        {$_("unresolvedReply")}
    </div>
</Link>

<style type="text/scss">
    .reply-wrapper {
        border-radius: $sp4;
        padding: $sp4;
        background-color: var(--currentChat-msg-bg);
        color: var(--currentChat-msg-txt);
        cursor: pointer;
        box-shadow: -7px 0px 0px 0px var(--button-bg);
        border: 1px solid var(--button-bg);
        margin-bottom: $sp3;

        &.rtl {
            box-shadow: 7px 0px 0px 0px var(--button-bg);
        }
    }
</style>

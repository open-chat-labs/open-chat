<svelte:options immutable={true} />

<script lang="ts">
    import { rtlStore } from "../../stores/rtl";
    import { _ } from "svelte-i18n";
</script>

<div class="reply-wrapper" class:rtl={$rtlStore}>
    {$_("unresolvedReply")}
</div>

<style lang="scss">
    .reply-wrapper {
        border-radius: $sp4;
        padding: $sp4;
        background-color: var(--currentChat-msg-bg);
        color: var(--txt);
        cursor: pointer;
        box-shadow: -7px 0px 0px 0px var(--currentChat-msg-reply-accent);
        border: 2px solid var(--currentChat-msg-reply-accent);
        margin-bottom: $sp3;

        &.rtl {
            box-shadow: 7px 0px 0px 0px var(--button-bg);
        }
    }
</style>

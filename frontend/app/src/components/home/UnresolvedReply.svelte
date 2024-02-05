<svelte:options immutable />

<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import Translatable from "../Translatable.svelte";
</script>

<div class="reply-wrapper" class:rtl={$rtlStore}>
    <Translatable resourceKey={i18nKey("unresolvedReply")} />
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

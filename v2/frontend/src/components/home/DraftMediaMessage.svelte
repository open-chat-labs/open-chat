<svelte:options immutable={true} />

<script lang="ts">
    import MediaContentComponent from "./MediaContent.svelte";
    import type { MediaContent } from "../../domain/chat/chat";
    import { rtlStore } from "../../stores/rtl";

    export let draft: MediaContent;
</script>

<div class="msg-preview" class:rtl={$rtlStore}>
    <MediaContentComponent content={draft} />
</div>

<style type="text/scss">
    .msg-preview {
        border-radius: $sp4 $sp4 0 0;
        padding: $sp3;
        background-color: var(--section-bg);
        border-bottom: var(--section-bd);
        box-shadow: 0 -6px 10px 0 rgba(25, 25, 25, 0.25);
        border-left: 7px solid var(--button-bg);

        &.rtl {
            border-left: none;
            border-right: 7px solid var(--button-bg);
        }
    }
</style>

<script lang="ts">
    import type { DraftMediaContent } from "../../domain/chat/chat";
    import { rtlStore } from "../../stores/rtl";

    export let draft: DraftMediaContent;

    let landscape = draft.height < draft.width;
</script>

<div class="msg-preview" class:rtl={$rtlStore}>
    <img class:landscape src={draft.blobUrl} alt={draft.caption} />
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

    img {
        max-width: none;
        width: auto;
        height: 100%;
        max-height: calc(var(--vh, 1vh) * 50);

        &.landscape {
            max-width: calc(var(--vh, 1vh) * 50);
            width: 100%;
            height: auto;
            max-height: none;
        }
    }
</style>

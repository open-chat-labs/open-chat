<script lang="ts">
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    export let isPublic: boolean;
</script>

<div class="visibility">
    <div class={`img ${isPublic ? "public" : "private"}`}></div>
    <div class="name">
        <Translatable resourceKey={i18nKey(isPublic ? "access.public" : "access.private")} />
    </div>
</div>

<style lang="scss">
    .visibility {
        display: flex;
        gap: $sp2;
        align-items: center;
        text-transform: uppercase;
        background-color: var(--chatSummary-bg-selected);
        padding: $sp2 $sp3;
        border-radius: $sp3;

        .img {
            background-repeat: no-repeat;
            $size: 12px;
            flex: 0 0 $size;
            width: $size;
            height: $size;

            &.public {
                background-image: url("/assets/unlocked.svg");
            }

            &.private {
                background-image: url("/assets/locked.svg");
            }
        }
    }
</style>

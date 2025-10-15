<script lang="ts">
    import { Container } from "component-lib";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        isPublic: boolean;
    }

    let { isPublic }: Props = $props();
</script>

<Container
    width={{ kind: "hug" }}
    crossAxisAlignment={"center"}
    gap={"sm"}
    borderRadius={"sm"}
    background={"var(--chatSummary-bg-selected)"}>
    <div class={`img ${isPublic ? "public" : "private"}`}></div>
    <div class="name">
        <Translatable resourceKey={i18nKey(isPublic ? "access.public" : "access.private")} />
    </div>
</Container>

<style lang="scss">
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

    .name {
        text-transform: uppercase;
        @include font(book, normal, fs-70);
    }
</style>

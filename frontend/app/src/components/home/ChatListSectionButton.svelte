<script lang="ts">
    import { mobileWidth } from "../../stores/screenDimensions";
    import Button from "../Button.svelte";
    import UnreadCount from "./UnreadCount.svelte";
    import { emptyUnreadCounts, type ResourceKey } from "openchat-client";
    import Translatable from "../Translatable.svelte";

    export let selected = false;
    export let title: ResourceKey;
    export let unread = emptyUnreadCounts();
</script>

<Button fill={$mobileWidth} hollow={!selected} small={!$mobileWidth} tiny={$mobileWidth} on:click>
    <h4 class="title">
        <Translatable resourceKey={title} />
    </h4>
    <UnreadCount solid={false} {unread} />
</Button>

<style lang="scss">
    .title {
        @include font(medium, normal, fs-100);
        @include ellipsis();
    }
</style>

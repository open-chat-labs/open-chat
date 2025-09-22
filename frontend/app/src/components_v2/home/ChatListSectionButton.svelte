<script lang="ts">
    import { emptyUnreadCounts, mobileWidth, type ResourceKey } from "openchat-client";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import UnreadCount from "./UnreadCount.svelte";

    interface Props {
        selected?: boolean;
        title: ResourceKey;
        unread?: any;
        onClick?: (e: MouseEvent) => void;
    }

    let { selected = false, title, unread = emptyUnreadCounts(), onClick }: Props = $props();
</script>

<Button fill={$mobileWidth} hollow={!selected} small={!$mobileWidth} tiny={$mobileWidth} {onClick}>
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

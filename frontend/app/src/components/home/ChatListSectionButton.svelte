<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Button from "../Button.svelte";
    import UnreadCount from "./UnreadCount.svelte";
    import { emptyUnreadCounts } from "openchat-client";

    export let selected = false;
    export let title: string;
    export let unread = emptyUnreadCounts();
</script>

<Button fill={$mobileWidth} hollow={!selected} small={!$mobileWidth} tiny={$mobileWidth} on:click>
    <h4 class="title">
        {title}
    </h4>
    <UnreadCount solid={false} {unread} />
</Button>

<style lang="scss">
    .title {
        @include font(medium, normal, fs-100);
        @include ellipsis();
    }
</style>

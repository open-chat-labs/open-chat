<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Button from "../Button.svelte";
    import UnreadCount from "./UnreadCount.svelte";

    export let selected = false;
    export let title: string;
    export let unread: number;
</script>

<Button fill={$mobileWidth} hollow={!selected} small={!$mobileWidth} tiny={$mobileWidth} on:click>
    <div class="wrapper">
        <h4 class="title" class:unread={unread > 0}>
            {title}
        </h4>
        <UnreadCount {unread} />
    </div>
</Button>

<style lang="scss">
    .wrapper {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: $sp4;
        min-width: 120px;
    }

    .title {
        @include font(medium, normal, fs-100);
    }
</style>

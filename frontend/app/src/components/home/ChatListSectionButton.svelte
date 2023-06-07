<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Button from "../Button.svelte";

    export let selected = false;
    export let title: string;
    export let unread: number;
</script>

<Button fill={$mobileWidth} hollow={!selected} small={!$mobileWidth} tiny={$mobileWidth} on:click>
    <div class="wrapper">
        <h4 class="title" class:unread={unread > 0}>
            {title}
        </h4>
        {#if unread > 0}
            <div
                in:pop={{ duration: 1500 }}
                title={$_("thread.unread", {
                    values: { count: unread.toString() },
                })}
                class="unread-count">
                {unread > 999 ? "999+" : unread}
            </div>
        {/if}
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

    .unread-count {
        position: absolute;
        right: -16px;
        @include unread();
    }
</style>

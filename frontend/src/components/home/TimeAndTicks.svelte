<svelte:options immutable={true} />

<script lang="ts">
    import { toShortTimeString } from "../../utils/date";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import { rtlStore } from "../../stores/rtl";
    import { _ } from "svelte-i18n";

    export let timestamp: bigint;
    export let confirmed: boolean;
    export let chatType: "group_chat" | "direct_chat";
    export let readByThem: boolean;
    export let me: boolean;
    export let fill: boolean;
    export let pinned: boolean;
    export let crypto: boolean;
    export let edited: boolean;

    let iconColor = fill ? "#fff" : "var(--currentChat-msg-me-txt)";
    let pinnedColor = crypto
        ? "#fff"
        : me
        ? "var(--currentChat-msg-me-txt)"
        : fill
        ? "#fff"
        : "var(--currentChat-msg-txt)";
</script>

<div class="time-and-ticks" class:fill class:rtl={$rtlStore}>
    <span class="time">
        {toShortTimeString(new Date(Number(timestamp)))}
    </span>
    {#if me}
        {#if confirmed}
            <CheckCircle size={"0.9em"} color={iconColor} />
        {:else}
            <CheckCircleOutline size={"0.9em"} color={iconColor} />
        {/if}
        {#if chatType === "direct_chat"}
            {#if readByThem}
                <CheckCircle size={"0.9em"} color={iconColor} />
            {:else}
                <CheckCircleOutline size={"0.9em"} color={iconColor} />
            {/if}
        {/if}
    {/if}
    {#if pinned}
        <Pin size={"0.9em"} color={pinnedColor} />
    {/if}
    {#if edited}
        <PencilOutline size={"0.9em"} color={pinnedColor} />
    {/if}
</div>

<style type="text/scss">
    :global(.time-and-ticks > svg) {
        width: 16px;
        height: 16px;
    }
    .time-and-ticks {
        @include font(light, normal, fs-50);
        display: flex;
        align-items: center;
        float: right;
        margin-top: 7px;

        @include mobile() {
            margin-top: 4px;
        }

        &.rtl {
            clear: right;
            float: left;
        }

        .time {
            margin: $sp1 $sp2 0 $sp3;
        }

        &.rtl .time {
            margin: $sp1 $sp3 0 $sp2;
        }

        &.fill {
            position: absolute;
            padding: $sp3;
            bottom: 0;
            right: 0;
            background-color: rgba(0, 0, 0, 0.3);
            color: #fff;
            border-radius: $sp4 0 0 0;

            &.rtl {
                left: 0;
                right: unset;
                border-radius: 0 $sp4 0 0;
            }
        }
    }
</style>

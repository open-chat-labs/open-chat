<script lang="ts">
    import DeletedIcon from "svelte-material-icons/DeleteOutline.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import { rtlStore } from "../../stores/rtl";
    import type { ChatType, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { currentTheme } from "../../theme/themes";
    import DisappearsAt from "./DisappearsAt.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        timestamp: bigint;
        expiresAt: number | undefined;
        percentageExpired: number;
        accepted: boolean;
        failed: boolean;
        chatType: ChatType;
        readByThem: boolean;
        me: boolean;
        bot: boolean;
        fill: boolean;
        pinned: boolean;
        crypto: boolean;
        dateFormatter?: (date: Date) => string;
        deleted: boolean;
        undeleting: boolean;
    }

    let {
        timestamp,
        expiresAt,
        percentageExpired,
        accepted,
        failed,
        chatType,
        readByThem,
        me,
        bot,
        fill,
        pinned,
        crypto,
        dateFormatter = (date) => client.toShortTimeString(date),
        deleted,
        undeleting,
    }: Props = $props();

    let iconColor = me ? $currentTheme.time.me.icon : $currentTheme.time.icon;
    let pinnedColor = crypto || me || fill ? "#ffffff" : "var(--txt)";
</script>

<div class="time-and-ticks" class:me class:fill class:rtl={$rtlStore}>
    <span class="time">
        {dateFormatter(new Date(Number(timestamp)))}
    </span>
    {#if failed}
        <AlertCircleOutline size={"0.9em"} color={iconColor} />
    {:else if deleted}
        <DeletedIcon size={"0.9em"} color={iconColor} />
        {#if undeleting}
            <div class="confirming"></div>
        {/if}
    {:else}
        {#if !bot}
            {#if me}
                {#if accepted}
                    <CheckCircle size={"0.9em"} color={iconColor} />
                {:else}
                    <div class="confirming"></div>
                {/if}
                {#if chatType === "direct_chat"}
                    {#if readByThem}
                        <CheckCircle size={"0.9em"} color={iconColor} />
                    {:else}
                        <CheckCircleOutline size={"0.9em"} color={iconColor} />
                    {/if}
                {/if}
            {:else if !accepted}
                <div class="confirming"></div>
            {/if}
            {#if expiresAt !== undefined}
                <DisappearsAt {me} {percentageExpired} {expiresAt} />
            {/if}
        {/if}
        {#if pinned}
            <Pin size={"0.9em"} color={pinnedColor} />
        {/if}
    {/if}
</div>

<style lang="scss">
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
        pointer-events: none;
        color: var(--time-txt);

        &.me {
            color: var(--time-me-txt);
        }

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

        .confirming {
            width: 1.45em;
            height: 1.4em;
            @include loading-spinner(1.2em, 0.6em, "#ffffff", "/assets/plain-spinner.svg", 1.5s);
        }
    }
</style>

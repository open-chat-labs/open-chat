<script lang="ts">
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";

    type Streak = "none" | "three" | "seven" | "fourteen" | "thirty";

    export let days: number = 0;
    export let showTooltip = true;
    export let disabled = false;

    $: streak = streakFromDays(days);
    $: show = streak !== "none";
    $: num = streakNumber(streak);

    function streakFromDays(days: number): Streak {
        return days < 3
            ? "none"
            : days < 7
              ? "three"
              : days < 14
                ? "seven"
                : days < 30
                  ? "fourteen"
                  : "thirty";
    }

    function streakNumber(streak: Streak): 0 | 3 | 7 | 14 | 30 {
        switch (streak) {
            case "none":
                return 0;
            case "three":
                return 3;
            case "seven":
                return 7;
            case "fourteen":
                return 14;
            case "thirty":
                return 30;
        }
    }
</script>

{#if show}
    {#if showTooltip}
        <TooltipWrapper position="top" align="middle">
            <div slot="target" class:disabled class={`icon ${streak}`}>
                {num}
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    {`${streak.toUpperCase()} day streak!`}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else}
        <div class="wrapper">
            <div>
                {`${streak.toUpperCase()} day streak!`}
            </div>
            <div class:disabled class={`icon ${streak}`}>
                {num}
            </div>
        </div>
    {/if}
{/if}

<style lang="scss">
    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        background-repeat: no-repeat;
        text-shadow: 0.3px 0.3px #777;
        width: 20px;
        height: 15px;
        padding: 2px 0 0 7px;
        @include font(bold, normal, fs-50);
        font-size: 0.5rem;

        &.three {
            background-image: url("/assets/streaks/streak_three.svg");
        }
        &.seven {
            background-image: url("/assets/streaks/streak_seven.svg");
        }
        &.fourteen {
            background-image: url("/assets/streaks/streak_fourteen.svg");
        }
        &.thirty {
            background-image: url("/assets/streaks/streak_thirty.svg");
        }
        &.disabled {
            background-image: url("/assets/streaks/streak_disabled.svg");
        }
    }

    .wrapper {
        display: flex;
        align-items: center;
        gap: $sp2;
    }
</style>

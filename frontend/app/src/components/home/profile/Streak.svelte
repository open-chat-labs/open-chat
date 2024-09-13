<script lang="ts">
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";

    type Streak =
        | "none"
        | "three"
        | "seven"
        | "fourteen"
        | "thirty"
        | "one_hundred"
        | "three_six_five";

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
                  : days < 100
                    ? "thirty"
                    : days < 356
                      ? "one_hundred"
                      : "three_six_five";
    }

    function streakNumber(streak: Streak): 0 | 3 | 7 | 14 | 30 | 100 | 356 {
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
            case "one_hundred":
                return 100;
            case "three_six_five":
                return 356;
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
        width: 21px;
        height: 18px;
        padding: 1px 0 0 7px;
        @include font(bold, normal, fs-50);
        font-size: 0.4rem;
        margin-top: 1px;

        &.three {
            background-image: url("/assets/streaks/streak_three.svg");
            color: rgb(10, 203, 50);
            padding-left: 8px;
        }
        &.seven {
            background-image: url("/assets/streaks/streak_seven.svg");
            color: rgb(246, 28, 255);
            padding-left: 8px;
        }
        &.fourteen {
            background-image: url("/assets/streaks/streak_fourteen.svg");
            color: rgb(255, 159, 27);
        }
        &.thirty {
            background-image: url("/assets/streaks/streak_thirty.svg");
            color: rgb(255, 0, 0);
        }

        &.one_hundred {
            background-image: url("/assets/streaks/streak_100.svg");
            color: white;
            text-shadow: 3px 3px 0px #000;
        }

        &.three_six_five {
            background-image: url("/assets/streaks/streak_356.svg");
            color: white;
            text-shadow: 3px 3px 0px #000;
        }

        &.disabled {
            background-image: url("/assets/streaks/streak_disabled.svg");
            color: #888;
        }
    }

    .wrapper {
        display: flex;
        align-items: center;
        gap: $sp2;
    }
</style>

<script lang="ts">
    import Tooltip from "../../tooltip/Tooltip.svelte";

    type Streak =
        | "none"
        | "three"
        | "seven"
        | "fourteen"
        | "thirty"
        | "one hundred"
        | "three six five";

    interface Props {
        days?: number;
        showTooltip?: boolean;
        disabled?: boolean;
    }

    let { days = 0, showTooltip = true, disabled = false }: Props = $props();

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
                    : days < 365
                      ? "one hundred"
                      : "three six five";
    }

    function streakNumber(streak: Streak): 0 | 3 | 7 | 14 | 30 | 100 | 365 {
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
            case "one hundred":
                return 100;
            case "three six five":
                return 365;
        }
    }
    let streak = $derived(streakFromDays(days));
    let show = $derived(streak !== "none");
    let num = $derived(streakNumber(streak));
</script>

{#if show}
    {#if showTooltip}
        <Tooltip uppercase position="top" align="middle">
            <div class:disabled class={`icon ${streak.replace(/ /g, "_")}`}>
                {num}
            </div>
            {#snippet popupTemplate()}
                {`${streak} day streak!`}
            {/snippet}
        </Tooltip>
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
            text-shadow: 0.5px 0.5px 0.5px #555;
        }

        &.three_six_five {
            background-image: url("/assets/streaks/streak_365.svg");
            color: white;
            text-shadow: 0.5px 0.5px 0.5px #555;
            padding: 0 0 0 7px;
        }

        &.disabled {
            background-image: url("/assets/streaks/streak_disabled.svg");
            color: #9a9a9a;
        }
    }

    .wrapper {
        display: flex;
        align-items: center;
        gap: $sp2;
    }
</style>

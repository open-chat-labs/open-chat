<script lang="ts">
    import { ColourVars } from "component-lib";

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

    let { days = 0, disabled = false }: Props = $props();

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
    let nudge = $derived(num >= 100);
</script>

{#if show}
    <div class="streak">
        <svg class="streak_icon" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M28.5918 37.6904C24.9134 43.3723 17.7038 46.0225 11.0342 43.6807C3.21787 40.9361 -0.893882 32.374 1.85059 24.5576C3.11503 20.9567 5.6173 18.1425 8.70898 16.4229L33.0752 1.15332L34.4375 2.55664L27.6289 12.7432L43.0439 1.33301L44.4912 2.65918L35.0693 18.0195L39.6631 15.8779L42.6602 14.4814L40.9395 17.3057L31.4727 32.835L28.6123 37.6572L28.6025 37.6738L28.5918 37.6904Z"
                fill={disabled ? ColourVars.disabledButton : ColourVars.primary}
                stroke="#13151D"
                stroke-width="2" />
        </svg>

        <!-- <svg class="streak_icon" viewBox="0 -3 179 161" xmlns="http://www.w3.org/2000/svg">
            <path
                style={`stroke: ${ColourVars.background0}; stroke-width: 8px; fill: ${
                    disabled ? ColourVars.disabledButton : ColourVars.primary
                }; stroke-linecap: round; stroke-linejoin: round;`}
                d="M 11.791 109.094 L 75.857 19.498 C 96.513 -6.064 143.611 -4.024 164.651 22.748 C 185.629 49.44 180.09 94.319 145.353 114.942 L 51.676 159.985 L 92.243 112.704 L 2.741 158.382 L 62.829 80.952 L 11.791 109.094 Z"
            ></path>
        </svg> -->
        <div class:nudge class:disabled class="num">
            {num}
        </div>
    </div>
{/if}

<style lang="scss">
    .streak {
        position: relative;
    }
    .streak_icon {
        width: 20px;
        ///height: 18px;
        aspect-ratio: 1 / 1;
    }

    .num {
        position: absolute;
        top: 7px;
        left: 5px;
        @include font(bold, normal, fs-50);
        font-size: 0.4rem;
        color: var(--text-on-primary);

        &.disabled {
            color: var(--text-primary);
        }

        &.nudge {
            right: 2px;
        }
    }
</style>

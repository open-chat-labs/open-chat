<script lang="ts">
    import { Tooltip, Caption, ColourVars } from "component-lib";
    import BadgeContainer from "./BadgeContainer.svelte";

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

    let { days = 0, showTooltip = true }: Props = $props();

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

{#snippet renderStreak()}
    <BadgeContainer supplementalClass="streak-badge" backgroundColor={ColourVars.error}>
        <Caption align="center" fontWeight="bold">{num}</Caption>
        <svg
            class="commet-tail"
            width="17"
            height="18"
            viewBox="0 0 17 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
                d="M8.41613 4.90705L10.3144 0.956614C10.3144 0.956614 2.63919 4.12504 0.320312 6C-1.99856 7.87496 8.90159 20.1676 12.6179 17.6467C16.3343 15.1257 16.0091 4.30476 16.0091 4.30476L12.2126 7.54332L15.5345 0L8.41613 4.90705Z"
                fill={ColourVars.error} />
        </svg>
    </BadgeContainer>
{/snippet}

{#if show}
    {#if showTooltip}
        <Tooltip uppercase position="top" align="middle">
            {@render renderStreak()}
            {#snippet popup()}
                {`${streak} day streak!`}
            {/snippet}
        </Tooltip>
    {:else}
        {@render renderStreak()}
    {/if}
{/if}

<style lang="scss">
    :global {
        .streak-badge {
            .commet-tail {
                position: absolute;
                right: -0.125rem;
                top: -0.25rem;
            }

            .caption {
                z-index: 1;
                scale: 0.8;
                width: 100%;
                text-shadow:
                    -1px -1px 0 var(--primary-muted),
                    1px -1px 0 var(--primary-muted),
                    -1px 1px 0 var(--primary-muted),
                    1px 1px 0 var(--primary-muted);
            }
        }
    }
</style>

<script lang="ts">
    import type { ChitEarned } from "openchat-client";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";

    export let events: ChitEarned[];
    export let day: Date;
</script>

{#if events.length === 0}
    <div class="day">{day.getDate()}</div>
{:else}
    <div class="day has-events">
        <TooltipWrapper fill position="top" align="middle">
            <div slot="target">
                {day.getDate()}
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup autoWidth {position} {align}>
                    <div class="tt">
                        {#each events as event}
                            {#if event.reason.kind === "daily_claim"}
                                <p>{`🚀  Daily claim: ${event.amount}`}</p>
                            {:else if event.reason.kind === "achievement_unlocked"}
                                <p>{`🔓️ Achievement unlocked: ${event.amount}`}</p>
                            {:else if event.reason.kind === "meme_contest_winner"}
                                <p>{`🏆️ Meme context win: ${event.amount}`}</p>
                            {/if}
                        {/each}
                    </div>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    </div>
{/if}

<style lang="scss">
    :global(.day.has-events .tooltip-popup) {
        word-wrap: unset;
    }

    .day {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;

        &.has-events {
            background-color: var(--button-bg);
            color: var(--button-txt);
            transition: background-color 300ms ease-in-out;

            &:hover {
                background-color: var(--button-hv);
            }
        }
    }

    .tt {
        @include font(book, normal, fs-100);
        padding: $sp3;
    }
</style>

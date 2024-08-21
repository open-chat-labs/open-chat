<script lang="ts">
    import type { ChitEarned } from "openchat-client";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";

    export let events: ChitEarned[];
    export let day: Date;
    export let selectedMonth: number;

    $: otherMonth = day.getMonth() !== selectedMonth;
</script>

{#if events.length === 0}
    <div class="day">{day.getDate()}</div>
{:else}
    <div class="day has-events" class:otherMonth>
        <TooltipWrapper fill position="top" align={$mobileWidth ? "middle" : "end"}>
            <div slot="target">
                {day.getDate()}
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup autoWidth {position} {align}>
                    <div class="tt">
                        {#each events as event}
                            {#if event.reason.kind === "daily_claim"}
                                <p>{`🚀  Daily claim: ${event.amount.toLocaleString()}`}</p>
                            {:else if event.reason.kind === "achievement_unlocked"}
                                <p>
                                    🔓 <Translatable
                                        resourceKey={i18nKey(
                                            `learnToEarn.${event.reason.type}`,
                                        )} />: {event.amount.toLocaleString()}
                                </p>
                            {:else if event.reason.kind === "referral"}
                                <p>
                                    🤝 <Translatable
                                        resourceKey={i18nKey(
                                            `chitReferralRewardReason.${event.reason.type}`,
                                        )} />: {event.amount.toLocaleString()}
                                </p>
                            {:else if event.reason.kind === "meme_contest_winner"}
                                <p>{`🏆️ Meme contest win: ${event.amount.toLocaleString()}`}</p>
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

        &.otherMonth {
            background: var(--button-disabled);
            color: var(--button-disabled-txt);
            &:hover {
                background-color: var(--button-disabled);
            }
        }
    }

    .tt {
        text-align: start;
        @include font(book, normal, fs-100);
        padding: $sp3;
    }
</style>

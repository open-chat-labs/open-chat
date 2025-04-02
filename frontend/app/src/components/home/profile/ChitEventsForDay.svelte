<script lang="ts">
    import type { ChitEarned } from "openchat-client";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";

    interface Props {
        events: ChitEarned[];
        day: Date;
        selectedMonth: number;
    }

    let { events, day, selectedMonth }: Props = $props();

    let otherMonth = $derived(day.getMonth() !== selectedMonth);
</script>

{#if events.length === 0}
    <div class="day">{day.getDate()}</div>
{:else}
    <div class="day has-events" class:otherMonth>
        <Tooltip fill position="top" align={$mobileWidth ? "middle" : "end"}>
            {day.getDate()}
            {#snippet popupTemplate()}
                <div class="tt">
                    {#each events as event}
                        {#if event.reason.kind === "daily_claim" || event.reason.kind === "daily_claim_reinstated"}
                            <p>{`🚀 Daily claim: ${event.amount.toLocaleString()}`}</p>
                        {:else if event.reason.kind === "achievement_unlocked"}
                            <p>
                                🔓 <Translatable
                                    resourceKey={i18nKey(`learnToEarn.${event.reason.type}`)} />: {event.amount.toLocaleString()}
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
                        {:else if event.reason.kind === "external_achievement_unlocked"}
                            <p>
                                🔓 <Translatable resourceKey={i18nKey(event.reason.name)} />: {event.amount.toLocaleString()}
                            </p>
                        {/if}
                    {/each}
                </div>
            {/snippet}
        </Tooltip>
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

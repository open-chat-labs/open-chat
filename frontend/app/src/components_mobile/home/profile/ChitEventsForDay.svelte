<script lang="ts">
    import { mobileWidth, type ChitEvent } from "openchat-client";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        events: ChitEvent[];
        day: Date;
        selectedMonth: number;
        utcMode: boolean;
    }

    let { events, day, selectedMonth, utcMode }: Props = $props();

    let otherMonth = $derived(day.getMonth() !== selectedMonth);
</script>

{#snippet eventtime(t: string)}
    <span class="time">({t})</span>
{/snippet}

{#if events.length === 0}
    <div class="day">{day.getDate()}</div>
{:else}
    <div class="day has-events" class:otherMonth>
        <Tooltip autoWidth fill position="top" align={$mobileWidth ? "middle" : "end"}>
            {day.getDate()}
            {#snippet popupTemplate()}
                <div class="tt">
                    {#each events as event}
                        {@const time = new Date(Number(event.timestamp))}
                        {@const timeStr = utcMode
                            ? time.toLocaleTimeString("en-GB", { timeZone: "UTC" })
                            : time.toLocaleTimeString()}
                        {#if event.reason.kind === "daily_claim" || event.reason.kind === "daily_claim_reinstated" || event.reason.kind === "streak_insurance_claim"}
                            <p>
                                {`🚀 Daily claim: ${event.amount.toLocaleString()}`}
                                {@render eventtime(timeStr)}
                            </p>
                        {:else if event.reason.kind === "achievement_unlocked"}
                            <p>
                                🥳 <Translatable
                                    resourceKey={i18nKey(`learnToEarn.${event.reason.type}`)} />: {event.amount.toLocaleString()}
                                {@render eventtime(timeStr)}
                            </p>
                        {:else if event.reason.kind === "purchased_premium_item"}
                            <p>
                                🤑 <Translatable resourceKey={i18nKey("premiumItem.purchased")} />: {event.amount.toLocaleString()}
                                {@render eventtime(timeStr)}
                            </p>
                        {:else if event.reason.kind === "referral"}
                            <p>
                                🤝 <Translatable
                                    resourceKey={i18nKey(
                                        `chitReferralRewardReason.${event.reason.type}`,
                                    )} />: {event.amount.toLocaleString()}
                                {@render eventtime(timeStr)}
                            </p>
                        {:else if event.reason.kind === "meme_contest_winner"}
                            <p>
                                {`🏆️ Meme contest win: ${event.amount.toLocaleString()}`}
                                {@render eventtime(timeStr)}
                            </p>
                        {:else if event.reason.kind === "external_achievement_unlocked"}
                            <p>
                                🔓 <Translatable resourceKey={i18nKey(event.reason.name)} />: {event.amount.toLocaleString()}
                                {@render eventtime(timeStr)}
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
        margin: var(--sp-xs);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--rad-circle);

        &.has-events {
            background: var(--primary);
            color: var(--text-on-primary);
            transition: background-color 300ms ease-in-out;
        }

        &.otherMonth {
            background: none;
            color: var(--text-secondary);
        }
    }

    .tt {
        text-align: start;
        @include font(book, normal, fs-100);
        padding: $sp3;
    }

    .time {
        @include font(book, normal, fs-60);
    }
</style>

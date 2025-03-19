<script lang="ts">
    import {
        OpenChat,
        type ChitEarned,
        chitStateStore as chitState,
        currentUser as user,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { isSameDay } from "../../calendar/utils";
    import ChitEventsForDay from "./ChitEventsForDay.svelte";
    import ChitBalance from "./ChitBalance.svelte";
    import Toggle from "../../Toggle.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { chitPopup, disableChit, hideChitIcon, utcMode } from "../../../stores/settings";
    import Translatable from "../../Translatable.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import { calendarState, type DateRange } from "../../calendar/calendarState.svelte";
    import Calendar from "../../calendar/Calendar.svelte";

    const client = getContext<OpenChat>("client");
    let events = $state<ChitEarned[]>([]);

    let streak = $derived(client.getStreak($user.userId));
    let totalEarned = $derived(
        events.reduce((total, ev) => {
            const eventDate = new Date(Number(ev.timestamp));
            if (eventDate.getMonth() === calendarState.selectedMonth) {
                total = total + ev.amount;
            }
            return total;
        }, 0),
    );

    function offset(date: Date): number {
        return date.getTimezoneOffset() * 60000;
    }

    function utcToLocal(utc: number): number {
        const utcDate = new Date(utc);
        return new Date(utc + offset(utcDate)).getTime();
    }

    function localToUtc(date: Date): Date {
        return new Date(date.getTime() - offset(date));
    }

    function chitEventsForDay(events: ChitEarned[], date: Date): ChitEarned[] {
        return events.filter((e) => {
            const eventDate = new Date(Number(e.timestamp));
            return isSameDay(date, eventDate);
        });
    }

    function changeMode() {
        dateSelected(calendarState.selectedRange);
    }

    function dateSelected(selection: DateRange) {
        let [from, to] = selection.range;

        if (utcMode) {
            // our date range will be in local dates. If we are in utc mode, we need to ask for
            // the corresponding utc date range
            from = localToUtc(from);
            to = localToUtc(to);
        }

        client
            .chitEvents({
                kind: "getChitEvents",
                from: BigInt(from.getTime()),
                to: BigInt(to.getTime()),
                max: 100,
                ascending: true,
            })
            .then((resp) => {
                if (utcMode) {
                    events = resp.events.map((ev) => ({
                        ...ev,
                        timestamp: BigInt(utcToLocal(Number(ev.timestamp))),
                    }));
                } else {
                    events = resp.events;
                }
            });
    }
</script>

<div use:menuCloser class="chit-events">
    {#if !$disableChit}
        <div class="header">
            {#if streak > 0}
                <div class="streak">
                    You are on a
                    <div class="streak-txt">{streak}</div>
                    day streak!
                </div>
            {/if}
            <ChitBalance
                size={"large"}
                me
                balance={$chitState.chitBalance}
                totalEarned={$chitState.totalChitEarned} />
        </div>
        <Calendar {dateSelected}>
            {#snippet monthTitleTemplate()}
                <div class="month-title">
                    <div class="month">{calendarState.monthTitle}</div>
                    <div class="chit-earned">{totalEarned.toLocaleString()} CHIT</div>
                </div>
            {/snippet}
            {#snippet dayTemplate(day)}
                <ChitEventsForDay
                    {day}
                    selectedMonth={calendarState.selectedMonth}
                    events={chitEventsForDay(events, day)} />
            {/snippet}
        </Calendar>

        <Toggle
            id={"utc-mode"}
            on:change={changeMode}
            small
            label={i18nKey("dailyChit.utcMode")}
            bind:checked={$utcMode} />

        <div class="utc">
            <Translatable resourceKey={i18nKey("dailyChit.utcInfo")} />
        </div>

        <Toggle
            id={"chit-popup"}
            small
            on:change={() => chitPopup.set(!$chitPopup)}
            label={i18nKey("learnToEarn.showChitPopup")}
            checked={$chitPopup} />

        <Toggle
            id={"hide-chit-icon"}
            small
            on:change={() => hideChitIcon.set(!$hideChitIcon)}
            label={i18nKey("dailyChit.hideWhenClaimed")}
            checked={$hideChitIcon} />
    {/if}

    <Toggle
        id={"disable-chit"}
        small
        on:change={() => disableChit.set(!$disableChit)}
        label={i18nKey("hideChit")}
        checked={$disableChit} />
</div>

<style lang="scss">
    .chit-events {
        display: flex;
        flex-direction: column;
        padding: $sp5 $sp5 0 $sp5;
        @include nice-scrollbar();
        @include mobile() {
            padding: $sp4 $sp4 0 $sp4;
        }
    }

    .header {
        border: var(--bw) solid var(--bd);
        border-bottom: none;
        display: flex;
        flex-direction: column;
        padding: $sp5 0;
        gap: $sp3;
    }

    .streak {
        padding: $sp3;
        display: flex;
        justify-content: center;
        gap: 12px;
        align-items: center;
    }

    .streak-txt {
        @include font(bold, normal, fs-160);
        color: var(--accent);
    }

    .chit-earned {
        text-align: center;
        color: var(--txt-light);
        @include font(book, normal, fs-60);
    }

    .utc {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }
</style>

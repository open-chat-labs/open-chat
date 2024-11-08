<script context="module" lang="ts">
    export type DateRange = { date: Date; range: [Date, Date] };
    export const title = writable("");
    export const month = writable(0);
    export const selectedRange = writable<DateRange>({
        date: new Date(),
        range: [new Date(), new Date()],
    });
</script>

<script lang="ts">
    import { locale } from "svelte-i18n";
    import { getMonthCalendar, getTitleText, isSameDay } from "./utils";
    import NextIcon from "svelte-material-icons/ChevronRight.svelte";
    import PrevIcon from "svelte-material-icons/ChevronLeft.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher, onMount } from "svelte";
    import { translationCodes } from "../../i18n/i18n";
    import { weekDays } from "./weekdays";
    import { writable } from "svelte/store";

    const dispatch = createEventDispatcher();

    let today = new Date();
    let showDate = new Date();
    let dates: Date[][] = [];

    $: translatedLocale = translationCodes[$locale || "en"] || "en";
    $: {
        getDates(showDate);
    }

    onMount(() => getDates(showDate));

    function endOfDay(date: Date): Date {
        return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    function getDates(start: Date) {
        const resp = getMonthCalendar(start);
        title.set(getTitleText(resp.year, resp.month, translatedLocale));
        dates = resp.dates;
        month.set(resp.month);
        const allDates = resp.dates.flatMap((d) => d);
        const finalDay = allDates[allDates.length - 1];
        const range: DateRange = {
            date: start,
            range: [allDates[0], endOfDay(finalDay)],
        };
        selectedRange.set(range);
        dispatch("dateSelected", range);
    }

    function previousMonth() {
        const year = showDate.getFullYear();
        const month = showDate.getMonth();
        if (month - 1 < 0) {
            showDate = new Date(year - 1, 11, 1);
        } else {
            showDate = new Date(year, month - 1, 1);
        }
    }
    function nextMonth() {
        const year = showDate.getFullYear();
        const month = showDate.getMonth();
        if (month + 1 > 11) {
            showDate = new Date(year + 1, 0, 1);
        } else {
            showDate = new Date(year, month + 1, 1);
        }
    }
</script>

<div class={"calendar-wrapper"}>
    <div class="calendar-header">
        <HoverIcon onclick={previousMonth}>
            <PrevIcon size={$iconSize} color={"var(--icon-txt"} />
        </HoverIcon>
        <slot name="month-title">
            <h3>{$title}</h3>
        </slot>
        <HoverIcon onclick={nextMonth}>
            <NextIcon size={$iconSize} color={"var(--icon-txt"} />
        </HoverIcon>
    </div>
    <div class="week-days-row">
        {#each $weekDays as [day, d]}
            <div title={day} class="block weekday-name-block">
                {d}
            </div>
        {/each}
    </div>
    <div class="daily-date-container">
        {#each dates as week}
            <div class="week-row">
                {#each week as day}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        class:disabled={day.getMonth() !== $month}
                        class:today={typeof day === "string" ? false : isSameDay(today, day)}
                        class="block daily-date-block pointer">
                        <slot {day}>
                            {day.getDate()}
                        </slot>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

<style lang="scss">
    .calendar-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        border-radius: var(--rd);
        margin-bottom: $sp4;
    }

    .block {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: toRem(50);
        @include font(medium, normal, fs-100);
        flex-grow: 0;
        flex-shrink: 0;
        border-left: var(--bw) solid var(--bd);
        border-bottom: var(--bw) solid var(--bd);

        &:last-child {
            border-right: var(--bw) solid var(--bd);
        }
    }

    .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp4;
        border: solid var(--bw) var(--bd);
    }

    .week-days-row,
    .week-row {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
    }

    .weekday-name-block,
    .daily-date-block {
        width: calc(100% / 7);
        font-variant-numeric: tabular-nums;
    }

    .daily-date-block {
        transition: background 0.25s ease-in-out;
        &:hover:not(.disabled) {
            background: rgba(255, 255, 255, 0.1);
        }
    }

    .today {
        font-weight: 700;
        text-decoration: underline;
    }

    .disabled {
        color: var(--txt-light);
    }

    .weekday-name-block {
        font-weight: bold;
    }

    .pointer {
        cursor: pointer;
    }
</style>

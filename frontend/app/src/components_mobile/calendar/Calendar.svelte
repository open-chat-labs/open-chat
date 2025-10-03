<script lang="ts">
    import { Container, Subtitle } from "component-lib";
    import { type Snippet } from "svelte";
    import { locale } from "svelte-i18n";
    import PrevIcon from "svelte-material-icons/ChevronLeft.svelte";
    import NextIcon from "svelte-material-icons/ChevronRight.svelte";
    import { translationCodes } from "../../i18n/i18n";
    import HoverIcon from "../HoverIcon.svelte";
    import { calendarState, type DateRange } from "./calendarState.svelte";
    import { getMonthCalendar, getTitleText, isSameDay } from "./utils";
    import { weekDays } from "./weekdays";

    interface Props {
        monthTitleTemplate?: Snippet;
        dayTemplate?: Snippet<[Date]>;
        dateSelected?: (range: DateRange) => void;
    }

    let { monthTitleTemplate, dayTemplate, dateSelected }: Props = $props();

    let today = $state(new Date());
    let showDate = $state(new Date());
    let dates = $state<Date[][]>([]);
    let translatedLocale = $derived(translationCodes[$locale || "en"] || "en");

    $effect(() => getDates(showDate));

    function endOfDay(date: Date): Date {
        return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    function getDates(start: Date) {
        console.log("Getting dates for start date: ", start);
        const resp = getMonthCalendar(start);
        calendarState.monthTitle = getTitleText(resp.year, resp.month, translatedLocale);
        dates = resp.dates;
        calendarState.selectedMonth = resp.month;
        const allDates = resp.dates.flatMap((d) => d);
        const finalDay = allDates[allDates.length - 1];
        const range: DateRange = {
            date: start,
            range: [allDates[0], endOfDay(finalDay)],
        };
        calendarState.selectedRange = range;
        dateSelected?.(range);
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
    <Container crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
        <HoverIcon onclick={previousMonth}>
            <PrevIcon size={"2rem"} color={"var(--primary"} />
        </HoverIcon>
        {#if monthTitleTemplate}
            {@render monthTitleTemplate()}
        {:else}
            <Subtitle width={{ kind: "hug" }} fontWeight={"bold"}>
                {calendarState.monthTitle}
            </Subtitle>
        {/if}
        <HoverIcon onclick={nextMonth}>
            <NextIcon size={"2rem"} color={"var(--primary"} />
        </HoverIcon>
    </Container>
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
                    <div
                        class:disabled={day.getMonth() !== calendarState.selectedMonth}
                        class:today={typeof day === "string" ? false : isSameDay(today, day)}
                        class="block daily-date-block pointer">
                        {#if dayTemplate}
                            {@render dayTemplate(day)}
                        {:else}
                            {day.getDate()}
                        {/if}
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
        margin-bottom: $sp4;
    }

    .block {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 2.5rem;
        @include font(medium, normal, fs-100);
        flex-grow: 0;
        flex-shrink: 0;
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
    }

    .disabled {
        color: var(--text-secondary);
    }

    .weekday-name-block {
        font-weight: bold;
    }

    .pointer {
        cursor: pointer;
    }
</style>

<script lang="ts">
    import { locale } from "svelte-i18n";
    import { getMonthCalendar, getTitleText, isSameDay, weekDay } from "./utils";
    import NextIcon from "svelte-material-icons/ChevronRight.svelte";
    import PrevIcon from "svelte-material-icons/ChevronLeft.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";

    export let date: Date;

    let today = new Date();

    $: showDate = date || new Date();
    $: ({ year, month, dates } = getMonthCalendar(showDate));
    $: title = getTitleText(year, month, $locale ?? "default");

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
        <HoverIcon on:click={previousMonth}>
            <PrevIcon size={$iconSize} color={"var(--icon-txt"} />
        </HoverIcon>
        <h3>{title}</h3>
        <HoverIcon on:click={nextMonth}>
            <NextIcon size={$iconSize} color={"var(--icon-txt"} />
        </HoverIcon>
    </div>
    <div class="week-days-row">
        {#each weekDay as d}
            <div class="block weekday-name-block">
                {d.charAt(0).toUpperCase()}
            </div>
        {/each}
    </div>
    <div class="daily-date-container">
        {#each dates as week}
            <div class="week-row">
                {#each week as day, d}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        class:disabled={day.getMonth() !== month}
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
        @include box-shadow(2);
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

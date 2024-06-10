<script lang="ts">
    import { getMonthCalendar, isSameDay, weekDay } from "./utils";
    import NextIcon from "svelte-material-icons/ChevronRight.svelte";
    import PrevIcon from "svelte-material-icons/ChevronLeft.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";

    export let date: Date;

    let today = new Date();
    $: showDate = date || new Date();
    $: ({ month, year, daysDistribution } = getMonthCalendar(showDate));

    function previousMonth() {
        const currYear = showDate.getFullYear();
        const currMonth = showDate.getMonth();
        if (currMonth - 1 < 0) {
            showDate = new Date(currYear - 1, 11, 1);
        } else {
            showDate = new Date(currYear, currMonth - 1, 1);
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
        <h3>Chit earned</h3>
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
        {#each daysDistribution as week}
            <div class="week-row">
                {#each week as day, d}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        class:today={typeof day === "string"
                            ? false
                            : isSameDay(today, new Date(year, month, day))}
                        class="block daily-date-block pointer">
                        {day}
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
        border-radius: 4px;
        @include box-shadow(3);
    }

    .block {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        @include font(medium, normal, fs-100);
        transition: border-color 0.25s;
        flex-grow: 0;
        flex-shrink: 0;
        border-left: 1px solid var(--bd);
        border-bottom: 1px solid var(--bd);

        &:last-child {
            border-right: 1px solid var(--bd);
        }
    }

    .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
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
    .today {
        background-color: var(--accent);
    }
    .weekday-name-block {
        font-weight: bold;
    }

    .pointer {
        cursor: pointer;
    }
</style>

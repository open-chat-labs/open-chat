<script lang="ts">
    import CollapsibleCard from "@src/desktop/shared/CollapsibleCard.svelte";
    import { menuCloser } from "component-lib";
    import { chitStateStore, OpenChat, type ChitEvent } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { chitPopup, disableChit, hideChitIcon, utcMode } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import Calendar from "@src/desktop/features/calendar/Calendar.svelte";
    import { calendarState, type DateRange } from "@src/desktop/features/calendar/calendarState.svelte";
    import { isSameDay } from "@src/ui/calendarUtils";
    import Toggle from "@src/desktop/shared/Toggle.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import StreakInsuranceSummary from "@src/desktop/features/access/insurance/StreakInsuranceSummary.svelte";
    import ChitBalance from "./ChitBalance.svelte";
    import ChitEventsForDay from "./ChitEventsForDay.svelte";

    const client = getContext<OpenChat>("client");
    let events = $state<ChitEvent[]>([]);

    let streak = $derived($chitStateStore.streakEnds < $now500 ? 0 : $chitStateStore.streak);
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

    function localToUtc(date: Date): Date {
        return new Date(date.getTime() + offset(date));
    }

    function chitEventsForDay(events: ChitEvent[], date: Date): ChitEvent[] {
        return events.filter((e) => {
            let eventDate = new Date(Number(e.timestamp));
            if ($utcMode) {
                eventDate = localToUtc(eventDate);
            }
            return isSameDay(date, eventDate);
        });
    }

    function changeMode() {
        dateSelected(calendarState.selectedRange);
    }

    function dateSelected(selection: DateRange) {
        let [from, to] = selection.range;

        if ($utcMode) {
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
                events = resp.events;
            });
    }
</script>

<div use:menuCloser class="chit-events">
    {#if !$disableChit}
        <div class="chit-stuff">
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
                    chitBalance={$chitStateStore.chitBalance}
                    totalEarned={$chitStateStore.totalChitEarned} />
            </div>
            {#if streak > 0}
                <CollapsibleCard headerText={i18nKey("streakInsurance.title")}>
                    <StreakInsuranceSummary />
                </CollapsibleCard>
            {/if}
            <CollapsibleCard headerText={i18nKey("dailyChit.events")}>
                <Calendar {dateSelected}>
                    {#snippet monthTitleTemplate()}
                        <div class="month-title">
                            <div class="month">{calendarState.monthTitle}</div>
                            <div class="chit-earned">{totalEarned.toLocaleString()} CHIT</div>
                        </div>
                    {/snippet}
                    {#snippet dayTemplate(day)}
                        <ChitEventsForDay
                            utcMode={$utcMode}
                            {day}
                            selectedMonth={calendarState.selectedMonth}
                            events={chitEventsForDay(events, day)} />
                    {/snippet}
                </Calendar>
                <Toggle
                    id={"utc-mode"}
                    onChange={changeMode}
                    small
                    label={i18nKey("dailyChit.utcMode")}
                    bind:checked={$utcMode} />
                <div class="info">
                    <Translatable resourceKey={i18nKey("dailyChit.utcInfo")} />
                </div>
            </CollapsibleCard>
            <CollapsibleCard headerText={i18nKey("dailyChit.settings")}>
                <Toggle
                    id={"chit-popup"}
                    small
                    onChange={() => chitPopup.set(!$chitPopup)}
                    label={i18nKey("learnToEarn.showChitPopup")}
                    checked={$chitPopup} />
                <Toggle
                    id={"hide-chit-icon"}
                    small
                    onChange={() => hideChitIcon.set(!$hideChitIcon)}
                    label={i18nKey("dailyChit.hideWhenClaimed")}
                    checked={$hideChitIcon} />
            </CollapsibleCard>
        </div>
    {/if}

    <Toggle
        id={"disable-chit"}
        small
        onChange={() => disableChit.set(!$disableChit)}
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
        display: flex;
        flex-direction: column;
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

    .info {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }

    .chit-stuff {
        margin-bottom: $sp4;
    }
</style>

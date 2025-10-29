<script lang="ts">
    import { isSameDay } from "@src/components/calendar/utils";
    import { i18nKey } from "@src/i18n/i18n";
    import { chitPopup, disableChit, utcMode } from "@src/stores/settings";
    import { Body, BodySmall, Button, Container, H1, Subtitle, Switch } from "component-lib";
    import { chitStateStore, OpenChat, type ChitEvent } from "openchat-client";
    import { getContext } from "svelte";
    import FlashOutline from "svelte-material-icons/FlashOutline.svelte";
    import Calendar from "../../calendar/Calendar.svelte";
    import { calendarState, type DateRange } from "../../calendar/calendarState.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import StreakInsuranceBuy from "../insurance/StreakInsuranceBuy.svelte";
    import ChitEventsForDay from "../profile/ChitEventsForDay.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import ChitSummary from "./ChitSummary.svelte";

    const client = getContext<OpenChat>("client");

    let showInsurance = $state(false);

    let events = $state<ChitEvent[]>([]);

    let totalEarned = $derived(
        events.reduce((total, ev) => {
            const eventDate = new Date(Number(ev.timestamp));
            if (eventDate.getMonth() === calendarState.selectedMonth) {
                total = total + ev.amount;
            }
            return total;
        }, 0),
    );

    function changeMode() {
        dateSelected(calendarState.selectedRange);
    }

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

{#if showInsurance}
    <StreakInsuranceBuy onClose={() => (showInsurance = false)} />
{/if}

<SlidingPageContent title={i18nKey("CHIT rewards")} subtitle={i18nKey("General options")}>
    <Container
        padding={"xxl"}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container supplementalClass={"streak_title"} gap={"xl"} direction={"vertical"}>
                <H1 width={{ kind: "fixed", size: "70%" }} fontWeight={"bold"} colour={"primary"}>
                    <Translatable
                        resourceKey={i18nKey("You are on a {streak} day streak!", {
                            streak: $chitStateStore.streak,
                        })}></Translatable>
                </H1>

                <Container
                    padding={["sm", "lg", "xl", "zero"]}
                    direction={"vertical"}
                    allowOverflow>
                    <ChitSummary
                        insuranceLink={false}
                        streak={$chitStateStore.streak}
                        earned={$chitStateStore.totalChitEarned}
                        balance={$chitStateStore.chitBalance} />
                </Container>

                <Container
                    padding={["zero", "zero", "md", "zero"]}
                    gap={"md"}
                    direction={"vertical"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Streak insurance")}></Translatable>
                    </Body>

                    <BodySmall colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Insure your day streak in case you're unable to claim on any given day. Press Top-up now button to buy insurance!",
                            )}></Translatable>
                    </BodySmall>

                    <Button onClick={() => (showInsurance = true)}>
                        {#snippet icon(color)}
                            <FlashOutline {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("Top-up now!")}></Translatable>
                    </Button>
                </Container>

                <Setting
                    info={"CHIT is our in-app currency that can be earned by simply using the app. CHIT rewards can then be exchanged for in-app items like emoji packs, or profile backgrounds and themes. If you'd prefer not to see anything CHIT related outside of this settings page you can opt out here."}>
                    <Switch reverse bind:checked={$disableChit}>
                        <Translatable resourceKey={i18nKey("hideChit")}></Translatable>
                    </Switch>
                </Setting>

                <Setting
                    info={"Any time you perform a certain actions that is on the list of achievements, you will get notified. If you would like to opt out of the small celebratory notification, you may do so here. To learn more tap here to view achievements."}>
                    <Switch reverse bind:checked={$chitPopup}>
                        <Translatable resourceKey={i18nKey("Notify me of my CHIT achievements")}
                        ></Translatable>
                    </Switch>
                </Setting>

                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("CHIT claim events")}></Translatable>
                </Body>
                <Calendar {dateSelected}>
                    {#snippet monthTitleTemplate()}
                        <Container
                            width={{ kind: "hug" }}
                            crossAxisAlignment={"center"}
                            direction={"vertical"}>
                            <Subtitle>{calendarState.monthTitle}</Subtitle>
                            <BodySmall colour={"textSecondary"}
                                >{totalEarned.toLocaleString()} CHIT earned</BodySmall>
                        </Container>
                    {/snippet}
                    {#snippet dayTemplate(day)}
                        <ChitEventsForDay
                            utcMode={$utcMode}
                            {day}
                            selectedMonth={calendarState.selectedMonth}
                            events={chitEventsForDay(events, day)} />
                    {/snippet}
                </Calendar>

                <Setting
                    info={"You CHIT claim window should automatically adjust to your own timezone and run from midnight to midnight to midnight. If anything looks odd, you might also want to view the CHIT events calendar in UTC mode."}>
                    <Switch reverse onChange={changeMode} checked={$utcMode}>
                        <Translatable resourceKey={i18nKey("Show in UTC")}></Translatable>
                    </Switch>
                </Setting>
            </Container>
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    :global(.container.streak_title > h1) {
        background: var(--gradient-inverted);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
</style>

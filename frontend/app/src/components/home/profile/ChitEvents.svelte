<script lang="ts">
    import { OpenChat, type ChitEarned } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Calendar from "../../calendar/Calendar.svelte";
    import { isSameDay } from "../../calendar/utils";
    import ChitEventsForDay from "./ChitEventsForDay.svelte";

    const client = getContext<OpenChat>("client");

    let busy = false;
    let events: ChitEarned[] = [];

    onMount(() => {
        // dateSelected(new Date());
    });

    function chitEventsForDay(events: ChitEarned[], date: Date): ChitEarned[] {
        return events.filter((e) => {
            const eventDate = new Date(Number(e.timestamp));
            return isSameDay(date, eventDate);
        });
    }

    function dateSelected(selection: { date: Date; range: [Date, Date] }) {
        const [from, to] = selection.range;

        // TODO - need to prevent race conditions here if this takes some time and
        // the user presses the buttons quickly, we need to make sure that the results actually correlate with the request
        busy = true;
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
            })
            .finally(() => (busy = false));
    }
</script>

<div class="chit-events">
    <Calendar on:dateSelected={(ev) => dateSelected(ev.detail)} {busy} let:day>
        <ChitEventsForDay {day} events={chitEventsForDay(events, day)} />
    </Calendar>
</div>

<style lang="scss">
    .chit-events {
        padding: $sp5 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp4 $sp4 0 $sp4;
        }
    }
</style>

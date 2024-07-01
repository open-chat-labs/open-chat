<script lang="ts">
    import { OpenChat, type ChitEarned } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Calendar from "../../calendar/Calendar.svelte";
    import { isSameDay } from "../../calendar/utils";
    import ChitEventsForDay from "./ChitEventsForDay.svelte";
    import ChitBalance from "./ChitBalance.svelte";
    import Toggle from "../../Toggle.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { chitPopup } from "../../../stores/settings";

    const client = getContext<OpenChat>("client");

    $: user = client.user;
    $: userStore = client.userStore;
    $: streak = $userStore[$user.userId]?.streak ?? 0;
    $: balance = $userStore[$user.userId]?.chitBalance ?? 0;

    let busy = false;
    let events: ChitEarned[] = [];

    onMount(() => {
        // no need to do anything with the result explicitly as it will get added to the store automatically
        client.getUser($user.userId);
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
    <div class="header">
        {#if streak > 0}
            <div class="streak">
                You are on a
                <div class="streak-txt">{streak}</div>
                day streak!
            </div>
        {/if}
        <ChitBalance size={"large"} me {balance} />
    </div>
    <Calendar on:dateSelected={(ev) => dateSelected(ev.detail)} {busy} let:day>
        <ChitEventsForDay {day} events={chitEventsForDay(events, day)} />
    </Calendar>
    <Toggle
        id={"chit-popup"}
        small
        on:change={() => chitPopup.set(!$chitPopup)}
        label={i18nKey("learnToEarn.showChitPopup")}
        checked={$chitPopup} />
</div>

<style lang="scss">
    .chit-events {
        display: flex;
        flex-direction: column;
        padding: $sp5 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp4 $sp4 0 $sp4;
        }
    }

    .header {
        border: var(--bw) solid var(--bd);
        border-bottom: none;
        display: flex;
        flex-direction: column;
        padding-bottom: $sp5;
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
</style>

<script lang="ts">
    import { OpenChat, type ChitEarned } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Calendar from "../../calendar/Calendar.svelte";

    const client = getContext<OpenChat>("client");

    let busy = false;
    let events: ChitEarned[] = [];
    let total = 0;
    let date = new Date();

    onMount(() => {
        busy = true;

        client
            .chitEvents({
                kind: "getChitEvents",
                from: BigInt(Date.now()),
                max: 100,
                ascending: false,
            })
            .then((resp) => {
                events = resp.events;
                total = resp.total;
            })
            .finally(() => (busy = false));
    });
</script>

<div class="chit-events">
    <Calendar {date} />
</div>

<style lang="scss">
    .chit-events {
        padding: $sp5 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp4 $sp4 0 $sp4;
        }
    }
</style>

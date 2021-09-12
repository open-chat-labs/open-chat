<svelte:options immutable={true} />

<script lang="ts">
    import type { PartialUserSummary, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { toLongDateString, toShortTimeString } from "../../utils/date";

    export let user: UserSummary | undefined;
    export let left: PartialUserSummary | undefined;
    export let timestamp: bigint;

    $: me = left?.userId === user?.userId;
    $: username = me ? $_("you") : left?.username ?? $_("unknownUser");
    $: date = new Date(Number(timestamp));
</script>

<div class="participant-left">
    <p>
        {$_("userLeft", {
            values: {
                username: username,
            },
        })}
    </p>
    <p class="timestamp">{`${toLongDateString(date)} @ ${toShortTimeString(date)}`}</p>
</div>

<style type="text/scss">
    .participant-left {
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp5 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);
    }
    .timestamp {
        @include font(light, normal, fs-70);
    }
</style>

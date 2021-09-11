<svelte:options immutable={true} />

<script lang="ts">
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { toLongDateString, toShortTimeString } from "../../utils/date";
    import { getParticipantsString } from "../../domain/chat/chat.utils";

    export let user: UserSummary | undefined;
    export let userLookup: UserLookup;
    export let changedBy: string;
    export let changed: string[];
    export let timestamp: bigint;
    export let resourceKey: string;

    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : userLookup[changedBy]?.username ?? $_("unknownUser");
    $: date = new Date(Number(timestamp));
    $: participants = getParticipantsString(
        user!,
        userLookup,
        changed,
        $_("unknownUser"),
        $_("you")
    );
</script>

<div class="participants-changed">
    <p>
        {$_(resourceKey, {
            values: {
                changed: participants,
                changedBy: changedByStr,
            },
        })}
    </p>
    <p class="timestamp">{`${toLongDateString(date)} @ ${toShortTimeString(date)}`}</p>
</div>

<style type="text/scss">
    .participants-changed {
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

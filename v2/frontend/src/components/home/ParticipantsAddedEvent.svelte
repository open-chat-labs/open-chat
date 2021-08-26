<svelte:options immutable={true} />

<script lang="ts">
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import type { ParticipantsAdded } from "../../domain/chat/chat";
    import { _ } from "svelte-i18n";
    import { toLongDateString, toShortTimeString } from "../../utils/date";
    import { getParticipantsString } from "../../domain/chat/chat.utils";

    export let user: UserSummary | undefined;
    export let userLookup: UserLookup;
    export let event: ParticipantsAdded;
    export let timestamp: bigint;

    $: me = event.addedBy === user?.userId;
    $: addedBy = me ? $_("you") : userLookup[event.addedBy]?.username ?? $_("unknownUser");
    $: date = new Date(Number(timestamp));
    $: participants = getParticipantsString(
        user!,
        userLookup,
        event.userIds,
        $_("unknownUser"),
        $_("you")
    );
</script>

<div class="participants-added">
    <p class="added-by">
        {$_("addedBy", {
            values: {
                added: participants,
                addedBy,
            },
        })}
    </p>
    <p class="created-at">{`${toLongDateString(date)} @ ${toShortTimeString(date)}`}</p>
</div>

<style type="text/scss">
    .participants-added {
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp5 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);
    }
    .created-at {
        @include font(light, normal, fs-70);
    }
</style>

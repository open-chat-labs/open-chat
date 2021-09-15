<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { getParticipantsString } from "../../domain/chat/chat.utils";

    export let user: UserSummary | undefined;
    export let userLookup: UserLookup;
    export let changedBy: string;
    export let changed: string[];
    export let timestamp: bigint;
    export let resourceKey: string;

    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : userLookup[changedBy]?.username ?? $_("unknownUser");
    $: participants = getParticipantsString(
        user!,
        userLookup,
        changed,
        $_("unknownUser"),
        $_("you")
    );

    $: text = $_(resourceKey, {
        values: {
            changed: participants,
            changedBy: changedByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

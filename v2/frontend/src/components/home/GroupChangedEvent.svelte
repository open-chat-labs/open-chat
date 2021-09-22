<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";

    export let user: UserSummary | undefined;
    export let userLookup: UserLookup;
    export let changedBy: string;
    export let property: string;
    export let timestamp: bigint;

    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : userLookup[changedBy]?.username ?? $_("unknownUser");
    $: text = $_("groupChangedBy", {
        values: {
            changed: property,
            changedBy: changedByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

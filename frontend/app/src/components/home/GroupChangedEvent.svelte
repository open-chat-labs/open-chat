<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, UserSummary } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let changedBy: string;
    export let property: string;
    export let timestamp: bigint;
    export let level: string;

    $: userStore = client.userStore;
    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[changedBy]?.username ?? $_("unknownUser");
    $: text = $_("groupChangedBy", {
        values: {
            changed: property,
            changedBy: changedByStr,
            level,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

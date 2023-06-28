<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary, PermissionsChanged, Level } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { interpolateLevel } from "../../utils/i18n";

    const client = getContext<OpenChat>("client");

    export let event: PermissionsChanged;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;
    export let level: Level;

    $: userStore = client.userStore;
    $: me = event.changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[event.changedBy]?.username ?? $_("unknownUser");

    $: text = interpolateLevel("permissionsChangedBy", level, true, {
        changedBy: changedByStr,
    });
</script>

<NonMessageEvent {text} {timestamp} />

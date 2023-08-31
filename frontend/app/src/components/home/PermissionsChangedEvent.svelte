<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary, PermissionsChanged, Level } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { interpolateLevel } from "../../utils/i18n";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let event: PermissionsChanged;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;
    export let level: Level;

    $: userStore = client.userStore;
    $: me = event.changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, event.changedBy, me);

    $: text = interpolateLevel("permissionsChangedBy", level, true, {
        changedBy: changedByStr,
    });
</script>

<NonMessageEvent {text} {timestamp} />

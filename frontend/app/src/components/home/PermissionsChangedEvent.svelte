<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary, PermissionsChanged, Level } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import { i18nKey, interpolate } from "../../i18n/i18n";

    export let event: PermissionsChanged;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;
    export let level: Level;

    $: me = event.changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, event.changedBy, me);

    $: text = interpolate(
        $_,
        i18nKey(
            "permissionsChangedBy",
            {
                changedBy: changedByStr,
            },
            level,
            true,
        ),
    );
</script>

<NonMessageEvent {text} {timestamp} />

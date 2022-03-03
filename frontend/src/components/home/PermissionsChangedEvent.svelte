<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { userStore } from "../../stores/user";
    import type { PermissionsChanged } from "../../domain/chat/chat";

    export let event: PermissionsChanged;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: me = event.changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[event.changedBy]?.username ?? $_("unknownUser");

    $: text = $_("permissionsChangedBy", {
        values: {
            changedBy: changedByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

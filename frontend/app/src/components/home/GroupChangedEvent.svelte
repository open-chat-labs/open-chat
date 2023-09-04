<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let changedBy: string;
    export let property: string;
    export let timestamp: bigint;
    export let level: string;

    $: userStore = client.userStore;
    $: me = changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, changedBy, me);
    $: text = $_("groupChangedBy", {
        values: {
            changed: property,
            changedBy: changedByStr,
            level,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

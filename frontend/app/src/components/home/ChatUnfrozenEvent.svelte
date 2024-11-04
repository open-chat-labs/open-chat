<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import type { ChatUnfrozenEvent } from "openchat-shared";
    import { buildDisplayName } from "../../utils/user";

    export let event: ChatUnfrozenEvent;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: me = event.unfrozenBy === user?.userId;
    $: unfrozenByStr = buildDisplayName($userStore, event.unfrozenBy, me);

    $: text = $_("chatUnfrozenBy", {
        values: {
            unfrozenBy: unfrozenByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

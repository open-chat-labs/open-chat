<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { ChatUnfrozenEvent } from "openchat-shared";

    const client = getContext<OpenChat>("client");

    export let event: ChatUnfrozenEvent;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = event.unfrozenBy === user?.userId;
    $: unfrozenByStr = me ? $_("you") : $userStore[event.unfrozenBy]?.username ?? $_("unknownUser");

    $: text = $_("chatUnfrozenBy", {
        values: {
            unfrozenBy: unfrozenByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

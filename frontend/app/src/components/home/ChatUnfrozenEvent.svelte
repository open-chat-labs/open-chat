<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { ChatUnfrozenEvent } from "openchat-shared";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let event: ChatUnfrozenEvent;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = event.unfrozenBy === user?.userId;
    $: unfrozenByStr = buildDisplayName($userStore, event.unfrozenBy, me);

    $: text = $_("chatUnfrozenBy", {
        values: {
            unfrozenBy: unfrozenByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

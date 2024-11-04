<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import type { ChatFrozenEvent } from "openchat-shared";
    import { buildDisplayName } from "../../utils/user";

    export let event: ChatFrozenEvent;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: me = event.frozenBy === user?.userId;
    $: frozenByStr = buildDisplayName($userStore, event.frozenBy, me);

    $: chatFrozenByText = $_("chatFrozenBy", {
        values: {
            frozenBy: frozenByStr,
        },
    });

    $: text = event.reason
        ? `${chatFrozenByText}\n${$_("reason")}: ${event.reason}`
        : chatFrozenByText;
</script>

<NonMessageEvent {text} {timestamp} />

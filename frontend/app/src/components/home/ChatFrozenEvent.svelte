<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { ChatFrozenEvent } from "openchat-shared";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let event: ChatFrozenEvent;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: userStore = client.userStore;
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

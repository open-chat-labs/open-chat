<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, GroupChatCreated } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let me: boolean;
    export let event: GroupChatCreated;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: username = me ? $_("you") : $userStore[event.created_by]?.username ?? $_("unknownUser");
    $: text = $_("groupCreatedBy", {
        values: {
            username: username,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

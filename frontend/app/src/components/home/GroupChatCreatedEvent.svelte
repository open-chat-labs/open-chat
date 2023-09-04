<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, GroupChatCreated, ChatType } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let me: boolean;
    export let event: GroupChatCreated;
    export let timestamp: bigint;
    export let chatType: ChatType;

    $: level = $_(`level.${chatType === "channel" ? "channel" : "group"}`).toLowerCase();
    $: userStore = client.userStore;
    $: username = buildDisplayName($userStore, event.created_by, me);
    $: text = $_("groupCreatedBy", {
        values: {
            username,
            level,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

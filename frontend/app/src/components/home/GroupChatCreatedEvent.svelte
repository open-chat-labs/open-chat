<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import type { GroupChatCreated, ChatType } from "openchat-client";
    import { userStore } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    export let me: boolean;
    export let event: GroupChatCreated;
    export let timestamp: bigint;
    export let chatType: ChatType;

    $: level = $_(`level.${chatType === "channel" ? "channel" : "group"}`).toLowerCase();
    $: username = buildDisplayName($userStore, event.created_by, me);
    $: text = $_("groupCreatedBy", {
        values: {
            username,
            level,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserLookup } from "../../domain/user/user";
    import type { GroupChatCreated } from "../../domain/chat/chat";
    import { _ } from "svelte-i18n";

    export let userLookup: UserLookup;
    export let me: boolean;
    export let event: GroupChatCreated;
    export let timestamp: bigint;

    $: username = me ? $_("you") : userLookup[event.created_by].username ?? $_("unknownUser");
    $: text = $_("groupCreatedBy", {
        values: {
            username: username,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

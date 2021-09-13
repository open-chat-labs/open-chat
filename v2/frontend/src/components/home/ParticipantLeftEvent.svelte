<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { PartialUserSummary, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";

    export let user: UserSummary | undefined;
    export let left: PartialUserSummary | undefined;
    export let timestamp: bigint;

    $: me = left?.userId === user?.userId;
    $: username = me ? $_("you") : left?.username ?? $_("unknownUser");
    $: date = new Date(Number(timestamp));
    $: text = $_("userLeft", {
        values: {
            username: username,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

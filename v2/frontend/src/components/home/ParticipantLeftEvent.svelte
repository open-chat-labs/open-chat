<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { PartialUserSummary, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";

    export let user: UserSummary | undefined;
    export let subject: PartialUserSummary | undefined;
    export let timestamp: bigint;
    export let label: string;

    $: me = subject?.userId === user?.userId;
    $: username = me ? $_("you") : subject?.username ?? $_("unknownUser");
    $: text = $_(label, {
        values: {
            username: username,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

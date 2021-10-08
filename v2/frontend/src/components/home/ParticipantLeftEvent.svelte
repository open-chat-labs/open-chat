<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";

    export let user: UserSummary | undefined;
    export let subjectId: string | undefined;
    export let timestamp: bigint;
    export let label: string;

    let subject = subjectId ? getContext<UserLookup>("userLookup")[subjectId] : undefined;

    $: me = subject?.userId === user?.userId;
    $: username = me ? $_("you") : subject?.username ?? $_("unknownUser");
    $: text = $_(label, {
        values: {
            username: username,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let nowPublic: boolean;
    export let changedBy: string;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[changedBy]?.username ?? $_("unknownUser");
    $: visibility = (nowPublic ? $_("public") : $_("private")).toLowerCase();
    $: text = $_("groupVisibilityChangedBy", {
        values: {
            changedBy: changedByStr,
            visibility: visibility,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

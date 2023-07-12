<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary, GroupInviteCodeChange, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let change: GroupInviteCodeChange;
    export let changedBy: string;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[changedBy]?.username ?? $_("unknownUser");
    $: changedStr = $_(`invite.${change}`);
    $: text = $_("groupInviteChangedBy", {
        values: {
            changedBy: changedByStr,
            changed: changedStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

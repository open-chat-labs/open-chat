<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary, GroupInviteCodeChange, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let change: GroupInviteCodeChange;
    export let changedBy: string;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, changedBy, me);
    $: changedStr = $_(`invite.${change}`);
    $: text = $_("groupInviteChangedBy", {
        values: {
            changedBy: changedByStr,
            changed: changedStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

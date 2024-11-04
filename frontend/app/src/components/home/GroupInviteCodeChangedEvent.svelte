<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary, GroupInviteCodeChange } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";

    export let user: UserSummary | undefined;
    export let change: GroupInviteCodeChange;
    export let changedBy: string;
    export let timestamp: bigint;

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

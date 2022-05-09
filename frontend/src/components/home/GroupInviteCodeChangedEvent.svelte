<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { userStore } from "../../stores/user";
    import type { GroupInviteChange } from "../../domain/chat/chat";

    export let user: UserSummary | undefined;
    export let change: GroupInviteChange;
    export let changedBy: string;
    export let timestamp: bigint;

    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[changedBy]?.username ?? $_("unknownUser");
    $: changedStr = $_(`group.invite.${change}`);
    $: text = $_("groupInviteChangedBy", {
        values: {
            changedBy: changedByStr,
            changed: changedStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

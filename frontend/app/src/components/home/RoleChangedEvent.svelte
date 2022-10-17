<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary, RoleChanged } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let event: RoleChanged;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = event.changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[event.changedBy]?.username ?? $_("unknownUser");
    $: members = client.getMembersString(
        user!,
        $userStore,
        event.userIds,
        $_("unknownUser"),
        $_("you"),
        user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername
    );
    $: meChanged = event.userIds.length == 1 && event.userIds[0] === user?.userId;

    $: text = $_(meChanged ? "yourRoleChanged" : "roleChanged", {
        values: {
            changed: members,
            changedBy: changedByStr,
            oldRole: $_(event.oldRole),
            newRole: $_(event.newRole),
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

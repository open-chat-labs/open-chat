<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { getMembersString } from "../../domain/chat/chat.utils";
    import { compareIsNotYouThenUsername, compareUsername } from "../../domain/user/user.utils";
    import { userStore } from "../../stores/user";
    import type { RoleChanged } from "../../domain/chat/chat";

    export let event: RoleChanged;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: me = event.changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[event.changedBy]?.username ?? $_("unknownUser");
    $: members = getMembersString(
        user!,
        $userStore,
        event.userIds,
        $_("unknownUser"),
        $_("you"),
        user ? compareIsNotYouThenUsername(user.userId) : compareUsername
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

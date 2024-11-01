<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { OpenChat, UserSummary, RoleChanged, MemberRole } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let event: RoleChanged;
    export let user: UserSummary | undefined;
    export let timestamp: bigint;

    $: me = event.changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, event.changedBy, me);
    $: members = client.getMembersString(
        user!,
        $userStore,
        event.userIds,
        $_("unknownUser"),
        $_("you"),
        user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername,
    );
    $: meChanged = event.userIds.length == 1 && event.userIds[0] === user?.userId;
    $: visible = me || meChanged || !isDemotion(event.oldRole, event.newRole);

    $: text = $_(meChanged ? "yourRoleChanged" : "roleChanged", {
        values: {
            changed: members,
            changedBy: changedByStr,
            oldRole: $_(event.oldRole),
            newRole: $_(event.newRole),
        },
    });

    function isDemotion(oldRole: MemberRole, newRole: MemberRole): boolean {
        return (
            newRole == "none" ||
            newRole == "member" ||
            oldRole == "owner" ||
            (newRole === "moderator" && oldRole !== "member") ||
            (oldRole === "admin" && newRole !== "owner")
        );
    }
</script>

{#if visible}
    <NonMessageEvent {text} {timestamp} />
{/if}

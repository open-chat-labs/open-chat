<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let invitedBy: string;
    export let usersIds: string[];
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = invitedBy === user?.userId;
    $: invitedByStr = `**${
        me ? $_("you") : $userStore[invitedBy]?.username ?? $_("unknownUser")
    }**`;
    $: users = client.getMembersString(
        user!,
        $userStore,
        usersIds,
        $_("unknownUser"),
        $_("you"),
        user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername
    );

    $: text = $_("invitedBy", {
        values: {
            users,
            invitedBy: invitedByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

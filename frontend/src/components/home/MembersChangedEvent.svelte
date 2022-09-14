<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { getMembersString } from "../../domain/chat/chat.utils";
    import { compareIsNotYouThenUsername, compareUsername } from "../../domain/user/user.utils";
    import { userStore } from "../../stores/user";

    export let user: UserSummary | undefined;
    export let changedBy: string;
    export let changed: string[];
    export let timestamp: bigint;
    export let resourceKey: string;

    $: me = changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[changedBy]?.username ?? $_("unknownUser");
    $: members = getMembersString(
        user!,
        $userStore,
        changed,
        $_("unknownUser"),
        $_("you"),
        user ? compareIsNotYouThenUsername(user.userId) : compareUsername
    );

    $: text = $_(resourceKey, {
        values: {
            changed: members,
            changedBy: changedByStr,
        },
    });
</script>

<NonMessageEvent {text} {timestamp} />

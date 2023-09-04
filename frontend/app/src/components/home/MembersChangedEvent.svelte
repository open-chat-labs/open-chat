<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { Level, UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { interpolateLevel } from "../../utils/i18n";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let changedBy: string;
    export let changed: string[];
    export let timestamp: bigint;
    export let resourceKey: string;
    export let level: Level;

    $: userStore = client.userStore;
    $: me = changedBy === user?.userId;
    $: changedByStr = `**${buildDisplayName($userStore, changedBy, me)}**`;
    $: members = client.getMembersString(
        user!,
        $userStore,
        changed,
        $_("unknownUser"),
        $_("you"),
        user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername
    );

    $: text = interpolateLevel(resourceKey, level, true, {
        changed: members,
        changedBy: changedByStr,
    });
</script>

<NonMessageEvent {text} {timestamp} />

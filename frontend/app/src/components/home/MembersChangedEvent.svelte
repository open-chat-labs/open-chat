<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { Level, UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";
    import { i18nKey, interpolate } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let changedBy: string;
    export let changed: string[];
    export let timestamp: bigint;
    export let resourceKey: string;
    export let level: Level;

    $: me = changedBy === user?.userId;
    $: changedByStr = `**${buildDisplayName($userStore, changedBy, me)}**`;
    $: members = client.getMembersString(
        user!,
        $userStore,
        changed,
        $_("unknownUser"),
        $_("you"),
        user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername,
    );

    $: text = interpolate(
        $_,
        i18nKey(
            resourceKey,
            {
                changed: members,
                changedBy: changedByStr,
            },
            level,
            true,
        ),
    );
</script>

<NonMessageEvent {text} {timestamp} />

<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { Level, OpenChat, UserSummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { buildDisplayName } from "../../utils/user";
    import { i18nKey, interpolate } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let isPublic: boolean | undefined;
    export let messagesVisibleToNonMembers: boolean | undefined;
    export let changedBy: string;
    export let timestamp: bigint;
    export let level: Level;

    $: showEvent = messagesVisibleToNonMembers !== undefined || isPublic !== undefined;
    $: userStore = client.userStore;
    $: me = changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, changedBy, me);
    $: text = interpolate(
        $_,
        i18nKey(
            "groupVisibilityChangedBy",
            {
                changedBy: changedByStr,
            },
            level,
            true,
        ),
    );
</script>

{#if showEvent}
    <NonMessageEvent {text} {timestamp} />
{/if}

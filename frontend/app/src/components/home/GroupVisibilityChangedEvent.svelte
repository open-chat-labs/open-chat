<script lang="ts">
    import type { Level, UserSummary } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        user: UserSummary | undefined;
        isPublic: boolean | undefined;
        messagesVisibleToNonMembers: boolean | undefined;
        changedBy: string;
        timestamp: bigint;
        level: Level;
    }

    let { user, isPublic, messagesVisibleToNonMembers, changedBy, timestamp, level }: Props =
        $props();

    let showEvent = $derived(messagesVisibleToNonMembers !== undefined || isPublic !== undefined);
    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(buildDisplayName($allUsersStore, changedBy, me ? "me" : "user"));
    let text = $derived(
        interpolate(
            $_,
            i18nKey(
                "groupVisibilityChangedBy",
                {
                    changedBy: changedByStr,
                },
                level,
                true,
            ),
        ),
    );
</script>

{#if showEvent}
    <NonMessageEvent {text} {timestamp} />
{/if}

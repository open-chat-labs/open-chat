<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { Level, UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import { i18nKey, interpolate } from "../../i18n/i18n";

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
    let changedByStr = $derived(buildDisplayName($userStore, changedBy, me));
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

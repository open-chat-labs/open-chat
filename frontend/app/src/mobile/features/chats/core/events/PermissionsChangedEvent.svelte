<script lang="ts">
    import type { Level, PermissionsChanged, UserSummary } from "@client";
    import { allUsersStore } from "@client";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { buildDisplayName } from "@src/utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        event: PermissionsChanged;
        user: UserSummary | undefined;
        timestamp: bigint;
        level: Level;
    }

    let { event, user, timestamp, level }: Props = $props();

    let me = $derived(event.changedBy === user?.userId);
    let changedByStr = $derived(
        buildDisplayName($allUsersStore, event.changedBy, me ? "me" : "user"),
    );

    let text = $derived(
        interpolate(
            $_,
            i18nKey(
                "permissionsChangedBy",
                {
                    changedBy: changedByStr,
                },
                level,
                true,
            ),
        ),
    );
</script>

<NonMessageEvent {text} {timestamp} />

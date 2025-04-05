<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary, PermissionsChanged, Level } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import { i18nKey, interpolate } from "../../i18n/i18n";

    interface Props {
        event: PermissionsChanged;
        user: UserSummary | undefined;
        timestamp: bigint;
        level: Level;
    }

    let { event, user, timestamp, level }: Props = $props();

    let me = $derived(event.changedBy === user?.userId);
    let changedByStr = $derived(buildDisplayName($userStore, event.changedBy, me));

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

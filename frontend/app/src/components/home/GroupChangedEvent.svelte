<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import type { UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    interface Props {
        user: UserSummary | undefined;
        changedBy: string;
        property: string;
        timestamp: bigint;
        level: string;
    }

    let { user, changedBy, property, timestamp, level }: Props = $props();

    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(buildDisplayName($userStore, changedBy, me));
    let text = $derived(
        $_("groupChangedBy", {
            values: {
                changed: property,
                changedBy: changedByStr,
                level,
            },
        }),
    );
</script>

<NonMessageEvent {text} {timestamp} />

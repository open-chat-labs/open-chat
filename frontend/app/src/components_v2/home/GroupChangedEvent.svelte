<script lang="ts">
    import type { UserSummary } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        user: UserSummary | undefined;
        changedBy: string;
        property: string;
        timestamp: bigint;
        level: string;
    }

    let { user, changedBy, property, timestamp, level }: Props = $props();

    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(buildDisplayName($allUsersStore, changedBy, me ? "me" : "user"));
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

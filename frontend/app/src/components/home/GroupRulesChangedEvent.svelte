<script lang="ts">
    import type { GroupRulesChanged, UserSummary } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        user: UserSummary | undefined;
        event: GroupRulesChanged;
        timestamp: bigint;
    }

    let { user, event, timestamp }: Props = $props();

    let me = $derived(event.changedBy === user?.userId);
    let changedByStr = $derived(
        buildDisplayName($allUsersStore, event.changedBy, me ? "me" : "user"),
    );
    let templateValues = $derived({
        values: {
            changed: $_("groupRules"),
            changedBy: changedByStr,
        },
    });

    let text = $derived(
        event.enabled && event.enabledPrev
            ? $_("groupChangedBy", templateValues)
            : event.enabled
              ? $_("groupRulesEnabled", templateValues)
              : $_("groupRulesDisabled", templateValues),
    );
</script>

{#if event.enabled || event.enabledPrev}
    <NonMessageEvent {text} {timestamp} />
{/if}

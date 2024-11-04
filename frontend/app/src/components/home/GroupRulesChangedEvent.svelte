<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import type { UserSummary, GroupRulesChanged } from "openchat-client";
    import { userStore } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    export let user: UserSummary | undefined;
    export let event: GroupRulesChanged;
    export let timestamp: bigint;

    $: me = event.changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, event.changedBy, me);
    $: templateValues = {
        values: {
            changed: $_("groupRules"),
            changedBy: changedByStr,
        },
    };

    $: text =
        event.enabled && event.enabledPrev
            ? $_("groupChangedBy", templateValues)
            : event.enabled
              ? $_("groupRulesEnabled", templateValues)
              : $_("groupRulesDisabled", templateValues);
</script>

{#if event.enabled || event.enabledPrev}
    <NonMessageEvent {text} {timestamp} />
{/if}

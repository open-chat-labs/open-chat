<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, UserSummary, GroupRulesChanged } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let event: GroupRulesChanged;
    export let timestamp: bigint;

    $: userStore = client.userStore;
    $: me = event.changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[event.changedBy]?.username ?? $_("unknownUser");
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

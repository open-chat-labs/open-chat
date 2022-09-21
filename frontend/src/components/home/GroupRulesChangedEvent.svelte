<svelte:options immutable={true} />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { userStore } from "../../stores/user";
    import type { GroupRulesChanged } from "../../domain/chat/chat";

    export let user: UserSummary | undefined;
    export let event: GroupRulesChanged;
    export let timestamp: bigint;

    $: me = event.changedBy === user?.userId;
    $: changedByStr = me ? $_("you") : $userStore[event.changedBy]?.username ?? $_("unknownUser");
    $: templateValues = {
        values: {
            changed: "groupRules",
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

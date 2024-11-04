<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let changedBy: string;
    export let newTimeToLive: bigint | undefined;
    export let timestamp: bigint;

    $: me = changedBy === user?.userId;
    $: changedByStr = buildDisplayName($userStore, changedBy, me);
    $: text =
        newTimeToLive !== undefined
            ? $_("disappearingMessages.timeUpdatedBy", {
                  values: {
                      changedBy: changedByStr,
                      duration: client.formatDuration(Number(newTimeToLive)),
                  },
              })
            : $_("disappearingMessages.disabledBy", {
                  values: {
                      changedBy: changedByStr,
                  },
              });
</script>

<NonMessageEvent {text} {timestamp} />

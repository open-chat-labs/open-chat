<svelte:options immutable />

<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    const client = getContext<OpenChat>("client");

    interface Props {
        user: UserSummary | undefined;
        changedBy: string;
        newTimeToLive: bigint | undefined;
        timestamp: bigint;
    }

    let { user, changedBy, newTimeToLive, timestamp }: Props = $props();

    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(buildDisplayName($userStore, changedBy, me));
    let text = $derived(
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
              }),
    );
</script>

<NonMessageEvent {text} {timestamp} />

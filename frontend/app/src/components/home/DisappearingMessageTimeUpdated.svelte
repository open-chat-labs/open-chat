<script lang="ts">
    import type { OpenChat, UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        user: UserSummary | undefined;
        changedBy: string;
        newTimeToLive: bigint | undefined;
        timestamp: bigint;
    }

    let { user, changedBy, newTimeToLive, timestamp }: Props = $props();

    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(
        buildDisplayName(userStore.allUsers, changedBy, me ? "me" : "user"),
    );
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

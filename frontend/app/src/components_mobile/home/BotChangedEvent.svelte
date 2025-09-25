<script lang="ts">
    import { allUsersStore, botState } from "openchat-client";
    import type { BotAdded, BotRemoved, BotUpdated } from "openchat-shared";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        event: BotAdded | BotRemoved | BotUpdated;
        timestamp: bigint;
        userId: string;
        changedBy: string;
        resourceKey: string;
    }

    let { event, timestamp, userId, changedBy, resourceKey }: Props = $props();
    let me = $derived(userId === changedBy);
    let text = $derived.by(() => {
        const bot = botState.externalBots.get(event.userId);
        const username = buildDisplayName($allUsersStore, changedBy, me ? "me" : "user");
        return $_(resourceKey, { values: { botname: bot?.name, username } });
    });
</script>

<NonMessageEvent {text} {timestamp} />

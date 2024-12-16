<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { externalBots, userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import type { BotAdded, BotRemoved, BotUpdated } from "openchat-shared";
    import { buildDisplayName } from "../../utils/user";

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
        const bot = $externalBots.get(event.userId);
        const username = buildDisplayName($userStore, changedBy, me);
        return $_(resourceKey, { values: { botname: bot?.name, username } });
    });
</script>

<NonMessageEvent {text} {timestamp} />

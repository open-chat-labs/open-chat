<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import type { ChatUnfrozenEvent } from "openchat-shared";
    import { buildDisplayName } from "../../utils/user";

    interface Props {
        event: ChatUnfrozenEvent;
        user: UserSummary | undefined;
        timestamp: bigint;
    }

    let { event, user, timestamp }: Props = $props();

    let me = $derived(event.unfrozenBy === user?.userId);
    let unfrozenByStr = $derived(buildDisplayName($userStore, event.unfrozenBy, me));

    let text = $derived(
        $_("chatUnfrozenBy", {
            values: {
                unfrozenBy: unfrozenByStr,
            },
        }),
    );
</script>

<NonMessageEvent {text} {timestamp} />

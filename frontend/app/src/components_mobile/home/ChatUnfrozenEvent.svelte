<script lang="ts">
    import type { UserSummary } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import type { ChatUnfrozenEvent } from "openchat-shared";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        event: ChatUnfrozenEvent;
        user: UserSummary | undefined;
        timestamp: bigint;
    }

    let { event, user, timestamp }: Props = $props();

    let me = $derived(event.unfrozenBy === user?.userId);
    let unfrozenByStr = $derived(
        buildDisplayName($allUsersStore, event.unfrozenBy, me ? "me" : "user"),
    );

    let text = $derived(
        $_("chatUnfrozenBy", {
            values: {
                unfrozenBy: unfrozenByStr,
            },
        }),
    );
</script>

<NonMessageEvent {text} {timestamp} />

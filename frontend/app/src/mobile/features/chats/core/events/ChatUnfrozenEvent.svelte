<script lang="ts">
    import type { UserSummary } from "@client";
    import { allUsersStore } from "@client";
    import type { ChatUnfrozenEvent } from "@shared";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "@src/utils/user";
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

<script lang="ts">
    import type { UserSummary } from "@client";
    import { allUsersStore } from "@client";
    import type { ChatFrozenEvent } from "@shared";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        event: ChatFrozenEvent;
        user: UserSummary | undefined;
        timestamp: bigint;
    }

    let { event, user, timestamp }: Props = $props();

    let me = $derived(event.frozenBy === user?.userId);
    let frozenByStr = $derived(
        buildDisplayName($allUsersStore, event.frozenBy, me ? "me" : "user"),
    );

    let chatFrozenByText = $derived(
        $_("chatFrozenBy", {
            values: {
                frozenBy: frozenByStr,
            },
        }),
    );

    let text = $derived(
        event.reason ? `${chatFrozenByText}\n${$_("reason")}: ${event.reason}` : chatFrozenByText,
    );
</script>

<NonMessageEvent {text} {timestamp} />

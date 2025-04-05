<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import type { ChatFrozenEvent } from "openchat-shared";
    import { buildDisplayName } from "../../utils/user";

    interface Props {
        event: ChatFrozenEvent;
        user: UserSummary | undefined;
        timestamp: bigint;
    }

    let { event, user, timestamp }: Props = $props();

    let me = $derived(event.frozenBy === user?.userId);
    let frozenByStr = $derived(buildDisplayName($userStore, event.frozenBy, me));

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

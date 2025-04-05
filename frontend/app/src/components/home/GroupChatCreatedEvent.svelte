<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import { _ } from "svelte-i18n";
    import type { GroupChatCreated, ChatType } from "openchat-client";
    import { userStore } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";

    interface Props {
        me: boolean;
        event: GroupChatCreated;
        timestamp: bigint;
        chatType: ChatType;
    }

    let { me, event, timestamp, chatType }: Props = $props();

    let level = $derived($_(`level.${chatType === "channel" ? "channel" : "group"}`).toLowerCase());
    let username = $derived(buildDisplayName($userStore, event.created_by, me));
    let text = $derived(
        $_("groupCreatedBy", {
            values: {
                username,
                level,
            },
        }),
    );
</script>

<NonMessageEvent {text} {timestamp} />

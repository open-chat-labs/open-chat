<script lang="ts">
    import type { ChatType, GroupChatCreated } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        me: boolean;
        event: GroupChatCreated;
        timestamp: bigint;
        chatType: ChatType;
    }

    let { me, event, timestamp, chatType }: Props = $props();

    let level = $derived($_(`level.${chatType === "channel" ? "channel" : "group"}`).toLowerCase());
    let username = $derived(buildDisplayName(userStore.allUsers, event.created_by, me));
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

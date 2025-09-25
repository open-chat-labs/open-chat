<script lang="ts">
    import type { GroupInviteCodeChange, UserSummary } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        user: UserSummary | undefined;
        change: GroupInviteCodeChange;
        changedBy: string;
        timestamp: bigint;
    }

    let { user, change, changedBy, timestamp }: Props = $props();

    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(buildDisplayName($allUsersStore, changedBy, me ? "me" : "user"));
    let changedStr = $derived($_(`invite.${change}`));
    let text = $derived(
        $_("groupInviteChangedBy", {
            values: {
                changedBy: changedByStr,
                changed: changedStr,
            },
        }),
    );
</script>

<NonMessageEvent {text} {timestamp} />
